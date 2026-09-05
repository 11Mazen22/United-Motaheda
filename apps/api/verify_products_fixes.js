const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

async function main() {
  await client.connect();

  const pharmacist = await client.query("SELECT id FROM public.profiles WHERE role = 'pharmacist' LIMIT 1");
  const anyProduct = await client.query('SELECT id, "Price", "Stock" FROM public.products LIMIT 1');
  const pharmacistId = pharmacist.rows[0]?.id;
  const productId = anyProduct.rows[0]?.id;
  console.log('pharmacist:', pharmacistId, ' product:', productId);

  // 1. Negative price rejected
  await client.query('BEGIN');
  try {
    await client.query('UPDATE public.products SET "Price" = -5 WHERE id = $1', [productId]);
    console.log('!!! negative price was NOT rejected — bug');
  } catch (e) {
    console.log('negative price correctly rejected:', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  // 2. Negative stock rejected
  await client.query('BEGIN');
  try {
    await client.query('UPDATE public.products SET "Stock" = -1 WHERE id = $1', [productId]);
    console.log('!!! negative stock was NOT rejected — bug');
  } catch (e) {
    console.log('negative stock correctly rejected:', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  // 3. Pharmacist CAN update a product
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = '" + pharmacistId + "'");
    const res = await client.query('UPDATE public.products SET "Name" = "Name" WHERE id = $1 RETURNING id', [productId]);
    console.log('pharmacist UPDATE result rows:', res.rowCount, res.rowCount > 0 ? '(correct — allowed)' : '!!! BLOCKED — bug');
  } catch (e) {
    console.log('!!! pharmacist UPDATE errored (should have succeeded):', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  // 4. Pharmacist CANNOT delete a product
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SET LOCAL request.jwt.claim.sub = '" + pharmacistId + "'");
    const res = await client.query('DELETE FROM public.products WHERE id = $1 RETURNING id', [productId]);
    console.log('pharmacist DELETE result rows:', res.rowCount, res.rowCount === 0 ? '(correct — blocked by RLS)' : '!!! DELETE SUCCEEDED — bug');
  } catch (e) {
    console.log('pharmacist DELETE errored:', e.message);
  } finally {
    await client.query('ROLLBACK');
  }

  await client.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
