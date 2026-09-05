const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.gntpxffonjvnvadjclpl:11%E2%80%98%D9%89%D9%87%D9%81%D8%AB%D9%8A22%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected to Motahheda Pharmacy cloud project.\n');

  const rls = await client.query(`
    SELECT relrowsecurity, relforcerowsecurity
    FROM pg_class WHERE oid = 'public._prisma_migrations'::regclass
  `);
  console.log('_prisma_migrations RLS status:', rls.rows[0]);

  const anonGrants = await client.query(`
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='_prisma_migrations'
    ORDER BY grantee, privilege_type
  `);
  console.log('_prisma_migrations grants:', anonGrants.rows);

  console.log('\n--- available_inventory ---');
  const view1def = await client.query(`SELECT pg_get_viewdef('public.available_inventory'::regclass, true) AS def`);
  console.log(view1def.rows[0].def);
  const view1sec = await client.query(`
    SELECT c.relname, c.reloptions FROM pg_class c
    WHERE c.oid = 'public.available_inventory'::regclass
  `);
  console.log('reloptions (security_invoker lives here if set):', view1sec.rows[0]);

  console.log('\n--- product_review_stats ---');
  const view2def = await client.query(`SELECT pg_get_viewdef('public.product_review_stats'::regclass, true) AS def`);
  console.log(view2def.rows[0].def);
  const view2sec = await client.query(`
    SELECT c.relname, c.reloptions FROM pg_class c
    WHERE c.oid = 'public.product_review_stats'::regclass
  `);
  console.log('reloptions:', view2sec.rows[0]);

  // What grants exist on these views for anon/authenticated -- tells us who's meant to read them.
  const viewGrants = await client.query(`
    SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name IN ('available_inventory','product_review_stats')
    ORDER BY table_name, grantee
  `);
  console.log('\nView grants:', viewGrants.rows);

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
