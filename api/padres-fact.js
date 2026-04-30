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

  const today = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dateStr = `${days[today.getDay()]}, ${months[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

  const prompt = `You are a San Diego Padres historian and statistician. Today is ${dateStr} (month ${today.getMonth() + 1}, day ${today.getDate()}).

Generate a single, compelling, stats-driven Padres fact for today. Focus on one of:
- A notable Padres game or event that happened on this calendar date (any year)
- A remarkable statistical achievement or milestone in franchise history
- A fascinating historical stat or record about the Padres
- A notable player's career stat or milestone that Padres fans would love

Requirements:
- Lead with a specific number or statistic (WAR, ERA, batting average, wins, streak, etc.)
- Be precise — use real statistics
- Be 2–4 sentences maximum
- Do NOT mention AI or that you are generating this
- Write as if it's a caption in a baseball almanac
- End with the year in parentheses if referencing a specific event

Just write the fact, nothing else. No preamble, no title.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Upstream API error' });
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) return res.status(502).json({ error: 'No content returned' });

    return res.status(200).json({ fact: text });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error' });
  }
}
