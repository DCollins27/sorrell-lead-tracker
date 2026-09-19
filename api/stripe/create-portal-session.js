import { getUserWithAccess } from '../../lib/auth.js';
import { stripe } from '../../lib/stripe.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserWithAccess(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!user.stripe_customer_id) {
    return res.status(400).json({ error: 'No billing account found yet' });
  }

  try {
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${appUrl}/app.html`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Portal session error:', err);
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
}
