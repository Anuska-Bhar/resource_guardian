// src/ingest/load.ts
import 'dotenv/config';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { Pool } from 'pg';

const pool = new Pool(); // reads PG* env vars automatically

const monthMap: Record<string, string> = {
  January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
  July: '07', August: '08', September: '09', October: '10', November: '11', December: '12',
};

async function getOrCreateResource(name: string, pool_: string, cache: Map<string, number>) {
  const key = `${pool_}::${name}`;
  if (cache.has(key)) return cache.get(key)!;
  const { rows } = await pool.query(
    `INSERT INTO resources (name, pool) VALUES ($1,$2)
     ON CONFLICT (name, pool) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`,
    [name, pool_]
  );
  cache.set(key, rows[0].id);
  return rows[0].id;
}

async function main() {
  const resourceCache = new Map<string, number>();
  const parser = createReadStream('data/hotel_bookings.csv').pipe(
    parse({ columns: true, skip_empty_lines: true })
  );

  let batch: any[] = [];
  let count = 0;

  for await (const row of parser) {
    const resourceId = await getOrCreateResource(`Room Type ${row.reserved_room_type}`, row.hotel, resourceCache);
    const nights = Number(row.stays_in_weekend_nights) + Number(row.stays_in_week_nights);
    const bookedHours = nights * 24;
    const used = row.reservation_status === 'Check-Out' ? bookedHours : 0;
    const month = monthMap[row.arrival_date_month] ?? '01';
    const bookingStart = `${row.arrival_date_year}-${month}-${String(row.arrival_date_day_of_month).padStart(2, '0')}`;

    batch.push([resourceId, row.market_segment, bookedHours, used, bookingStart, row.reservation_status]);
    if (batch.length >= 500) {
      await flush(batch);
      count += batch.length;
      batch = [];
    }
  }
  if (batch.length) { await flush(batch); count += batch.length; }
  console.log(`Ingested ${count} reservations`);
  await pool.end();
}

async function flush(rows: any[]) {
  const values = rows.map((_, i) => `($${i*6+1},$${i*6+2},$${i*6+3},$${i*6+4},$${i*6+5},$${i*6+6})`).join(',');
  const flat = rows.flat();
  await pool.query(
    `INSERT INTO reservations (resource_id, team, booked_hours, actual_used_hours, booking_start, raw_status)
     VALUES ${values}`,
    flat
  );
}

main().catch(err => { console.error(err); process.exit(1); });