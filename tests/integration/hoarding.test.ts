import { describe, beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { getTestPool, applySchema, resetDatabase, seedResource, seedReservation, closeTestPool } from '../helpers/db';
import { HoardingDetector } from '../../src/engine/detectors/hoarding';
import type { PoolClient } from 'pg';

describe('HoardingDetector (integration)', () => {
  let client: PoolClient;

  beforeAll(async () => {
    await applySchema();
    client = await getTestPool().connect();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    client.release();
    await closeTestPool();
  });

  it('flags resources with >50% wasted booked hours', async () => {
    const resourceId = await seedResource(client, 'Suite X', 'Resort Hotel');

    // booked 120, used 20 => 83% waste
    await seedReservation(client, resourceId, 'Online TA', 120, 20, '2024-01-15', 'Check-Out');
    // booked 120, used 120 => 0% waste
    await seedReservation(client, resourceId, 'Online TA', 120, 120, '2024-01-16', 'Check-Out');

    // total: booked 240, used 140 => waste = 1 - 140/240 = ~41.7% => NOT flagged
    const detector = new HoardingDetector();
    let results = await detector.detect(getTestPool());
    expect(results.find(r => r.resourceName === 'Suite X')).toBeUndefined();

    // add another wasteful booking: booked 120, used 0 => 100% waste
    await seedReservation(client, resourceId, 'Online TA', 120, 0, '2024-01-17', 'No-Show');
    // total: booked 360, used 140 => waste = 1 - 140/360 = ~61.1% => flagged
    results = await detector.detect(getTestPool());
    const result = results.find(r => r.resourceName === 'Suite X');
    expect(result).toBeDefined();
    expect(result!.type).toBe('HOARDING');
    expect(result!.score).toBeCloseTo(1 - 140 / 360, 1);
  });

  it('does not flag resources where usage is efficient', async () => {
    const resourceId = await seedResource(client, 'Suite Y', 'City Hotel');

    await seedReservation(client, resourceId, 'Direct', 120, 100, '2024-01-15', 'Check-Out');
    await seedReservation(client, resourceId, 'Direct', 120, 110, '2024-01-16', 'Check-Out');

    // total: booked 240, used 210 => waste = 1 - 210/240 = 12.5% => NOT flagged
    const detector = new HoardingDetector();
    const results = await detector.detect(getTestPool());
    expect(results.find(r => r.resourceName === 'Suite Y')).toBeUndefined();
  });

  it('handles resources with zero booked hours gracefully', async () => {
    const resourceId = await seedResource(client, 'Suite Z', 'City Hotel');

    await seedReservation(client, resourceId, 'Direct', 0, 0, '2024-01-15', 'Check-Out');

    const detector = new HoardingDetector();
    const results = await detector.detect(getTestPool());
    // HAVING sum(booked_hours) > 0 excludes this
    expect(results.find(r => r.resourceName === 'Suite Z')).toBeUndefined();
  });

  it('returns empty array when no reservations exist', async () => {
    const detector = new HoardingDetector();
    const results = await detector.detect(getTestPool());
    expect(results).toHaveLength(0);
  });
});
