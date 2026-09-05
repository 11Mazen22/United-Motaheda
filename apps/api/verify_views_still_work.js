const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.gntpxffonjvnvadjclpl:11%E2%80%98%D9%89%D9%87%D9%81%D8%AB%D9%8A22%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();

  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE anon`);

  const inv = await client.query(`SELECT * FROM public.available_inventory LIMIT 3`);
  console.log(`available_inventory as anon: ${inv.rows.length} rows returned`);
  console.log(inv.rows);

  const reviews = await client.query(`SELECT * FROM public.product_review_stats LIMIT 3`);
  console.log(`\nproduct_review_stats as anon: ${reviews.rows.length} rows returned`);
  console.log(reviews.rows);

  // Confirm _prisma_migrations is now genuinely unreachable as anon.
  try {
    await client.query(`SELECT * FROM public._prisma_migrations LIMIT 1`);
    console.log('\n_prisma_migrations: UNEXPECTED — anon could still read it');
  } catch (e) {
    console.log('\n_prisma_migrations as anon: correctly denied —', e.message);
  }

  await client.query('ROLLBACK');
  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
