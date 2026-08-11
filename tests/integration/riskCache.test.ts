import { describe, beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { getTestPool, applySchema, resetDatabase, seedResource, seedReservation, closeTestPool } from '../helpers/db';
import { getCachedRisks } from '../../src/cache/riskCache';
import { createRiskEngine } from '../../src/engine/riskEngine';
import type { PoolClient } from 'pg';

describe('riskCache (integration)', () => {
  let client: PoolClient;
  let redis: any;

  beforeAll(async () => {
    await applySchema();
    client = await getTestPool().connect();

    const Redis = (await import('ioredis')).default;
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  });

  beforeEach(async () => {
    await resetDatabase();
    await redis.del('risk:latest');

    const resA = await seedResource(client, 'Room A', 'Resort Hotel');
    await seedReservation(client, resA, 'Online TA', 120, 0, '2024-01-15', 'No-Show');
    await seedReservation(client, resA, 'Online TA', 120, 0, '2024-01-16', 'No-Show');
  });

  afterAll(async () => {
    client.release();
    await redis?.quit();
    await closeTestPool();
  });

  it('queries DB on cache miss and populates cache', async () => {
    const engine = createRiskEngine();

    const results = await getCachedRisks(redis, getTestPool(), engine);
    expect(results.length).toBeGreaterThan(0);

    // cache should now be populated
    const cached = await redis.get('risk:latest');
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(results.length);
  });

  it('returns cached data on cache hit without querying DB', async () => {
    const engine = createRiskEngine();

    // first call: cache miss, populates cache
    const firstResults = await getCachedRisks(redis, getTestPool(), engine);

    // populate a sentinel value in cache to verify it's returned
    const sentinel = [{ type: 'CACHED', resourceId: 999, resourceName: 'sentinel', score: 1, reason: 'from cache' }];
    await redis.set('risk:latest', JSON.stringify(sentinel), 'EX', 300);

    // second call: should return cached sentinel, not query DB
    const secondResults = await getCachedRisks(redis, getTestPool(), engine);
    expect(secondResults).toEqual(sentinel);
    expect(secondResults[0].resourceName).toBe('sentinel');
  });

  it('handles empty result sets', async () => {
    await resetDatabase();
    const engine = createRiskEngine();

    await redis.del('risk:latest');
    const results = await getCachedRisks(redis, getTestPool(), engine);
    expect(results).toHaveLength(0);
  });
});
