const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  const f = 'I:/United-Motaheda/supabase/migrations/20260830141500_cancellation_final_fixes.sql';
  console.log(`Executing ${f}...`);
  try {
    const sql = fs.readFileSync(f, 'utf8');
    await client.query(sql);
    console.log(`Success: ${f}`);
  } catch(e) {
    console.error(`Error in ${f}:`, e.message);
  }
  await client.end();
}
run();
