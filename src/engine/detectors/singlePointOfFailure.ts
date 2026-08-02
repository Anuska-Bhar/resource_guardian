import { Pool } from 'pg';
import { Detector, RiskSignal } from '../types';

export class SinglePointOfFailureDetector implements Detector {
  async detect(pool: Pool): Promise<RiskSignal[]> {
    const { rows } = await pool.query(`
      SELECT res.resource_id, r.name, r.pool, sum(res.actual_used_hours) as used
      FROM reservations res JOIN resources r ON r.id = res.resource_id
      GROUP BY res.resource_id, r.name, r.pool
    `);
    const poolTotals = new Map<string, number>();
    for (const r of rows) poolTotals.set(r.pool, (poolTotals.get(r.pool) ?? 0) + Number(r.used));
    return rows
      .map(r => ({ r, share: Number(r.used) / (poolTotals.get(r.pool) || 1) }))
      .filter(({ share }) => share > 0.6)
      .map(({ r, share }) => ({
        type: 'SINGLE_POINT_OF_FAILURE',
        resourceId: r.resource_id,
        resourceName: r.name,
        score: share,
        reason: `Carries ${(share * 100).toFixed(0)}% of usage in "${r.pool}" pool`,
      }));
  }
}