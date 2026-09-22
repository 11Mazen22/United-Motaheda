const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => {
  return client.query(`
    SELECT relation::regclass, mode, granted
    FROM pg_locks
    WHERE relation::regclass::text = '"DriverProfile"' OR relation::regclass::text = 'public."DriverProfile"';
  `);
}).then(res => {
  console.log(res.rows);
  client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
