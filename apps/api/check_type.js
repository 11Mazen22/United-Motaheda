const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => {
  return client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'DriverProfile' AND column_name = 'userId';
  `);
}).then(res => {
  console.log(res.rows);
  client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
