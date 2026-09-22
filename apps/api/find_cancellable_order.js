const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const ORDER_ID = 'ac367250-42c9-48a4-b1d5-731e1d0d8918';
const CUSTOMER_ID = '742ea034-3051-451e-a156-a871e56c357c';

async function run() {
  await client.connect();
  await client.query('BEGIN');
  await client.query(`SET LOCAL ROLE authenticated`);
  await client.query(`SET LOCAL request.jwt.claims = '{"sub":"${CUSTOMER_ID}","role":"authenticated"}'`);
  const res = await client.query(`SELECT get_order_actions($1) AS actions`, [ORDER_ID]);
  console.log(JSON.stringify(res.rows[0].actions, null, 2));
  await client.query('ROLLBACK');
  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
