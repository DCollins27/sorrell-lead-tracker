import { getUserWithAccess } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getUserWithAccess(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    return res.status(200).json({
      id: user.id,
      email: user.email,
      businessName: user.business_name,
      trialEndsAt: user.trial_ends_at,
      subscriptionStatus: user.subscription_status,
      trialActive: user.trialActive,
      hasAccess: user.hasAccess,
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Could not load account' });
  }
}
