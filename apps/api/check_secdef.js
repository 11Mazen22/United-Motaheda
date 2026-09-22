const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(async () => {
  try {
    const res = await client.query(`
      SELECT prosecdef
      FROM pg_proc 
      WHERE proname = 'is_manager';
    `);
    console.log(res.rows);
  } catch (e) {
    console.error('Crash:', e.message);
  }
  client.end();
});
