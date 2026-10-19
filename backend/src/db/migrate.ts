import 'dotenv/config';
import { initializeDatabase, pool } from './pool.js';

try {
  await initializeDatabase();
  console.log('FixRelay database schema is up to date and demo data is present if the inventory was empty.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database migration failed.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
