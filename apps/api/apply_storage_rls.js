const { Client } = require('pg');
const fs = require('fs');
const c = new Client({ connectionString: process.env.DATABASE_URL });
async function run() {
  await c.connect();
  const sql = fs.readFileSync('I:/United-Motaheda/supabase/migrations/20260830150000_fix_prescriptions_storage_rls.sql', 'utf8');
  try {
    await c.query(sql);
    console.log('Storage RLS policies applied successfully!');
    const check = await c.query(`SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' ORDER BY policyname`);
    console.log('Active policies:', JSON.stringify(check.rows, null, 2));
  } catch(e) {
    console.error('Error:', e.message);
  }
  await c.end();
}
run();
