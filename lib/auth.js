import jwt from 'jsonwebtoken';
import { query } from './db.js';

const COOKIE_NAME = 'session';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

export function signSession(userId) {
  return jwt.sign({ uid: userId }, getJwtSecret(), { expiresIn: '30d' });
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(val);
  });
  return cookies;
}

export function getUserIdFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, getJwtSecret());
    return payload.uid;
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax${isProd ? '; Secure' : ''}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

// Loads the logged-in user and whether their trial/subscription currently grants access.
export async function getUserWithAccess(req) {
  const userId = getUserIdFromRequest(req);
  if (!userId) return null;

  const result = await query(
    `SELECT id, email, business_name, trial_ends_at, subscription_status,
            stripe_customer_id, stripe_subscription_id
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = result.rows[0];
  if (!user) return null;

  const trialActive =
    user.subscription_status === 'trialing' && new Date(user.trial_ends_at) > new Date();
  const hasAccess = trialActive || user.subscription_status === 'active';

  return { ...user, trialActive, hasAccess };
}
