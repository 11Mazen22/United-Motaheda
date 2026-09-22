const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function run() {
  await client.connect();

  const pubRes = await client.query(
    `SELECT pubname FROM pg_publication WHERE pubname = 'supabase_realtime'`
  );
  console.log('Publication exists:', pubRes.rows);

  const tablesRes = await client.query(
    `SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`
  );
  console.log('Tables currently in supabase_realtime publication:');
  console.log(tablesRes.rows.map(r => r.tablename).join(', '));

  const allTablesRes = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  console.log('\nAll public schema tables:');
  console.log(allTablesRes.rows.map(r => r.tablename).join(', '));

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
