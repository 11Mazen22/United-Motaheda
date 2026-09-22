const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT proowner::regrole FROM pg_proc WHERE proname = '_inventory_ensure_state';").then(res => {
    console.log(res.rows);
    client.end();
  });
});
