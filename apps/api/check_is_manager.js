const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => {
  return client.query(`
    SELECT prosrc 
    FROM pg_proc 
    WHERE proname = 'is_manager';
  `);
}).then(res => {
  console.log(res.rows);
  client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
