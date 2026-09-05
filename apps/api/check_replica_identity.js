const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false
});

async function run() {
  await client.connect();

  const res = await client.query(`
    SELECT c.relname AS table_name,
           CASE c.relreplident
             WHEN 'd' THEN 'default (PK only)'
             WHEN 'n' THEN 'nothing'
             WHEN 'f' THEN 'full'
             WHEN 'i' THEN 'index'
           END AS replica_identity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication_tables pt ON pt.tablename = c.relname AND pt.schemaname = n.nspname
    WHERE n.nspname = 'public' AND pt.pubname = 'supabase_realtime'
    ORDER BY c.relreplident, c.relname
  `);
  const counts = { 'default (PK only)': 0, 'full': 0, other: 0 };
  for (const row of res.rows) {
    if (row.replica_identity === 'full') counts.full++;
    else if (row.replica_identity === 'default (PK only)') counts['default (PK only)']++;
    else counts.other++;
  }
  console.log('Replica identity summary:', counts);
  console.log('\nTables NOT set to FULL (UPDATE/DELETE payloads will only include the primary key for old-row data):');
  console.log(res.rows.filter(r => r.replica_identity !== 'full').map(r => r.table_name).join(', '));

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
