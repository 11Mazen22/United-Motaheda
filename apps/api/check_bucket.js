const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });
c.connect().then(() => c.query("SELECT name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE name = 'prescriptions'")).then(r => { 
  console.log('bucket:', JSON.stringify(r.rows, null, 2)); 
  return c.query("SELECT * FROM storage.policies WHERE bucket_id = 'prescriptions' LIMIT 20");
}).then(r => {
  console.log('policies:', JSON.stringify(r.rows, null, 2)); 
  return c.end(); 
}).catch(e => { console.error('error:', e.message); process.exit(1); });
