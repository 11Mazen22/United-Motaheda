const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT pg_advisory_xact_lock(hashtext('inv-product:cae659a6-cfa3-4baa-b5e3-e62d4a22583b'));")
    .then(res => {
      console.log(res.rows);
      client.end();
    })
    .catch(err => {
      console.error(err);
      client.end();
    });
});
