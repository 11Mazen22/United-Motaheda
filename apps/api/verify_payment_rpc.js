const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

async function main() {
  await client.connect();

  const pharmacist = await client.query("SELECT id FROM public.profiles WHERE role = 'pharmacist' LIMIT 1");
  const order = await client.query("SELECT id, payment_status FROM public.orders ORDER BY created_at DESC LIMIT 1");

  console.log('pharmacist found:', JSON.stringify(pharmacist.rows));
  console.log('test order:', JSON.stringify(order.rows));

  if (pharmacist.rows.length && order.rows.length) {
    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE authenticated');
      await client.query("SET LOCAL request.jwt.claim.sub = '" + pharmacist.rows[0].id + "'");
      const res = await client.query(
        "SELECT public.admin_review_payment($1::uuid, 'verified', NULL) AS result",
        [order.rows[0].id]
      );
      console.log('Pharmacist verify-payment SUCCESS:', JSON.stringify(res.rows[0].result));
    } catch (e) {
      console.log('Pharmacist verify-payment ERRORED:', e.message);
    } finally {
      await client.query('ROLLBACK');
    }
  }

  // Anonymous should be rejected
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE anon');
    await client.query("SELECT public.admin_review_payment($1::uuid, 'verified', NULL) AS result", [order.rows[0].id]);
    console.log('!!! anon was NOT rejected — bug');
  } catch (e) {
    console.log('anon correctly rejected:', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  // A random authenticated non-staff customer should be rejected
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = 'd0ee96bf-55c5-4cdf-8734-9c25b8a23208'"); // a real customer, not staff
    await client.query("SELECT public.admin_review_payment($1::uuid, 'verified', NULL) AS result", [order.rows[0].id]);
    console.log('!!! customer was NOT rejected — bug');
  } catch (e) {
    console.log('customer correctly rejected:', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
