const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT proacl FROM pg_proc WHERE proname = 'reserve_inventory';").then(res => {
    console.log(res.rows);
    client.end();
  });
});
