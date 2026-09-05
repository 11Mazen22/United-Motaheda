const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false
});

async function run() {
  await client.connect();

  const res = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication_tables pt ON pt.tablename = c.relname AND pt.schemaname = n.nspname
    WHERE n.nspname = 'public' AND pt.pubname = 'supabase_realtime' AND c.relreplident != 'f'
    ORDER BY c.relname
  `);
  const tables = res.rows.map((r) => r.table_name);
  console.log(`Setting REPLICA IDENTITY FULL on ${tables.length} tables...`);

  for (const table of tables) {
    await client.query(`ALTER TABLE public."${table}" REPLICA IDENTITY FULL`);
    console.log(`  + ${table}`);
  }

  const verifyRes = await client.query(`
    SELECT count(*) FILTER (WHERE c.relreplident = 'f') AS full_count, count(*) AS total
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication_tables pt ON pt.tablename = c.relname AND pt.schemaname = n.nspname
    WHERE n.nspname = 'public' AND pt.pubname = 'supabase_realtime'
  `);
  console.log('\nVerification:', verifyRes.rows[0]);

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
