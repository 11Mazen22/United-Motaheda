const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres?sslmode=disable' });
c.connect()
  .then(() => c.query(`SELECT * FROM storage.objects WHERE bucket_id = 'prescriptions' LIMIT 3`))
  .then(r => { console.log('objects:', JSON.stringify(r.rows.slice(0,3), null, 2)); })
  .then(() => c.query(`
    SELECT policyname, tablename, roles, cmd, qual, with_check
    FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    ORDER BY policyname
  `))
  .then(r => { console.log('storage rls policies:', JSON.stringify(r.rows, null, 2)); })
  .then(() => c.query(`SELECT id, file_size_limit, allowed_mime_types, public FROM storage.buckets WHERE name = 'prescriptions'`))
  .then(r => { console.log('bucket:', JSON.stringify(r.rows, null, 2)); })
  .then(() => c.end())
  .catch(e => { console.error('error:', e.message); c.end(); });
