const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(() => {
  return client.query(`
    SELECT polname, polcmd, polqual, polwithcheck 
    FROM pg_policy 
    WHERE polrelid = 'public.profiles'::regclass;
  `);
}).then(res => {
  console.log(res.rows);
  client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
