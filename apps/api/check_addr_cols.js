const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });
(async () => {
  await client.connect();
  const cols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='addresses' ORDER BY ordinal_position");
  console.log(cols.rows.map(r => r.column_name).join(', '));
  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
