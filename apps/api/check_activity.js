const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(async () => {
  try {
    const res = await client.query(`
      SELECT pid, state, query, wait_event_type, wait_event, query_start
      FROM pg_stat_activity
      WHERE state = 'active';
    `);
    console.log(res.rows);
  } catch (e) {
    console.error('Crash:', e.message);
  }
  client.end();
});
