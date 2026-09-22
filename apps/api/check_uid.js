const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'uid' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth');").then(res => {
    console.log(res.rows[0]?.pg_get_functiondef);
    client.end();
  });
});
