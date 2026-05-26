// Vercel Serverless Function — Anthropic API Proxy
// This keeps your API key hidden server-side
// Set ANTHROPIC_API_KEY in Vercel Environment Variables

export default async function handler(req, res) {
  // CORS headers for browser access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get API key from environment variable
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured. Add ANTHROPIC_API_KEY to Vercel environment variables.'
    });
  }

  try {
    // Extract prompt from request body
    const { prompt, max_tokens = 1000 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: max_tokens,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    // Handle API errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return res.status(response.status).json({
        error: 'AI service error',
        details: errorText
      });
    }

    const data = await response.json();

    // Extract text response
    const text = data.content?.[0]?.text || 'No response generated';

    return res.status(200).json({ text, success: true });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  }
}
