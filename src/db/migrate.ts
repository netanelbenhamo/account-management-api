import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Determine which env file to use
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: envFile });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database:
    process.env.NODE_ENV === 'test'
      ? `${process.env.DB_NAME}_test`
      : process.env.DB_NAME || 'account_management',
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const runMigrations = async (includeSeed = false): Promise<void> => {
  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT        NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Get already-applied migrations
    const { rows } = await client.query<{ filename: string }>(
      'SELECT filename FROM migrations'
    );
    const applied = new Set(rows.map((r) => r.filename));

    // Read and sort migration files (001, 002, 003...)
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql') && f !== 'seed.sql')
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭  Skipping (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    // Optionally run seed
    if (includeSeed) {
      const seedPath = path.join(MIGRATIONS_DIR, 'seed.sql');
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf-8');
        await client.query(seedSql);
        console.log('🌱 Seed applied');
      }
    }

    console.log('🎉 Migrations complete');
  } finally {
    client.release();
    await pool.end();
  }
};

// CLI: `ts-node src/db/migrate.ts [--seed]`
const includeSeed = process.argv.includes('--seed');
runMigrations(includeSeed).catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

export { runMigrations };