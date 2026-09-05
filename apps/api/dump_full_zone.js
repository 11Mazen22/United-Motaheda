const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });
(async () => {
  await client.connect();
  const zones = await client.query('SELECT id, "branchId", polygon FROM public."DeliveryZone" WHERE id = $1', ['masakin-dhabbat-zone-2km']);
  const poly = zones.rows[0].polygon;
  console.log('point count:', poly.points.length);
  console.log('first 5 points:', JSON.stringify(poly.points.slice(0, 5), null, 2));
  console.log('closes back to first?', JSON.stringify(poly.points[poly.points.length - 1]));

  // Reverse-engineer radius using haversine from branch center
  const branch = await client.query('SELECT lat, lng FROM public."Branch" WHERE id = $1', ['masakin-dhabbat']);
  const { lat: clat, lng: clng } = branch.rows[0];
  function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
  console.log('center:', clat, clng);
  for (let i = 0; i < 5; i++) {
    const p = poly.points[i];
    console.log(`point ${i} distance from center: ${haversine(clat, clng, p.lat, p.lng).toFixed(4)} km`);
  }
  await client.end();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
