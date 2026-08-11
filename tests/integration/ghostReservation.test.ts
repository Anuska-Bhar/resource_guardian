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

  it('detects ghost reservations based on actual_used_hours = 0', async () => {
    const detector = new GhostReservationDetector();
    const results = await detector.detect(getTestPool());

    // current schema marks any reservation with actual_used_hours = 0 as ghost
    // that includes no-show, canceled, and future bookings
    // this test documents current behavior; will be updated when semantics are corrected
    const result = results.find(r => r.resourceName === 'Room Type A');
    expect(result).toBeDefined();
    expect(result!.type).toBe('GHOST_RESERVATION');
    // 5 total reservations, 3 have actual_used_hours = 0 (no-show, canceled, future)
    expect(result!.score).toBeCloseTo(3 / 5, 1);
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
