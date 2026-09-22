const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(async () => {
  try {
    const res = await client.query(`
      SELECT version FROM supabase_migrations.schema_migrations;
    `);
    console.log(res.rows.map(r => r.version));
  } catch (e) {
    console.error('Crash:', e.message);
  }
  client.end();
});
