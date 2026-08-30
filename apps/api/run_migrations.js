const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });

async function run() {
  await client.connect();
  const files = [
    'I:/United-Motaheda/supabase/migrations/20260830123000_hardened_return_system.sql',
    'I:/United-Motaheda/supabase/migrations/20260830123500_return_eligibility_rpc.sql',
    'I:/United-Motaheda/supabase/migrations/20260830124000_transition_return_status_rpc.sql'
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
