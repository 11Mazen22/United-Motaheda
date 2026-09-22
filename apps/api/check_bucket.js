const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(() => c.query("SELECT name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE name = 'prescriptions'")).then(r => { 
  console.log('bucket:', JSON.stringify(r.rows, null, 2)); 
  return c.query("SELECT * FROM storage.policies WHERE bucket_id = 'prescriptions' LIMIT 20");
}).then(r => {
  console.log('policies:', JSON.stringify(r.rows, null, 2)); 
  return c.end(); 
}).catch(e => { console.error('error:', e.message); process.exit(1); });
