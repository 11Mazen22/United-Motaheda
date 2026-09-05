const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabase = createClient(
  'https://envoy-production-1cbe.up.railway.app',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODgwMDY4NTMsImV4cCI6MjEwMzM2Njg1M30.LWsgSb-zSn8Z5GOLCwfFHjsBUXSwXFrz4enKYJGMxbM',
);

const pg = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false,
});

async function run() {
  await pg.connect();

  let received = null;
  const channel = supabase
    .channel('smoke-test-favorites')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'favorites' },
      (payload) => { received = payload; },
    )
    .subscribe((status) => console.log('[client] channel status:', status));

  // Wait for the channel to actually join before writing.
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Grab a real customer id + product id to satisfy FKs.
  const userRes = await pg.query(`SELECT id FROM auth.users LIMIT 1`);
  const productRes = await pg.query(`SELECT id FROM public.products LIMIT 1`);
  const userId = userRes.rows[0].id;
  const productId = productRes.rows[0].id;

  console.log('[server] inserting test row into favorites...');
  await pg.query(`DELETE FROM public.favorites WHERE user_id = $1 AND product_id = $2`, [userId, productId]);
  await pg.query(
    `INSERT INTO public.favorites (user_id, product_id) VALUES ($1, $2)`,
    [userId, productId],
  );

  await new Promise((resolve) => setTimeout(resolve, 4000));

  if (received) {
    console.log('SUCCESS: realtime event received:', JSON.stringify(received.new));
  } else {
    console.log('FAILURE: no realtime event received within timeout');
  }

  // Cleanup.
  await pg.query(`DELETE FROM public.favorites WHERE user_id = $1 AND product_id = $2`, [userId, productId]);
  await channel.unsubscribe();
  await pg.end();
  process.exit(received ? 0 : 1);
}
run().catch((e) => { console.error(e); process.exit(1); });
