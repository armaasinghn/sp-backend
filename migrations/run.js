/**
 * Migration runner — executes SQL migration files in order
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = __dirname;
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1', [file]
      );
      if (rows.length > 0) {
        console.log(`  ✓ Already applied: ${file}`);
        continue;
      }

      console.log(`  → Applying: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)', [file]
        );
        await client.query('COMMIT');
        console.log(`  ✅ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Failed: ${file}`);
        throw err;
      }
    }
    console.log('\n✅ All migrations complete.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
