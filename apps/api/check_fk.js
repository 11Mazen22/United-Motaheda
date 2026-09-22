const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  client.query(`
    SELECT n.nspname AS schema_name
    FROM pg_constraint c
    JOIN pg_class t ON c.confrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'inventory_reservations_user_id_fkey';
  `).then(res => {
    console.log(res.rows);
    client.end();
  });
});
