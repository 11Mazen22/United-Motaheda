const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'inventory_reservations' AND column_name = 'user_id';").then(res => {
    console.log(res.rows);
    client.end();
  });
});
