const { Client } = require('pg');
const fs = require('fs');
const c = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });
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
