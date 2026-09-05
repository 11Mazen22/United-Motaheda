const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

const ORDER_ID = '955b9eca-8a4b-4e59-b72e-ab65b6570955';
const PHARMACIST_ID = '8d0e7632-80c1-4cf8-9729-f82923c14f59';
const ADMIN_ID = 'df4c117e-38af-44a3-a227-77c883b74c10';
const DRIVER_USER_ID = 'b7e86437-b93b-4004-85bb-a08c28d3d272';

async function main() {
  await client.connect();
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = '" + PHARMACIST_ID + "'");
    await client.query("SELECT transition_order($1, 'verification')", [ORDER_ID]);
    await client.query("SELECT transition_order($1, 'payment_approved')", [ORDER_ID]);
    await client.query("SELECT transition_order($1, 'preparing')", [ORDER_ID]);
    await client.query("SELECT transition_order($1, 'ready')", [ORDER_ID]);

    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = '" + ADMIN_ID + "'");
    await client.query(
      `INSERT INTO public.delivery_assignments (order_id, driver_id, assigned_by, assignment_kind, response_status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'assigned', 'offered')`,
      [ORDER_ID, DRIVER_USER_ID, ADMIN_ID],
    );
    await client.query(
      "UPDATE public.orders SET assigned_driver_id = $2, status = 'driver_assigned' WHERE id = $1",
      [ORDER_ID, DRIVER_USER_ID],
    );

    const assignRow = await client.query(
      "SELECT id FROM public.delivery_assignments WHERE order_id = $1 AND response_status = 'offered' ORDER BY offered_at DESC LIMIT 1",
      [ORDER_ID],
    );
    const assignmentId = assignRow.rows[0].id;
    console.log('assignmentId type:', typeof assignmentId, 'value:', JSON.stringify(assignmentId));

    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = '" + DRIVER_USER_ID + "'");
    const acceptRes = await client.query('SELECT driver_accept_assignment($1) AS result', [assignmentId]);
    console.log('accept raw:', acceptRes.rows[0]);

    console.log('About to call mark_delivery_arrival with assignmentId:', JSON.stringify(assignmentId), typeof assignmentId);
    const arrivePharm = await client.query(
      "SELECT mark_delivery_arrival($1::uuid, $2::text, $3::numeric, $4::numeric) AS result",
      [assignmentId, 'pharmacy', 30.0, 31.3],
    );
    console.log('arrive pharmacy result:', arrivePharm.rows[0]);
  } catch (e) {
    console.log('ERROR:', e.message);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
