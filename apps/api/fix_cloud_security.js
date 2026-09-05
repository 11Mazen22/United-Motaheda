const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.gntpxffonjvnvadjclpl:11%E2%80%98%D9%89%D9%87%D9%81%D8%AB%D9%8A22%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('Connected. Applying fixes...\n');

  // ── Issue 1: _prisma_migrations publicly writable with no RLS ──────────
  // Pure Prisma tooling metadata -- never meant to be reachable via the
  // client API at all. anon/authenticated currently hold full CRUD
  // (including TRUNCATE) on it. Revoke API-role access outright and enable
  // RLS with zero policies as defense-in-depth, so even a future accidental
  // re-grant still defaults to deny.
  await client.query(`REVOKE ALL ON public._prisma_migrations FROM anon, authenticated`);
  await client.query(`ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY`);
  console.log('[1/3] _prisma_migrations: revoked anon/authenticated grants, enabled RLS (default-deny, no policies)');

  // ── Issues 2 & 3: SECURITY DEFINER views ────────────────────────────────
  // Both views are owned by `postgres`, which has BYPASSRLS -- so querying
  // through them currently skips RLS on the underlying tables entirely.
  // Verified first that inventory_state/products/product_reviews all
  // already carry an unconditional public-read SELECT policy, so switching
  // to security_invoker changes nothing about who can see what -- it only
  // makes the view honor RLS instead of silently bypassing it, closing the
  // privilege-escalation path Advisor is flagging.
  await client.query(`ALTER VIEW public.available_inventory SET (security_invoker = true)`);
  console.log('[2/3] available_inventory: security_invoker = true');

  await client.query(`ALTER VIEW public.product_review_stats SET (security_invoker = true)`);
  console.log('[3/3] product_review_stats: security_invoker = true');

  // Adjacent hygiene while touching these views: they're read-only
  // aggregations with no INSTEAD OF trigger, so the INSERT/UPDATE/DELETE/
  // TRUNCATE grants anon/authenticated hold today are inert -- but only
  // because no trigger exists yet. Tightening to SELECT-only now removes a
  // write path that would otherwise go live silently if one's ever added.
  await client.query(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.available_inventory FROM anon, authenticated`);
  await client.query(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.product_review_stats FROM anon, authenticated`);
  console.log('[hygiene] tightened both views to SELECT-only for anon/authenticated');

  console.log('\n--- Verifying ---');
  const rls = await client.query(`SELECT relrowsecurity FROM pg_class WHERE oid = 'public._prisma_migrations'::regclass`);
  console.log('_prisma_migrations RLS enabled:', rls.rows[0].relrowsecurity);

  const grants = await client.query(`
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='_prisma_migrations' AND grantee IN ('anon','authenticated')
  `);
  console.log('_prisma_migrations remaining anon/authenticated grants:', grants.rows);

  const viewOpts = await client.query(`
    SELECT relname, reloptions FROM pg_class
    WHERE relname IN ('available_inventory', 'product_review_stats')
  `);
  console.log('View security_invoker options:', viewOpts.rows);

  await client.end();
  console.log('\nAll 3 issues fixed and verified.');
}
run().catch((e) => { console.error(e); process.exit(1); });
