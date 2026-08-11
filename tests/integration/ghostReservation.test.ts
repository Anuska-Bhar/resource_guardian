import { describe, beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { getTestPool, applySchema, resetDatabase, seedResource, seedReservation, closeTestPool } from '../helpers/db';
import { GhostReservationDetector } from '../../src/engine/detectors/ghostReservation';
import type { PoolClient } from 'pg';

describe('GhostReservationDetector (integration)', () => {
  let client: PoolClient;

  beforeAll(async () => {
    await applySchema();
    client = await getTestPool().connect();
  });

  beforeEach(async () => {
    await resetDatabase();

    const resourceId = await seedResource(client, 'Room Type A', 'Resort Hotel');

    // past, checked out, used hours => not a ghost
    await seedReservation(client, resourceId, 'Online TA', 120, 120, '2024-01-15', 'Check-Out');
    // past, no-show, 0 used hours => ghost
    await seedReservation(client, resourceId, 'Online TA', 120, 0, '2024-01-16', 'No-Show');
    // past, canceled, 0 used hours => not a ghost (canceled)
    await seedReservation(client, resourceId, 'Corporate', 120, 0, '2024-01-18', 'Canceled');
    // past, checked out but partially used => not a ghost
    await seedReservation(client, resourceId, 'Corporate', 120, 60, '2024-01-20', 'Check-Out');
    // future, 0 used hours => not a ghost (future)
    await seedReservation(client, resourceId, 'Online TA', 120, 0, '2099-01-01', 'Check-Out');
  });

  afterAll(async () => {
    client.release();
    await closeTestPool();
  });

  it('detects ghost reservations excluding cancelled and future bookings', async () => {
    const detector = new GhostReservationDetector();
    const results = await detector.detect(getTestPool());

    const result = results.find(r => r.resourceName === 'Room Type A');
    expect(result).toBeDefined();
    expect(result!.type).toBe('GHOST_RESERVATION');
    // 5 total reservations, but only 3 are eligible (excludes 1 Canceled + 1 future)
    // of those 3, only 1 has actual_used_hours = 0 (the No-Show)
    expect(result!.score).toBeCloseTo(1 / 3, 1);
  });

  it('does not flag resources where all bookings were used', async () => {
    await resetDatabase();
    const resourceId = await seedResource(client, 'Room Type B', 'Resort Hotel');

    await seedReservation(client, resourceId, 'Online TA', 120, 120, '2024-01-15', 'Check-Out');
    await seedReservation(client, resourceId, 'Online TA', 120, 120, '2024-01-16', 'Check-Out');

    const detector = new GhostReservationDetector();
    const results = await detector.detect(getTestPool());
    expect(results.find(r => r.resourceName === 'Room Type B')).toBeUndefined();
  });

  it('returns empty array when no reservations exist', async () => {
    await resetDatabase();
    const detector = new GhostReservationDetector();
    const results = await detector.detect(getTestPool());
    expect(results).toHaveLength(0);
  });
});
