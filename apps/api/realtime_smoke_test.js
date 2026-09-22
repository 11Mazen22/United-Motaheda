const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const pg = new Client({
  connectionString: process.env.DATABASE_URL,
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
