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
  const prompt = `You are a San Diego Padres historian and statistician. Today is ${months[today.getMonth()]} ${today.getDate()}.

Write one short, stats-driven fact about the San Diego Padres following these priorities in order:

PRIORITY 1 — Search Padres history for anything that happened on ${months[today.getMonth()]} ${today.getDate()} (any year, 1969–present): a game result, no-hitter, trade, signing, draft pick, debut, record broken, or any other notable event. If you find one, write about it.

PRIORITY 2 — If nothing notable happened on this date, write about any significant Padres moment or player from franchise history. Choose from the full breadth of Padres history — do not default to Tony Gwynn. Draw from players such as: Nate Colbert, Randy Jones, Rollie Fingers, Dave Winfield, Garry Templeton, Steve Garvey, Benito Santiago, Ken Caminiti, Trevor Hoffman, Jake Peavy, Adrian Gonzalez, Chase Headley, Fernando Tatis Jr., Manny Machado, Yu Darvish, Joe Musgrove, or any other Padre.

Format rules:
- Open with a specific number or statistic (batting average, ERA, WAR, strikeouts, streak length, etc.)
- Use real, verifiable statistics only
- 2–4 sentences maximum
- Written like a caption in a baseball almanac
- If writing about a specific event, end with the year in parentheses
- Output only the fact — no preamble, no title, nothing else`;

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
