import { getUserWithAccess } from '../../lib/auth.js';
import { query } from '../../lib/db.js';

export default async function handler(req, res) {
  const user = await getUserWithAccess(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    try {
      const result = await query('SELECT * FROM leads WHERE user_id = $1 ORDER BY created_at DESC', [
        user.id,
      ]);
      return res.status(200).json({ leads: result.rows });
    } catch (err) {
      console.error('List leads error:', err);
      return res.status(500).json({ error: 'Could not load leads' });
    }
  }

  if (req.method === 'POST') {
    if (!user.hasAccess) {
      return res
        .status(402)
        .json({ error: 'Your free trial has ended. Subscribe to keep adding leads.' });
    }
    const { name, company, followUpDate, value, source, service, notes, status } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Lead name is required' });

    try {
      const result = await query(
        `INSERT INTO leads (user_id, name, company, follow_up_date, value, source, service, notes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          user.id,
          name,
          company || null,
          followUpDate || null,
          value || null,
          source || null,
          service || null,
          notes || null,
          status || 'new',
        ]
      );
      return res.status(201).json({ lead: result.rows[0] });
    } catch (err) {
      console.error('Create lead error:', err);
      return res.status(500).json({ error: 'Could not create lead' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
