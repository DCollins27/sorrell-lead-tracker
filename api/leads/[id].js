import { getUserWithAccess } from '../../lib/auth.js';
import { query } from '../../lib/db.js';

export default async function handler(req, res) {
  const user = await getUserWithAccess(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const leadId = Number(req.query.id);
  if (!Number.isInteger(leadId)) return res.status(400).json({ error: 'Invalid lead id' });

  const existingResult = await query('SELECT * FROM leads WHERE id = $1 AND user_id = $2', [
    leadId,
    user.id,
  ]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: 'Lead not found' });

  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!user.hasAccess) {
      return res
        .status(402)
        .json({ error: 'Your free trial has ended. Subscribe to keep editing leads.' });
    }
    const body = req.body || {};
    // Merge onto the existing row so a partial update (e.g. just a drag-and-drop
    // status change) never wipes out the other fields.
    const merged = {
      name: body.name !== undefined ? body.name : existing.name,
      company: body.company !== undefined ? body.company : existing.company,
      follow_up_date: body.followUpDate !== undefined ? body.followUpDate : existing.follow_up_date,
      value: body.value !== undefined ? body.value : existing.value,
      source: body.source !== undefined ? body.source : existing.source,
      service: body.service !== undefined ? body.service : existing.service,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      status: body.status !== undefined ? body.status : existing.status,
    };

    try {
      const result = await query(
        `UPDATE leads SET name=$1, company=$2, follow_up_date=$3, value=$4, source=$5, service=$6, notes=$7, status=$8, updated_at=now()
         WHERE id = $9 AND user_id = $10 RETURNING *`,
        [
          merged.name,
          merged.company,
          merged.follow_up_date,
          merged.value,
          merged.source,
          merged.service,
          merged.notes,
          merged.status,
          leadId,
          user.id,
        ]
      );
      return res.status(200).json({ lead: result.rows[0] });
    } catch (err) {
      console.error('Update lead error:', err);
      return res.status(500).json({ error: 'Could not update lead' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await query('DELETE FROM leads WHERE id = $1 AND user_id = $2', [leadId, user.id]);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete lead error:', err);
      return res.status(500).json({ error: 'Could not delete lead' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
