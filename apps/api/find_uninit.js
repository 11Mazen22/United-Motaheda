const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT id FROM public.products WHERE id NOT IN (SELECT product_id::uuid FROM public.inventory_state) LIMIT 1;").then(res => {
    console.log(res.rows[0]);
    client.end();
  });
});
