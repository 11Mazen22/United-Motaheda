const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(async () => {
  try {
    const res = await client.query(`
      SELECT polname, pg_get_expr(polqual, polrelid) as qual
      FROM pg_policy 
      WHERE polrelid = 'public."DriverProfile"'::regclass;
    `);
    console.log(res.rows);
  } catch (e) {
    console.error('Crash:', e.message);
  }
  client.end();
});
