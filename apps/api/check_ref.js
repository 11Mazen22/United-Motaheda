const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'inventory_reservations' AND column_name = 'reservation_ref';").then(res => {
    console.log(res.rows);
    client.end();
  });
});
