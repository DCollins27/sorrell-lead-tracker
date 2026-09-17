// Vercel Serverless Function — Anthropic API Proxy
// Keeps the Anthropic API key server-side, and gates use behind login + trial/subscription.
// Set ANTHROPIC_API_KEY in your Vercel Environment Variables.

import { getUserWithAccess } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserWithAccess(req);
  if (!user) return res.status(401).json({ error: 'Please log in to use the AI assistant.' });
  if (!user.hasAccess) {
    return res
      .status(402)
      .json({ error: 'Your free trial has ended. Subscribe to keep using the AI assistant.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured. Add ANTHROPIC_API_KEY to your Vercel environment variables.',
    });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt in request body' });
    }
    if (prompt.length > 8000) {
      return res.status(400).json({ error: 'Prompt is too long' });
    }

    // Fixed server-side cap: this endpoint isn't billed per-user, so client
    // input must never control how much of the operator's Anthropic quota
    // a single request can spend.
    const max_tokens = 1000;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', errorText);
      return res.status(response.status).json({
        error: 'AI service error',
        details: errorText,
      });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || 'No response generated';

    return res.status(200).json({ text, success: true });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  }
}
