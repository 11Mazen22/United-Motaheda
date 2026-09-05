const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });
(async () => {
  await client.connect();
  const buckets = await client.query("SELECT id, name, public FROM storage.buckets ORDER BY id");
  console.log("=== BUCKETS ===");
  console.log(JSON.stringify(buckets.rows, null, 2));
  const migs = await client.query("SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260817000000' ORDER BY version");
  console.log("=== APPLIED MIGRATIONS SINCE 2026-08-17 ===");
  console.log(JSON.stringify(migs.rows.map(r => r.version), null, 2));
  await client.end();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
