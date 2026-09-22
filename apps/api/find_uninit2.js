const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT id FROM public.products p WHERE NOT EXISTS (SELECT 1 FROM public.inventory_state i WHERE i.product_id = p.id::text) LIMIT 1;").then(res => {
    console.log(res.rows[0]);
    client.end();
  });
});
