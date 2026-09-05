const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

async function main() {
  await client.connect();
  const addrs = await client.query(`
    SELECT a.id, a.user_id, a.label, a.city, a.district, a.street, a.lat, a.lng, a.updated_at, p.email
    FROM public.addresses a
    LEFT JOIN public.profiles p ON p.id = a.user_id
    WHERE a.label IN ('family','home')
    ORDER BY a.updated_at DESC
  `);
  console.log(JSON.stringify(addrs.rows, null, 2));

  for (const row of addrs.rows) {
    if (row.lat == null || row.lng == null) { console.log(row.label + ': NO COORDS STORED'); continue; }
    const zone = await client.query('SELECT * FROM resolve_delivery_zone($1, $2, 0)', [row.lat, row.lng]);
    console.log(row.label + ' @ (' + row.lat + ', ' + row.lng + ') -> ' + JSON.stringify(zone.rows));
  }
  await client.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
