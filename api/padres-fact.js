import { getDashboardClient } from './_lib.js';

// In-memory cache (per warm serverless instance) keyed by the Eastern date.
// Backed by a persistent Supabase cache so the paid Anthropic call runs at most
// once per day globally, regardless of traffic or how many instances are warm.
let memoryCache = { dateKey: null, fact: null };

// Returns YYYY-MM-DD in US Eastern — the key for "today's fact".
function easternDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const dateKey = easternDateKey();

  // Layer 1: in-memory cache on this instance.
  if (memoryCache.dateKey === dateKey && memoryCache.fact) {
    return res.status(200).json({ fact: memoryCache.fact, cached: true });
  }

  // Layer 2: persistent cache in Supabase. Falls through gracefully if the
  // table doesn't exist yet or the DB is unreachable.
  let cacheClient = null;
  try {
    cacheClient = getDashboardClient();
    const { data, error } = await cacheClient
      .from('padres_fact_cache')
      .select('fact')
      .eq('fact_date', dateKey)
      .maybeSingle();
    if (!error && data?.fact) {
      memoryCache = { dateKey, fact: data.fact };
      return res.status(200).json({ fact: data.fact, cached: true });
    }
  } catch {
    cacheClient = null; // Cache unavailable — generate without persistence.
  }

  const dateStr = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' });

  async function callClaude(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data?.content;
    if (!Array.isArray(content)) return null;

    // The response may contain tool_use and tool_result blocks interspersed
    // with text. Take the last text block, which is the final answer.
    const textBlocks = content
      .filter(block => block.type === 'text' && block.text?.trim())
      .map(block => block.text.trim());

    if (textBlocks.length === 0) return null;

    // Return the last text block — the final answer always comes after tool_use and tool_result blocks
    return textBlocks[textBlocks.length - 1];
  }

  const stage1Prompt = `Today is ${dateStr}. Search the web for something that happened on this calendar date in San Diego Padres history — any year from 1969 to present. It can be anything: a win, a loss, a trade, a debut, a benching, a walk-off, a bad loss, an odd stat line. It does not need to be a milestone or a record. It just needs to be real and verifiable.

The fact must be about a San Diego Padres player, achievement, or moment. Do not return facts where the Padres are incidental — for example, do not return a fact that is primarily about an opposing player or team, even if the game was played against the Padres.

Search first. Only report what you find. Do not generate facts from memory. Do not use results from 2025 or 2026 — look for historical facts from 1969 through 2024 only. You must end with the year in parentheses — for example: (2003). Never omit the year. If you find something, write it in 2–4 sentences in an almanac caption style, opening with a specific stat or detail. If you genuinely find nothing for this exact date after searching, respond with only the word: NOTFOUND`;

  const stage2Prompt = `Search the web for a true, verifiable, specific fact from San Diego Padres history — any date, any year from 1969 to present. It can be anything: a win, a loss, a trade, a debut, a strange stat line. It does not need to be a milestone. It just needs to be real and confirmed by a source.

The fact must be about a San Diego Padres player, achievement, or moment. Do not return facts where the Padres are incidental — for example, do not return a fact that is primarily about an opposing player or team, even if the game was played against the Padres.

Search first. Do not generate from memory. Write it in 2–4 sentences in an almanac caption style, opening with a specific stat or detail. You must end with the year in parentheses — for example: (2003). Never omit the year. Do not mention a specific date.`;

  try {
    let fact = await callClaude(stage1Prompt);

    if (!fact || fact === 'NOTFOUND') {
      fact = await callClaude(stage2Prompt);
    }

    if (!fact) {
      // Don't cache the fallback — we want to retry generation on the next request.
      return res.status(200).json({ fact: 'The Padres have played since 1969. Check back tomorrow.' });
    }

    // Persist so the paid call doesn't run again today. upsert dedupes races.
    memoryCache = { dateKey, fact };
    if (cacheClient) {
      try {
        await cacheClient
          .from('padres_fact_cache')
          .upsert({ fact_date: dateKey, fact }, { onConflict: 'fact_date' });
      } catch {
        // Persistence is best-effort; the in-memory layer still applies.
      }
    }

    return res.status(200).json({ fact });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
