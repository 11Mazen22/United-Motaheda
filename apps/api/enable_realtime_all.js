const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false
});

// Prisma's own migration ledger -- not application data, never meaningful to broadcast.
const EXCLUDE = new Set(['_prisma_migrations']);

async function run() {
  await client.connect();

  const existingRes = await client.query(
    `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'`
  );
  const existing = new Set(existingRes.rows.map((r) => r.tablename));

  const allRes = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const all = allRes.rows.map((r) => r.tablename);

  const toAdd = all.filter((t) => !existing.has(t) && !EXCLUDE.has(t));

  console.log(`Already enabled: ${existing.size} tables`);
  console.log(`Adding: ${toAdd.length} tables`);
  console.log(toAdd.join(', '));

  for (const table of toAdd) {
    await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE public."${table}"`);
    console.log(`  + ${table}`);
  }

  const finalRes = await client.query(
    `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename`
  );
  console.log(`\nFinal publication membership: ${finalRes.rows.length} tables`);

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
