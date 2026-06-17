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

    // Return the longest text block — the final answer is always more substantial than preamble
    return textBlocks.reduce((a, b) => a.length >= b.length ? a : b);
  }

  const stage1Prompt = `Today is ${dateStr}. Search the web for something that actually happened on this calendar date in San Diego Padres history — any year from 1969 to present. It can be anything: a win, a loss, a trade, a debut, a benching, a walk-off, a bad loss, an odd stat line. It does not need to be a milestone or a record. It just needs to be real and verifiable.

Search first. Only report what you find. Do not generate facts from memory. If you find something, write it in 2–4 sentences in an almanac caption style, opening with a specific stat or detail. End with the year in parentheses. If you genuinely find nothing for this exact date after searching, respond with only the word: NOTFOUND`;

  const stage2Prompt = `Search the web for a true, verifiable, specific fact from San Diego Padres history — any date, any year from 1969 to present. It can be anything: a win, a loss, a trade, a debut, a strange stat line. It does not need to be a milestone. It just needs to be real and confirmed by a source. Search first. Do not generate from memory. Write it in 2–4 sentences in an almanac caption style, opening with a specific stat or detail. Do not mention a specific date.`;

  try {
    let fact = await callClaude(stage1Prompt);

    if (!fact || fact === 'NOTFOUND') {
      fact = await callClaude(stage2Prompt);
    }

    if (!fact) {
      return res.status(200).json({ fact: 'The Padres have played since 1969. Check back tomorrow.' });
    }

    return res.status(200).json({ fact });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
