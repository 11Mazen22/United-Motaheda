const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

(async () => {
  await client.connect();

  const fns = await client.query(`
    SELECT p.oid::regprocedure::text AS signature, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('execute_order_cancellation','get_order_actions','transition_order','driver_accept_assignment','driver_decline_assignment')
  `);
  console.log('=== matching function signatures ===');
  console.log(JSON.stringify(fns.rows, null, 2));

  for (const row of fns.rows) {
    const grants = await client.query(`
      SELECT rolname, has_function_privilege(rolname, $1, 'EXECUTE') AS can_execute
      FROM (VALUES ('anon'), ('authenticated'), ('public')) AS r(rolname)
    `, [row.signature]);
    console.log('--- ' + row.signature + ' ---');
    console.log(JSON.stringify(grants.rows));
  }

  await client.end();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
