const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres',
  ssl: false,
});

function embed(lat, lng) {
  return `https://maps.google.com/maps?q=${lat},${lng}&t=&z=17&ie=UTF8&iwloc=&output=embed`;
}

// Verified live against the user's own Google Maps links (2026-09-04).
// IDs are kept stable -- orders.branch_id, DeliveryZone.branchId, and
// profiles.branch_id reference these by id, and 3 of the 6 rows currently
// have real order/zone history (ismailia-13: 3 orders + 4 zones,
// ismailia-14: 1 order + 4 zones, masakin-dhabbat-2: 3 orders + 4 zones) --
// deleting and recreating would either fail on the FK or, worse, cascade
// and destroy that history. Repurposing the row in place gets the same
// end result (correct name/address/coordinates) without the risk.
const updates = [
  {
    id: 'gardenia',
    nameAr: 'صيدليات المتحدة - جاردينيا سيتي',
    nameEn: 'United Pharmacies - Gardenia City',
    area: 'القاهرة الجديدة',
    address: 'محل B1 مول CITY WALK كومباوند جاردينيا سيتي، القاهرة الجديدة',
    lat: 30.0657304, lng: 31.3881822,
    phone: '01012255595',
  },
  {
    id: 'maadi',
    nameAr: 'صيدليات المتحدة - المعادي',
    nameEn: 'United Pharmacies - Maadi',
    area: 'المعادي',
    address: 'ش فلسطين، بندر مول، المعادي، القاهرة',
    lat: 29.9776169, lng: 31.2843354,
    phone: '01061128400',
  },
  {
    id: 'masakin-dhabbat',
    nameAr: 'صيدليات المتحدة - مساكن الضباط 336',
    nameEn: 'United Pharmacies - Masakin Al-Dabbat 336',
    area: 'مدينة نصر',
    address: 'عمارة 336 شارع فاطمة الزهراء متفرع من الميثاق، مدينة نصر',
    lat: 30.047446, lng: 31.3914081,
    phone: '01226898995',
  },
  // Repurposed: was ismailia-13 (same phone, 01090530095) -- the resolved
  // "ش الأسماعيلية" map pin sits ~700m from this row's old coordinates and
  // doesn't clearly correspond to either old Ismailia listing, so per the
  // user's own call this row becomes the genuinely distinct Republic St.
  // branch instead of a guessed Ismailia match.
  {
    id: 'ismailia-13',
    nameAr: 'صيدليات المتحدة - شارع الجمهورية',
    nameEn: 'United Pharmacies - Republic St.',
    area: 'مدينة نصر',
    address: 'شارع الجمهورية، مدينة نصر',
    lat: 30.053275, lng: 31.399404,
    phone: '01090530095',
  },
  // Kept as the real, single Ismailia branch -- coordinates corrected to
  // the actual verified pin.
  {
    id: 'ismailia-14',
    nameAr: 'صيدليات المتحدة - شارع الاسماعيلية',
    nameEn: 'United Pharmacies - Ismailia St.',
    area: 'مدينة نصر',
    address: 'شارع الأسماعيلية متفرع من شارع الميثاق، زهراء مدينة نصر',
    lat: 30.052995, lng: 31.3952,
    phone: '01201967825',
  },
  // Repurposed: was masakin-dhabbat-2 (same phone, 01090530095).
  {
    id: 'masakin-dhabbat-2',
    nameAr: 'صيدليات المتحدة - السلاب',
    nameEn: 'United Pharmacies - El-Sallab',
    area: 'مدينة نصر',
    address: 'السلاب، بجوار نقطة زهراء، مدينة نصر',
    lat: 30.050886, lng: 31.392138,
    phone: '01090530095',
  },
];

async function run() {
  await client.connect();

  for (const b of updates) {
    await client.query(
      `UPDATE public."Branch" SET
         "nameAr" = $1, "nameEn" = $2, area = $3, address = $4,
         lat = $5, lng = $6, phone = $7,
         "mapEmbedSrc" = $8, "updatedAt" = now()
       WHERE id = $9`,
      [b.nameAr, b.nameEn, b.area, b.address, b.lat, b.lng, b.phone, embed(b.lat, b.lng), b.id],
    );
    console.log(`Updated ${b.id} -> ${b.nameEn} (${b.lat}, ${b.lng})`);
  }

  console.log('\n--- Verifying ---');
  const res = await client.query('SELECT id, "nameEn", lat, lng, phone FROM public."Branch" ORDER BY id');
  console.log(res.rows);

  await client.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
