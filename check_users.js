
const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false
});

async function run() {
  await client.connect();
  let res = await client.query('SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5');
  console.log('Recent auth.users:', res.rows);
  
  res = await client.query('SELECT * FROM public.profiles ORDER BY created_at DESC LIMIT 5');
  console.log('Recent public.profiles:', res.rows);

  await client.end();
}
run();

