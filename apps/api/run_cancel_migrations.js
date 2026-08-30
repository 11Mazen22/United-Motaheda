const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });

async function run() {
  await client.connect();
  const files = [
    'I:/United-Motaheda/supabase/migrations/20260830130000_cancellation_system_hardened.sql',
    'I:/United-Motaheda/supabase/migrations/20260830130500_execute_cancellation_rpc.sql'
  ];
  
  for (const f of files) {
    console.log(`Executing ${f}...`);
    try {
      const sql = fs.readFileSync(f, 'utf8');
      await client.query(sql);
      console.log(`Success: ${f}`);
    } catch(e) {
      console.error(`Error in ${f}:`, e.message);
    }
  }
  await client.end();
}
run();
