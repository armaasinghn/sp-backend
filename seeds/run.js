require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runSeeds() {
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`  → Seeding: ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await client.query(sql);
      console.log(`  ✅ Done: ${file}`);
    }
    console.log('\n✅ All seeds applied.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

runSeeds().catch(err => {
  console.error('Seed error:', err.message);
  process.exit(1);
});
