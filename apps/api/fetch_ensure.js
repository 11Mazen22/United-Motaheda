const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '_inventory_ensure_state';").then(res => {
    console.log(res.rows[0].pg_get_functiondef);
    client.end();
  });
});
