
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
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

