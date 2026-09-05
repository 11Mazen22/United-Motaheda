const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

const ORDER_ID = '955b9eca-8a4b-4e59-b72e-ab65b6570955';
const PHARMACIST_ID = '8d0e7632-80c1-4cf8-9729-f82923c14f59';
const ADMIN_ID = 'df4c117e-38af-44a3-a227-77c883b74c10';
const DRIVER_USER_ID = 'b7e86437-b93b-4004-85bb-a08c28d3d272'; // edrakmaze@gmail.com

async function asRole(userId, fn) {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query("SET LOCAL request.jwt.claim.sub = '" + userId + "'");
  return fn();
}

async function main() {
  await client.connect();

  console.log('=== Step 0: order before ===');
  let o = await client.query('SELECT status, assigned_driver_id, branch_id FROM public.orders WHERE id = $1', [ORDER_ID]);
  console.log(JSON.stringify(o.rows[0]));

  await client.query('BEGIN');
  try {
    console.log('\n=== Pharmacist: pending -> verification ===');
    await asRole(PHARMACIST_ID, () => client.query("SELECT transition_order($1, 'verification')", [ORDER_ID]));
    console.log('OK');

    console.log('=== Pharmacist: verification -> payment_approved ===');
    await asRole(PHARMACIST_ID, () => client.query("SELECT transition_order($1, 'payment_approved')", [ORDER_ID]));
    console.log('OK');

    console.log('=== Pharmacist: payment_approved -> preparing ===');
    await asRole(PHARMACIST_ID, () => client.query("SELECT transition_order($1, 'preparing')", [ORDER_ID]));
    console.log('OK');

    console.log('=== Pharmacist: preparing -> ready ===');
    await asRole(PHARMACIST_ID, () => client.query("SELECT transition_order($1, 'ready')", [ORDER_ID]));
    console.log('OK');

    console.log('\n=== Admin: assign driver (real delivery_assignments ledger) ===');
    await asRole(ADMIN_ID, async () => {
      await client.query(
        "UPDATE public.delivery_assignments SET response_status = 'superseded', superseded_at = now() WHERE order_id = $1 AND response_status IN ('offered','accepted')",
        [ORDER_ID],
      );
      await client.query(
        `INSERT INTO public.delivery_assignments (order_id, driver_id, assigned_by, assignment_kind, response_status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'assigned', 'offered')`,
        [ORDER_ID, DRIVER_USER_ID, ADMIN_ID],
      );
      await client.query(
        "UPDATE public.orders SET assigned_driver_id = $2, status = 'driver_assigned', last_status_at = now(), updated_at = now() WHERE id = $1",
        [ORDER_ID, DRIVER_USER_ID],
      );
    });
    const assignRow = await client.query(
      "SELECT id FROM public.delivery_assignments WHERE order_id = $1 AND response_status = 'offered' ORDER BY offered_at DESC LIMIT 1",
      [ORDER_ID],
    );
    const assignmentId = assignRow.rows[0].id;
    console.log('assignment created:', assignmentId);

    console.log('\n=== Driver: accept assignment ===');
    const acceptRes = await asRole(DRIVER_USER_ID, () =>
      client.query('SELECT driver_accept_assignment($1) AS result', [assignmentId]));
    console.log(JSON.stringify(acceptRes.rows[0]));

    console.log('=== Driver: arrived at pharmacy ===');
    const arrivePharm = await asRole(DRIVER_USER_ID, () =>
      client.query("SELECT mark_delivery_arrival($1, 'pharmacy', 30.0, 31.3) AS result", [assignmentId]));
    console.log(JSON.stringify(arrivePharm.rows[0]));

    console.log('=== Driver: confirm pickup (out_for_delivery) ===');
    await asRole(DRIVER_USER_ID, () => client.query("SELECT transition_order($1, 'out_for_delivery')", [ORDER_ID]));
    console.log('OK');

    console.log('=== Driver: arrived at customer (real geofence check, exact stored coords) ===');
    const arriveCust = await asRole(DRIVER_USER_ID, () =>
      client.query("SELECT mark_delivery_arrival($1, 'customer', 30.026579, 31.408851) AS result", [assignmentId]));
    console.log(JSON.stringify(arriveCust.rows[0]));

    console.log('=== Driver: complete delivery ===');
    await asRole(DRIVER_USER_ID, () => client.query("SELECT transition_order($1, 'delivered')", [ORDER_ID]));
    console.log('OK');

    await client.query('COMMIT');
    console.log('\n=== COMMITTED — this is now a real, fully-delivered test order ===');
  } catch (e) {
    await client.query('ROLLBACK');
    console.log('\n!!! FAILED, rolled back:', e.message);
    throw e;
  }

  const final = await client.query(
    `SELECT o.status, o.assigned_driver_id,
            (SELECT count(*) FROM public."DriverEarning" de
               JOIN public."DriverProfile" dp ON dp.id = de."driverId"
              WHERE dp."userId" = $2) AS earning_rows_for_driver,
            (SELECT "totalEarnings" FROM public."DriverProfile" WHERE "userId" = $2) AS driver_total_earnings
     FROM public.orders o WHERE o.id = $1`,
    [ORDER_ID, DRIVER_USER_ID],
  );
  console.log('\n=== Final order + driver earnings state ===');
  console.log(JSON.stringify(final.rows[0], null, 2));

  await client.end();
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
