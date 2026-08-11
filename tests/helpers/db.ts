import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

let pool: Pool | null = null;

export function getTestPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE || 'resource_guardian',
      user: process.env.PGUSER || 'guardian_app',
      password: process.env.PGPASSWORD || 'changeme',
    });
  }
  return pool;
}

export async function applySchema(): Promise<void> {
  const p = getTestPool();
  const client = await p.connect();
  try {
    await client.query('SELECT pg_advisory_lock(42)');
    const schema = readFileSync(join(__dirname, '../../src/db/schema.sql'), 'utf-8');
    await client.query(schema);
  } finally {
    await client.query('SELECT pg_advisory_unlock(42)');
    client.release();
  }
}

export async function resetDatabase(): Promise<void> {
  const p = getTestPool();
  await p.query('TRUNCATE reservations, resources RESTART IDENTITY CASCADE');
}

export async function seedResource(client: PoolClient, name: string, poolName: string): Promise<number> {
  const { rows } = await client.query(
    `INSERT INTO resources (name, pool) VALUES ($1, $2)
     ON CONFLICT (name, pool) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name, poolName]
  );
  return rows[0].id;
}

export async function seedReservation(
  client: PoolClient,
  resourceId: number,
  team: string,
  bookedHours: number,
  actualUsedHours: number,
  bookingStart: string,
  rawStatus: string
): Promise<void> {
  await client.query(
    `INSERT INTO reservations (resource_id, team, booked_hours, actual_used_hours, booking_start, raw_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ON CONSTRAINT unique_reservation DO NOTHING`,
    [resourceId, team, bookedHours, actualUsedHours, bookingStart, rawStatus]
  );
}

export async function closeTestPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
