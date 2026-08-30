const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });

async function run() {
  await client.connect();
  
  const tables = ['orders', 'order_items', 'products', 'delivery_assignments', 'refunds'];
  for (const t of tables) {
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [t]);
    console.log(`\nTable: ${t}`);
    res.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  }
  
  await client.end();
}
run();
