const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
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
