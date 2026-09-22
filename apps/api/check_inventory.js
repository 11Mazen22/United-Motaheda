const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT * FROM inventory_state LIMIT 10;").then(res => {
    console.log(res.rows);
    client.end();
  });
});
