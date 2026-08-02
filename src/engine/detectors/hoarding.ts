import { Pool } from 'pg';
import { Detector, RiskSignal } from '../types';

export class HoardingDetector implements Detector {
  async detect(pool: Pool): Promise<RiskSignal[]> {
    const { rows } = await pool.query(`
      SELECT res.resource_id, r.name,
             sum(res.booked_hours) as booked,
             sum(res.actual_used_hours) as used
      FROM reservations res JOIN resources r ON r.id = res.resource_id
      GROUP BY res.resource_id, r.name
      HAVING sum(res.booked_hours) > 0
    `);
    return rows
      .map(r => ({ r, waste: 1 - Number(r.used) / Number(r.booked) }))
      .filter(({ waste }) => waste > 0.5)
      .map(({ r, waste }) => ({
        type: 'HOARDING',
        resourceId: r.resource_id,
        resourceName: r.name,
        score: waste,
        reason: `${(waste * 100).toFixed(0)}% of booked hours never used`,
      }));
  }
}