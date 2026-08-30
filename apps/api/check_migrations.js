const { Client } = require('pg');
const client = new Client('postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable');
client.connect().then(async () => {
  try {
    const res = await client.query(`
      SELECT version FROM supabase_migrations.schema_migrations;
    `);
    console.log(res.rows.map(r => r.version));
  } catch (e) {
    console.error('Crash:', e.message);
  }
  client.end();
});
