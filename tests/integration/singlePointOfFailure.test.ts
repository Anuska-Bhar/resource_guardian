import { describe, beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { getTestPool, applySchema, resetDatabase, seedResource, seedReservation, closeTestPool } from '../helpers/db';
import { SinglePointOfFailureDetector } from '../../src/engine/detectors/singlePointOfFailure';
import type { PoolClient } from 'pg';

describe('SinglePointOfFailureDetector (integration)', () => {
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

  it('flags a resource carrying >60% of pool usage', async () => {
    const resA = await seedResource(client, 'Room A', 'Resort Hotel');
    const resB = await seedResource(client, 'Room B', 'Resort Hotel');

    // Room A: 100 used hours
    await seedReservation(client, resA, 'Online TA', 120, 100, '2024-01-15', 'Check-Out');
    // Room B: 30 used hours
    await seedReservation(client, resB, 'Online TA', 120, 30, '2024-01-16', 'Check-Out');

    // total pool usage = 130, Room A share = 100/130 = ~76.9% => flagged
    const detector = new SinglePointOfFailureDetector();
    const results = await detector.detect(getTestPool());
    const flagged = results.find(r => r.resourceName === 'Room A');
    expect(flagged).toBeDefined();
    expect(flagged!.type).toBe('SINGLE_POINT_OF_FAILURE');
    expect(flagged!.score).toBeCloseTo(100 / 130, 1);

    // Room B: 30/130 = ~23% => not flagged
    expect(results.find(r => r.resourceName === 'Room B')).toBeUndefined();
  });

  it('does not flag resources when usage is balanced', async () => {
    const resA = await seedResource(client, 'Room C', 'City Hotel');
    const resB = await seedResource(client, 'Room D', 'City Hotel');

    // both have equal usage: 60/60 => 50% each => neither flagged
    await seedReservation(client, resA, 'Direct', 120, 60, '2024-01-15', 'Check-Out');
    await seedReservation(client, resB, 'Direct', 120, 60, '2024-01-16', 'Check-Out');

    const detector = new SinglePointOfFailureDetector();
    const results = await detector.detect(getTestPool());
    expect(results).toHaveLength(0);
  });

  it('handles multiple pools independently', async () => {
    const resA = await seedResource(client, 'Room E', 'Resort Hotel');
    const resB = await seedResource(client, 'Room F', 'City Hotel');

    // Resort pool: only Room E, 100% share
    await seedReservation(client, resA, 'Online TA', 120, 80, '2024-01-15', 'Check-Out');
    // City pool: only Room F, 100% share
    await seedReservation(client, resB, 'Direct', 120, 80, '2024-01-16', 'Check-Out');

    const detector = new SinglePointOfFailureDetector();
    const results = await detector.detect(getTestPool());
    expect(results).toHaveLength(2);
    expect(results.every(r => r.score > 0.6)).toBe(true);
  });

  it('returns empty array when no reservations exist', async () => {
    const detector = new SinglePointOfFailureDetector();
    const results = await detector.detect(getTestPool());
    expect(results).toHaveLength(0);
  });
});
