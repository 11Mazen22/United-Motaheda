const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

async function main() {
  await client.connect();

  console.log('=== 1. anon EXECUTE privileges (should ALL be false now) ===');
  const grants = await client.query(`
    SELECT p.oid::regprocedure::text AS signature,
           has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('execute_order_cancellation','get_order_actions','transition_order','admin_transition_order')
  `);
  console.log(JSON.stringify(grants.rows, null, 2));

  console.log('\n=== 2. REAL authenticated customer cancelling their OWN order (must SUCCEED) ===');
  // e934b309-f863-4d8c-9c4b-3b6fffc7cfcb belongs to user d0ee96bf-55c5-4cdf-8734-9c25b8a23208 (confirmed earlier)
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL ROLE authenticated");
    await client.query("SET LOCAL request.jwt.claim.sub = 'd0ee96bf-55c5-4cdf-8734-9c25b8a23208'");
    const res = await client.query(
      "SELECT public.execute_order_cancellation($1::uuid, $2, $3, $4) AS result",
      ['e934b309-f863-4d8c-9c4b-3b6fffc7cfcb', 'CHANGED_MIND', 'real customer cancel simulation', 'real-cust-' + Date.now()]
    );
    console.log('SUCCESS:', JSON.stringify(res.rows[0].result));
    const order = await client.query("SELECT status, cancellation_reason, cancelled_by, cancelled_at FROM public.orders WHERE id = $1", ['e934b309-f863-4d8c-9c4b-3b6fffc7cfcb']);
    console.log('order row (uncommitted):', JSON.stringify(order.rows));
  } catch (e) {
    console.log('!!! UNEXPECTEDLY ERRORED:', e.message);
  } finally {
    await client.query('ROLLBACK');
    console.log('Rolled back — no real data changed.');
  }

  console.log('\n=== 3. A DIFFERENT authenticated customer trying to cancel a stranger order (must be REJECTED) ===');
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL ROLE authenticated");
    await client.query("SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111'"); // not the owner
    await client.query(
      "SELECT public.execute_order_cancellation($1::uuid, $2, $3, $4) AS result",
      ['e934b309-f863-4d8c-9c4b-3b6fffc7cfcb', 'OTHER', 'attacker with real login trying to cancel a stranger order', 'attacker-' + Date.now()]
    );
    console.log('!!! DID NOT REJECT — cross-user bug still present');
  } catch (e) {
    console.log('Correctly rejected:', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  console.log('\n=== 4. Anonymous (no JWT at all) call via anon role (must be REJECTED at the GRANT level now, not just in-function) ===');
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE anon');
    await client.query(
      "SELECT public.execute_order_cancellation($1::uuid, $2, $3, $4) AS result",
      ['afbfde67-c00f-4cc2-ba7c-694d032718b5', 'OTHER', 'anon attack simulation v2', 'attack2-' + Date.now()]
    );
    console.log('!!! DID NOT REJECT — SECURITY BUG STILL PRESENT');
  } catch (e) {
    console.log('Correctly rejected:', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  console.log('\n=== 5. admin_transition_order(cancelled) as a real staff user (must SUCCEED with full side effects) ===');
  const staff = await client.query("SELECT id FROM public.profiles WHERE role IN ('admin','manager') LIMIT 1");
  const candidates = await client.query(`
    SELECT id FROM public.orders
    WHERE status IN ('pending','verification','payment_pending','payment_approved','preparing','ready','driver_assigned','driver_accepted')
    ORDER BY created_at DESC LIMIT 1
  `);
  if (staff.rows.length > 0 && candidates.rows.length > 0) {
    await client.query('BEGIN');
    try {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query("SET LOCAL request.jwt.claim.sub = '" + staff.rows[0].id + "'");
      const res = await client.query("SELECT public.admin_transition_order($1::uuid, 'cancelled') AS result", [candidates.rows[0].id]);
      console.log('SUCCESS:', JSON.stringify(res.rows[0].result));
    } catch (e) {
      console.log('!!! UNEXPECTEDLY ERRORED:', e.message);
    } finally {
      await client.query('ROLLBACK');
      console.log('Rolled back — no real data changed.');
    }
  } else {
    console.log('No staff profile or candidate order found to test with.');
  }

  await client.end();
}

main().catch(e => { console.error('FATAL ERROR:', e.message); process.exit(1); });
