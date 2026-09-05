const { Client } = require('pg');
const CONNECTION_STRING = 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres';
const client = new Client({ connectionString: CONNECTION_STRING, ssl: false });

const ADMIN_ID = 'df4c117e-38af-44a3-a227-77c883b74c10';
const CUSTOMER_ID = '742ea034-3051-451e-a156-a871e56c357c';
const DRIVER_A = '17affa00-ee20-4f2e-bde9-5fa3ac76ecec';
const DRIVER_B = 'c9ca0ba9-f4c8-41a4-98ce-64b0394ccac2';
const DRIVER_C = 'b7e86437-b93b-4004-85bb-a08c28d3d272';

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { console.log(`  PASS: ${label}`); pass++; }
  else { console.log(`  FAIL: ${label}` + (detail ? ` -- ${detail}` : '')); fail++; }
}

async function asAdmin(fn) {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(`SET LOCAL request.jwt.claims = '{"sub":"${ADMIN_ID}","role":"authenticated"}'`);
  try { return await fn(); } finally { await client.query('COMMIT'); }
}
async function asDriver(driverId, fn) {
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(`SET LOCAL request.jwt.claims = '{"sub":"${driverId}","role":"authenticated"}'`);
  try { return await fn(); } catch (e) { return { error: e }; } finally { await client.query('COMMIT'); }
}

async function tick() {
  // Mirrors exactly what the cron schedule does: impersonate the real
  // admin so rank_available_drivers/transition_order's role checks pass.
  await client.query('BEGIN');
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(`SET LOCAL request.jwt.claims = '{"sub":"${ADMIN_ID}","role":"authenticated"}'`);
  await client.query('SELECT auto_dispatch_tick()');
  await client.query('COMMIT');
}

async function makeTestOrder() {
  const id = require('crypto').randomUUID();
  await client.query(`
    INSERT INTO orders (id, customer_name, customer_phone, customer_address, customer_lat, customer_lng,
      status, subtotal, shipping_fee, total, source, user_id, note, payment_method, payment_status,
      idempotency_key, branch_id, zone_id, zone_name, zone_base_fee, zone_surge_applied, delivery_distance_km)
    VALUES ($1, 'Dispatch Test', '01000000000', '{"formatted":"test"}'::jsonb, 30.0797, 31.3234,
      'ready', 51.00, 25.00, 76.00, 'supabase', $2, 'dispatch verification', 'cod', 'pending',
      $3, 'gardenia', 'ismailia-14-zone-8km', 'Zone C', 25.00, false, 7.0)
  `, [id, CUSTOMER_ID, require('crypto').randomUUID()]);
  return id;
}

async function orderState(id) {
  const r = await client.query(
    `SELECT status, dispatch_status, assigned_driver_id FROM orders WHERE id = $1`, [id]);
  return r.rows[0];
}
async function assignmentState(id) {
  const r = await client.query(
    `SELECT id, driver_id, response_status, assignment_kind, expires_at FROM delivery_assignments
     WHERE order_id = $1 ORDER BY created_at DESC`, [id]);
  return r.rows;
}

async function run() {
  await client.connect();

  // ===== Test 1: basic waterfall offer =====
  console.log('\n=== Test 1: fresh ready order gets auto-offered ===');
  let orderId = await makeTestOrder();
  await tick();
  let state = await orderState(orderId);
  let assignments = await assignmentState(orderId);
  check('dispatch_status is searching', state.dispatch_status === 'searching', state.dispatch_status);
  check('assigned_driver_id is set', !!state.assigned_driver_id, state.assigned_driver_id);
  check('order status advanced to driver_assigned', (await client.query('SELECT status FROM orders WHERE id=$1',[orderId])).rows[0].status === 'driver_assigned');
  check('exactly one offered assignment', assignments.filter(a => a.response_status === 'offered').length === 1, JSON.stringify(assignments));
  const firstOfferedDriver = state.assigned_driver_id;
  const firstAssignmentId = assignments[0].id;

  // ===== Test 2: late acceptance must fail =====
  console.log('\n=== Test 2: late acceptance (expired offer) must fail ===');
  await client.query(`UPDATE delivery_assignments SET expires_at = now() - interval '1 second' WHERE id = $1`, [firstAssignmentId]);
  const lateAccept = await asDriver(firstOfferedDriver, () => client.query('SELECT driver_accept_assignment($1)', [firstAssignmentId]));
  check('late accept raises an error', !!lateAccept.error, lateAccept.error ? lateAccept.error.message : 'no error raised');

  // ===== Test 3: double-tick concurrency =====
  console.log('\n=== Test 3: double tick is concurrency-safe ===');
  orderId = await makeTestOrder();
  // Two separate connections for genuine concurrency, both impersonating
  // the same admin the cron schedule uses.
  const clientB = new Client({ connectionString: CONNECTION_STRING, ssl: false });
  await clientB.connect();
  async function tickOn(c) {
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE authenticated');
    await c.query(`SET LOCAL request.jwt.claims = '{"sub":"${ADMIN_ID}","role":"authenticated"}'`);
    await c.query('SELECT auto_dispatch_tick()');
    await c.query('COMMIT');
  }
  await Promise.all([tickOn(client), tickOn(clientB)]);
  await clientB.end();
  const offeredRows = await client.query(`SELECT count(*) FROM delivery_assignments WHERE order_id=$1 AND response_status='offered'`, [orderId]);
  check('exactly one offered row after concurrent ticks', offeredRows.rows[0].count === '1', offeredRows.rows[0].count);

  // ===== Test 4: manual assignment CAN be accepted =====
  console.log('\n=== Test 4: manual assignment can be accepted (the bug this revision fixed) ===');
  orderId = await makeTestOrder();
  await asAdmin(() => client.query('SELECT manual_assign_driver($1, $2)', [orderId, DRIVER_A]));
  state = await orderState(orderId);
  check('manual assign sets dispatch_status=assigned', state.dispatch_status === 'assigned', state.dispatch_status);
  assignments = await assignmentState(orderId);
  const manualAssignment = assignments[0];
  check('manual assignment is offered, kind=assigned', manualAssignment.response_status === 'offered' && manualAssignment.assignment_kind === 'assigned');
  const acceptResult = await asDriver(DRIVER_A, () => client.query('SELECT driver_accept_assignment($1)', [manualAssignment.id]));
  check('manual assignment accept succeeds', !acceptResult.error, acceptResult.error ? acceptResult.error.message : '');
  state = await orderState(orderId);
  check('after accept: dispatch_status=assigned', state.dispatch_status === 'assigned');
  check('after accept: order status=driver_accepted', (await client.query('SELECT status FROM orders WHERE id=$1',[orderId])).rows[0].status === 'driver_accepted');

  // ===== Test 5: manual assignment decline recovers automatically =====
  console.log('\n=== Test 5: manual assignment decline hands back to auto-waterfall ===');
  orderId = await makeTestOrder();
  await asAdmin(() => client.query('SELECT manual_assign_driver($1, $2)', [orderId, DRIVER_A]));
  assignments = await assignmentState(orderId);
  const declineResult = await asDriver(DRIVER_A, () => client.query('SELECT driver_decline_assignment($1, $2)', [assignments[0].id, 'test decline']));
  check('manual decline succeeds', !declineResult.error, declineResult.error ? declineResult.error.message : '');
  state = await orderState(orderId);
  check('after decline: dispatch_status=idle', state.dispatch_status === 'idle', state.dispatch_status);
  check('after decline: assigned_driver_id cleared', state.assigned_driver_id === null);
  check('after decline: order status back to ready', (await client.query('SELECT status FROM orders WHERE id=$1',[orderId])).rows[0].status === 'ready');
  await tick();
  state = await orderState(orderId);
  check('next tick auto-resumes waterfall (searching again)', state.dispatch_status === 'searching', state.dispatch_status);

  // ===== Test 6: override vs stale offer =====
  console.log('\n=== Test 6: manual override supersedes stale auto-offer; old driver cannot mutate ===');
  orderId = await makeTestOrder();
  await tick();
  state = await orderState(orderId);
  const driverA = state.assigned_driver_id; // whoever the waterfall picked first
  const oldAssignments = await assignmentState(orderId);
  const oldAssignmentId = oldAssignments[0].id;
  const otherDriver = driverA === DRIVER_A ? DRIVER_B : DRIVER_A;

  await asAdmin(() => client.query('SELECT manual_assign_driver($1, $2)', [orderId, otherDriver]));
  const postOverride = await assignmentState(orderId);
  const oldRow = postOverride.find(a => a.id === oldAssignmentId);
  const newRow = postOverride.find(a => a.driver_id === otherDriver && a.response_status === 'offered');
  check('old auto-offer is superseded', oldRow.response_status === 'superseded', oldRow.response_status);
  check('new manual offer is offered', !!newRow);
  state = await orderState(orderId);
  check('order now points at the manually-assigned driver', state.assigned_driver_id === otherDriver);
  check('dispatch_status=assigned after override', state.dispatch_status === 'assigned');

  const staleAccept = await asDriver(driverA, () => client.query('SELECT driver_accept_assignment($1)', [oldAssignmentId]));
  check('old driver cannot accept the superseded offer', !!staleAccept.error, staleAccept.error ? staleAccept.error.message : 'accepted! BUG');

  // Fresh replay for decline (need a new order since the previous one's old assignment already errored, not mutated)
  orderId = await makeTestOrder();
  await tick();
  state = await orderState(orderId);
  const driverA2 = state.assigned_driver_id;
  const oldAssignments2 = await assignmentState(orderId);
  const oldAssignmentId2 = oldAssignments2[0].id;
  const otherDriver2 = driverA2 === DRIVER_A ? DRIVER_C : DRIVER_A;
  await asAdmin(() => client.query('SELECT manual_assign_driver($1, $2)', [orderId, otherDriver2]));

  const staleDecline = await asDriver(driverA2, () => client.query('SELECT driver_decline_assignment($1, $2)', [oldAssignmentId2, 'stale decline']));
  check('old driver decline on superseded offer is a no-op (no error)', !staleDecline.error, staleDecline.error ? staleDecline.error.message : '');
  state = await orderState(orderId);
  check('order still points at the manually-assigned driver after stale decline', state.assigned_driver_id === otherDriver2, state.assigned_driver_id);
  check('dispatch_status still assigned after stale decline', state.dispatch_status === 'assigned', state.dispatch_status);

  // ===== Test 7: escalation actually fires =====
  console.log('\n=== Test 7: escalation fires when no candidates remain ===');
  orderId = await makeTestOrder();
  // Exhaust all 3 real online drivers by pre-seeding declined history for this order.
  for (const d of [DRIVER_A, DRIVER_B, DRIVER_C]) {
    await client.query(
      `INSERT INTO delivery_assignments (order_id, driver_id, assignment_kind, response_status, responded_at)
       VALUES ($1, $2, 'assigned', 'declined', now())`, [orderId, d]);
  }
  const notifBefore = await client.query(`SELECT count(*) FROM notification_outbox WHERE payload->'data'->>'orderId' = $1`, [orderId]);
  await tick();
  state = await orderState(orderId);
  check('order escalated', state.dispatch_status === 'escalated', state.dispatch_status);
  const notifAfter = await client.query(`SELECT count(*) FROM notification_outbox WHERE payload->'data'->>'orderId' = $1`, [orderId]);
  check('admin notifications enqueued (4 admins)', Number(notifAfter.rows[0].count) - Number(notifBefore.rows[0].count) === 4, notifAfter.rows[0].count);
  // Second tick should NOT re-notify (transition-gated).
  await tick();
  const notifAfter2 = await client.query(`SELECT count(*) FROM notification_outbox WHERE payload->'data'->>'orderId' = $1`, [orderId]);
  check('repeat tick does not re-notify (transition-gated)', notifAfter2.rows[0].count === notifAfter.rows[0].count, `${notifAfter.rows[0].count} -> ${notifAfter2.rows[0].count}`);

  console.log(`\n\n${pass} passed, ${fail} failed`);
  await client.end();
  process.exit(fail > 0 ? 1 : 0);
}
run().catch((e) => { console.error('FATAL:', e); process.exit(1); });
