import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://fixrelay:fixrelay_dev_only@127.0.0.1:5433/fixrelay';

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.PG_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  ...(process.env.PGSSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
  application_name: 'fixrelay-api',
});

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export async function initializeDatabase(): Promise<void> {
  const schemaPath = resolve(process.cwd(), 'backend/src/db/schema.sql');
  const schema = await readFile(schemaPath, 'utf8');
  await pool.query(schema);
  const { rows } = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM devices');
  if (Number(rows[0]?.count ?? 0) === 0) await seedDemoData();
}

async function seedDemoData(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const now = new Date().toISOString();
    const devices = [
      ['demo-pureair-450', 'PureAir 450', 'AeroHome (fictional demo brand)', 'Air purifier', 'PA-450', 'DEMO-PA450-2084', '2026-02-11', 24, 'Living room', 'Needs attention'],
      ['demo-cleanbot-s7', 'CleanBot S7', 'Nestwell (fictional demo brand)', 'Robot vacuum', 'CB-S7', 'DEMO-CBS7-5520', '2025-11-03', 24, 'Hallway', 'Operational'],
      ['demo-brewsmart-4', 'BrewSmart 4', 'DailyCup (fictional demo brand)', 'Coffee maker', 'BC-4', 'DEMO-BC4-4418', '2025-05-19', 12, 'Kitchen', 'Operational'],
      ['demo-heatmate-k2', 'HeatMate K2', 'WarmLoop (fictional demo brand)', 'Electric kettle', 'HM-K2', 'DEMO-HMK2-9831', '2024-12-08', 12, 'Kitchen', 'Operational'],
    ];
    for (const d of devices) {
      await client.query(
        `INSERT INTO devices (id,name,brand,category,model,serial_number,purchase_date,warranty_months,room,condition,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`, [...d, now],
      );
    }
    const manuals = [
      ['demo-manual-pa-noise', 'demo-pureair-450', 'PureAir 450 · Safety and noise checks', 'Section 7 · Unusual noise', 'If the unit makes a grinding noise, shows abnormal vibration, or emits a burning smell, switch it off and disconnect it from power if safe. Do not open the motor housing. Check only accessible exterior intake areas and filter seating. If noise continues, request qualified service.', 'FixRelay synthetic reference · PA-450', 'Synthetic demonstration excerpt; not a real manufacturer manual. Verify against the actual product documentation before acting.', 'high', 'grinding noise vibration burning motor noise safety unplug filter'],
      ['demo-manual-pa-filter', 'demo-pureair-450', 'PureAir 450 · Filter maintenance', 'Section 4 · Filter seating', 'With the device powered off and unplugged, confirm the filter panel is closed and the filter is seated flat. Do not operate the unit with the panel removed.', 'FixRelay synthetic reference · PA-450', 'Synthetic demonstration excerpt; not a real manufacturer manual.', 'medium', 'filter panel filter seating maintenance air intake'],
      ['demo-manual-cb-brush', 'demo-cleanbot-s7', 'CleanBot S7 · Brush maintenance', 'Section 5 · Brush warning', 'Pause cleaning before inspecting the brush area. Keep fingers clear of moving parts and disconnect charging power before removing trapped material. If a motor warning persists, contact qualified service.', 'FixRelay synthetic reference · CB-S7', 'Synthetic demonstration excerpt; not a real manufacturer manual.', 'high', 'robot vacuum brush motor warning stuck hair jam'],
      ['demo-manual-bc-descale', 'demo-brewsmart-4', 'BrewSmart 4 · Cleaning and descaling', 'Section 6 · Cleaning', 'Allow the brewer to cool fully and unplug it before cleaning exterior surfaces. Use only the descaling method specified by the product’s actual manufacturer documentation.', 'FixRelay synthetic reference · BC-4', 'Synthetic demonstration excerpt; not a real manufacturer manual.', 'medium', 'coffee maker cleaning descaling water leak'],
      ['demo-manual-hm-heat', 'demo-heatmate-k2', 'HeatMate K2 · Electrical safety', 'Section 2 · Safe operation', 'Stop using the kettle if the cord, plug, base, or housing is damaged. Do not immerse electrical components in water. Contact qualified service when an electrical fault is suspected.', 'FixRelay synthetic reference · HM-K2', 'Synthetic demonstration excerpt; not a real manufacturer manual.', 'high', 'kettle electrical fault plug cord damaged overheating'],
    ];
    for (const m of manuals) {
      await client.query(
        `INSERT INTO manuals (id,device_id,title,section,excerpt,source_label,source_note,safety_level,keywords,created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`, [...m, now],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
