import { describe, beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { getTestPool, applySchema, resetDatabase, seedResource, seedReservation, closeTestPool } from '../helpers/db';
import { RiskEngine } from '../../src/engine/riskEngine';
import { GhostReservationDetector } from '../../src/engine/detectors/ghostReservation';
import { HoardingDetector } from '../../src/engine/detectors/hoarding';
import { SinglePointOfFailureDetector } from '../../src/engine/detectors/singlePointOfFailure';
import type { PoolClient } from 'pg';

describe('RiskEngine (integration)', () => {
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

  it('runs all detectors and aggregates results', async () => {
    const resA = await seedResource(client, 'Room A', 'Resort Hotel');
    const resB = await seedResource(client, 'Room B', 'Resort Hotel');

    // Room A: ghost (0 used) + hoarding (high waste) + single point of failure (high share)
    await seedReservation(client, resA, 'Online TA', 120, 0, '2024-01-15', 'No-Show');
    await seedReservation(client, resA, 'Online TA', 120, 0, '2024-01-16', 'No-Show');
    await seedReservation(client, resA, 'Online TA', 120, 0, '2024-01-17', 'No-Show');
    await seedReservation(client, resA, 'Online TA', 120, 20, '2024-01-18', 'Check-Out');

    // Room B: minimal usage
    await seedReservation(client, resB, 'Online TA', 120, 10, '2024-01-15', 'Check-Out');

    const engine = new RiskEngine([
      new GhostReservationDetector(),
      new HoardingDetector(),
      new SinglePointOfFailureDetector(),
    ]);

    const results = await engine.run(getTestPool());

    // should have signals from multiple detectors
    const types = new Set(results.map(r => r.type));
    expect(types.has('GHOST_RESERVATION')).toBe(true);
    expect(types.has('HOARDING')).toBe(true);
    expect(types.has('SINGLE_POINT_OF_FAILURE')).toBe(true);
  });

  it('returns empty array when no data exists', async () => {
    const engine = new RiskEngine([
      new GhostReservationDetector(),
      new HoardingDetector(),
      new SinglePointOfFailureDetector(),
    ]);

    const results = await engine.run(getTestPool());
    expect(results).toHaveLength(0);
  });

  it('works standalone without redis', async () => {
    const resA = await seedResource(client, 'Room A', 'Resort Hotel');
    await seedReservation(client, resA, 'Online TA', 120, 0, '2024-01-15', 'No-Show');
    await seedReservation(client, resA, 'Online TA', 120, 0, '2024-01-16', 'No-Show');

    const engine = new RiskEngine([
      new GhostReservationDetector(),
      new HoardingDetector(),
      new SinglePointOfFailureDetector(),
    ]);

    const results = await engine.run(getTestPool());
    expect(results.length).toBeGreaterThan(0);
  });
});
