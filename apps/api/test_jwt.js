const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(async () => {
  try {
    await client.query("BEGIN;");
    await client.query("SET LOCAL request.jwt.claim.sub = '18f75f66-edbf-4dd8-a276-bbb1c72bb8af';");
    const res = await client.query("SELECT reserve_inventory('cae659a6-cfa3-4baa-b5e3-e62d4a22583b', 1, 'cart', '18f75f66-edbf-4dd8-a276-bbb1c72bb8af', 'test' || extract(epoch from now())::text, 900);");
    console.log('Result:', res.rows);
    await client.query("ROLLBACK;");
  } catch (err) {
    console.error('Error:', err);
    await client.query("ROLLBACK;");
  } finally {
    client.end();
  }
});
