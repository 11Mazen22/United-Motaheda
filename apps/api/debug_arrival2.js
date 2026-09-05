const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

const ORDER_ID = '955b9eca-8a4b-4e59-b72e-ab65b6570955';
const DRIVER_USER_ID = 'b7e86437-b93b-4004-85bb-a08c28d3d272';

async function main() {
  await client.connect();
  await client.query('BEGIN');
  try {
    // Manually prepare an accepted assignment directly, bypassing driver_accept_assignment entirely.
    await client.query(
      `INSERT INTO public.delivery_assignments (order_id, driver_id, assigned_by, assignment_kind, response_status)
       VALUES ($1::uuid, $2::uuid, $2::uuid, 'assigned', 'accepted')
       RETURNING id`,
      [ORDER_ID, DRIVER_USER_ID],
    );
    const row = await client.query(
      "SELECT id FROM public.delivery_assignments WHERE order_id = $1 AND driver_id = $2 AND response_status = 'accepted' ORDER BY created_at DESC LIMIT 1",
      [ORDER_ID, DRIVER_USER_ID],
    );
    const assignmentId = row.rows[0].id;
    console.log('Fresh assignmentId:', assignmentId);

    // Need orders.status = 'ready' for the pharmacy-stage check inside mark_delivery_arrival.
    await client.query("UPDATE public.orders SET status = 'ready' WHERE id = $1", [ORDER_ID]);

    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = '" + DRIVER_USER_ID + "'");

    console.log('Calling mark_delivery_arrival directly, fresh session, no prior driver_accept_assignment call...');
    const res = await client.query(
      "SELECT * FROM mark_delivery_arrival($1::uuid, 'pharmacy'::text, 30.0::numeric, 31.3::numeric)",
      [assignmentId],
    );
    console.log('SUCCESS:', JSON.stringify(res.rows[0]));
  } catch (e) {
    console.log('ERROR:', e.message);
    console.log('detail:', e.detail);
    console.log('where:', e.where);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}

main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
