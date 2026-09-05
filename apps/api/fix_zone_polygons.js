const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false,
});

// Standard haversine destination-point formula -- same approach already
// used for the map redesign's geodesic circle layer earlier this session.
const R_KM = 6371;
function destinationPoint(lat, lng, distanceKm, bearingDeg) {
  const rad = Math.PI / 180;
  const lat1 = lat * rad, lng1 = lng * rad, brng = bearingDeg * rad;
  const dR = distanceKm / R_KM;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { lat: lat2 / rad, lng: lng2 / rad };
}
function circlePolygon(lat, lng, radiusKm, points = 16) {
  const pts = [];
  for (let i = 0; i < points; i++) {
    pts.push(destinationPoint(lat, lng, radiusKm, (360 / points) * i));
  }
  return { points: pts };
}

// New, verified branch centers (matching fix_branch_coords_and_zones.js).
const centers = {
  'ismailia-13': { lat: 30.053275, lng: 31.399404 },   // now Republic St.
  'ismailia-14': { lat: 30.052995, lng: 31.3952 },      // now Ismailia St.
  'masakin-dhabbat-2': { lat: 30.050886, lng: 31.392138 }, // now El-Sallab
};
// Radius parsed straight from each zone's own id suffix (-2km/-5km/-8km/-12km).

async function run() {
  await client.connect();
  const res = await client.query(
    `SELECT id, "branchId" FROM "DeliveryZone" WHERE "branchId" IN ($1,$2,$3)`,
    Object.keys(centers),
  );

  for (const row of res.rows) {
    const center = centers[row.branchId];
    const match = row.id.match(/-(\d+)km$/);
    if (!center || !match) { console.log('SKIP (no match):', row.id); continue; }
    const radiusKm = Number(match[1]);
    const polygon = circlePolygon(center.lat, center.lng, radiusKm);
    await client.query(
      `UPDATE "DeliveryZone" SET polygon = $1, "updatedAt" = now() WHERE id = $2`,
      [JSON.stringify(polygon), row.id],
    );
    console.log(`Re-centered ${row.id} (${radiusKm}km ring) on (${center.lat}, ${center.lng})`);
  }

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
