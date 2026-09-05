const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });
(async () => {
  await client.connect();
  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Branch' ORDER BY ordinal_position");
  console.log("=== Branch COLUMNS ===");
  console.log(JSON.stringify(cols.rows, null, 2));
  const branches = await client.query('SELECT * FROM public."Branch" ORDER BY id');
  console.log("=== Branch ROWS ===");
  console.log(JSON.stringify(branches.rows, null, 2));
  const zoneCount = await client.query('SELECT "branchId", count(*) FROM public."DeliveryZone" GROUP BY "branchId"');
  console.log("=== ZONE COUNTS PER BRANCH ===");
  console.log(JSON.stringify(zoneCount.rows, null, 2));
  await client.end();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
