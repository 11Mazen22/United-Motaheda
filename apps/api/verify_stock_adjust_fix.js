const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

async function main() {
  await client.connect();

  const admin = await client.query("SELECT id FROM public.profiles WHERE role IN ('admin','manager') LIMIT 1");
  const product = await client.query('SELECT id, "Stock" FROM public.products LIMIT 1');
  const adminId = admin.rows[0].id;
  const productId = product.rows[0].id;
  const currentStock = Number(product.rows[0].Stock ?? 0);
  const desiredStock = currentStock + 7; // simulate admin typing a +7 correction

  console.log('product:', productId, 'currentStock:', currentStock, 'desiredStock:', desiredStock);

  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = '" + adminId + "'");

    const delta = desiredStock - currentStock;
    const idemKey = 'admin-stock-' + productId + '-' + Date.now() + '-test';
    const res = await client.query(
      "SELECT public.adjust_inventory($1, $2, $3, $4) AS result",
      [productId, delta, 'Manual admin correction (test)', idemKey]
    );
    console.log('adjust_inventory result:', JSON.stringify(res.rows[0].result));

    const mirrored = await client.query('SELECT "Stock" FROM public.products WHERE id = $1', [productId]);
    console.log('products.Stock after adjust (should equal desiredStock):', mirrored.rows[0].Stock);

    const movement = await client.query(
      "SELECT product_id, delta_total, kind, idempotency_key FROM public.stock_movements WHERE idempotency_key = $1",
      [idemKey]
    );
    console.log('stock_movements row written:', JSON.stringify(movement.rows));

    const matches = Number(mirrored.rows[0].Stock) === desiredStock;
    console.log(matches ? 'PASS — mirrored stock matches desired value exactly' : '!!! FAIL — mismatch');
  } catch (e) {
    console.log('!!! ERRORED:', e.message);
  } finally {
    await client.query('ROLLBACK');
    console.log('Rolled back — no real data changed.');
  }

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
