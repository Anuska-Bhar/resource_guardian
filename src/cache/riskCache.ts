import Redis from 'ioredis';
import { Pool } from 'pg';
import { RiskEngine } from '../engine/riskEngine';
import { RiskSignal } from '../engine/types';

export async function getCachedRisks(redis: Redis, pool: Pool, engine: RiskEngine): Promise<RiskSignal[]> {
  const cached = await redis.get('risk:latest');
  if (cached) return JSON.parse(cached);
  const fresh = await engine.run(pool);
  await redis.set('risk:latest', JSON.stringify(fresh), 'EX', 300);
  return fresh;
}