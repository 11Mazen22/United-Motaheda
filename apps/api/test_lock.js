const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });
client.connect().then(() => {
  client.query("SELECT pg_advisory_xact_lock(hashtext('inv-product:cae659a6-cfa3-4baa-b5e3-e62d4a22583b'));")
    .then(res => {
      console.log(res.rows);
      client.end();
    })
    .catch(err => {
      console.error(err);
      client.end();
    });
});
