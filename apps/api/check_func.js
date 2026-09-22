
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = \'handle_new_user\'');
  console.log('Function definition:', res.rows[0]?.pg_get_functiondef);
  await client.end();
}
run();

