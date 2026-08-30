const { Client } = require('pg');
const client = new Client('postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable');
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
