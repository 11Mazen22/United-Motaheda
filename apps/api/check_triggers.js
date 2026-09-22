
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT event_object_table, trigger_name, action_statement FROM information_schema.triggers WHERE event_object_schema = \'auth\' AND event_object_table = \'users\'');
  console.log('Triggers:', res.rows);
  await client.end();
}
run();

