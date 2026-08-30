const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });
client.connect().then(() => {
  client.query(`
    SELECT n.nspname AS schema_name
    FROM pg_constraint c
    JOIN pg_class t ON c.confrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'stock_movements_actor_id_fkey';
  `).then(res => {
    console.log(res.rows);
    client.end();
  });
});
