
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = \'handle_new_user\'');
  console.log('Function definition:', res.rows[0]?.pg_get_functiondef);
  await client.end();
}
run();

