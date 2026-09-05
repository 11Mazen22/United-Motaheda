const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.gntpxffonjvnvadjclpl:11%E2%80%98%D9%89%D9%87%D9%81%D8%AB%D9%8A22%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  for (const table of ['inventory_state', 'products', 'product_reviews']) {
    const rls = await client.query(
      `SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass`, [`public.${table}`],
    );
    console.log(`\n=== ${table} (RLS enabled: ${rls.rows[0].relrowsecurity}) ===`);
    const policies = await client.query(
      `SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename=$1`,
      [table],
    );
    console.log(policies.rows);
  }

  // Also check the view owner and whether it has BYPASSRLS -- this is what
  // actually makes SECURITY DEFINER-style views dangerous in the first place.
  const ownerRes = await client.query(`
    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c WHERE c.relname IN ('available_inventory', 'product_review_stats')
  `);
  console.log('\nView owners:', ownerRes.rows);
  for (const row of ownerRes.rows) {
    const roleRes = await client.query(
      `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = $1`, [row.owner],
    );
    console.log(`Role ${row.owner}:`, roleRes.rows[0]);
  }

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
