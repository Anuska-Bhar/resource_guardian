import { Pool } from 'pg';
import { Detector, RiskSignal } from '../types';

export class GhostReservationDetector implements Detector {
  async detect(pool: Pool): Promise<RiskSignal[]> {
    const { rows } = await pool.query(`
      SELECT res.resource_id, r.name,
             count(*) filter (where res.actual_used_hours = 0) as ghosts,
             count(*) as total
      FROM reservations res JOIN resources r ON r.id = res.resource_id
      WHERE res.raw_status IS DISTINCT FROM 'Canceled'
        AND res.booking_start < CURRENT_DATE
      GROUP BY res.resource_id, r.name
    `);
    return rows
      .filter(r => r.total > 0 && r.ghosts / r.total > 0.3)
      .map(r => ({
        type: 'GHOST_RESERVATION',
        resourceId: r.resource_id,
        resourceName: r.name,
        score: Number(r.ghosts) / Number(r.total),
        reason: `${r.ghosts}/${r.total} reservations never used`,
      }));
  }
}