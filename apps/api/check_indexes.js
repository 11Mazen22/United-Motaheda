const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => {
  return client.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'DriverProfile';
  `);
}).then(res => {
  console.log(res.rows);
  client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
