const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });
(async () => {
  await client.connect();
  const cols = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='DeliveryZone' ORDER BY ordinal_position");
  console.log("=== DeliveryZone COLUMNS ===");
  console.log(JSON.stringify(cols.rows, null, 2));
  const zones = await client.query('SELECT id, "branchId", name, "baseFee", polygon FROM public."DeliveryZone" WHERE "branchId" = $1 ORDER BY "baseFee"', ['masakin-dhabbat']);
  console.log("=== masakin-dhabbat ZONES ===");
  for (const z of zones.rows) {
    console.log(z.id, z.name, z.baseFee, JSON.stringify(z.polygon).slice(0, 300));
  }
  await client.end();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
