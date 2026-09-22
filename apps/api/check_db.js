const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => {
  return client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'DriverProfile'");
}).then(res => {
  console.log(res.rows.map(r => r.column_name).join(', '));
  client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
