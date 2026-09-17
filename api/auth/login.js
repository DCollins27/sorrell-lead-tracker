import bcrypt from 'bcryptjs';
import { query } from '../../lib/db.js';
import { signSession, setSessionCookie } from '../../lib/auth.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// A precomputed hash with no matching password, compared against when the
// email doesn't exist so failed logins take the same time either way and
// don't leak which emails have accounts via response timing.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8i8dGgYQzD8HHu2s4jUqL2Rz2C0.q6';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const result = await query(
      'SELECT id, password_hash, failed_login_attempts, locked_until FROM users WHERE email = $1',
      [String(email).trim().toLowerCase()]
    );
    const user = result.rows[0];

    if (user?.locked_until && new Date(user.locked_until) > new Date()) {
      return res
        .status(429)
        .json({ error: 'Too many failed attempts. Try again in a few minutes.' });
    }

    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !valid) {
      if (user) {
        const attempts = user.failed_login_attempts + 1;
        const lockedUntil =
          attempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : null;
        await query('UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3', [
          attempts,
          lockedUntil,
          user.id,
        ]);
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await query('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1', [
      user.id,
    ]);

    const token = signSession(user.id);
    setSessionCookie(res, token);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}
