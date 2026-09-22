const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  await client.connect();
  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='addresses' ORDER BY ordinal_position");
  console.log(cols.rows.map(r => r.column_name).join(', '));
  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
