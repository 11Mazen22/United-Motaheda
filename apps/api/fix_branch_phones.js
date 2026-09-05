const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

// From apps/shopper-native/src/features/delivery/branches/data.ts (the
// established display source of truth for phone numbers).
const PHONES = {
  "ismailia-13":       "01090530095",
  "ismailia-14":       "01201967825",
  "masakin-dhabbat":   "01226898995",
  "masakin-dhabbat-2": "01090530095",
};

(async () => {
  await client.connect();
  for (const [id, phone] of Object.entries(PHONES)) {
    const r = await client.query('UPDATE public."Branch" SET phone = $1, "updatedAt" = now() WHERE id = $2 RETURNING id, phone', [phone, id]);
    console.log(JSON.stringify(r.rows));
  }
  const all = await client.query('SELECT id, phone FROM public."Branch" ORDER BY id');
  console.log("=== ALL PHONES NOW ===");
  console.log(JSON.stringify(all.rows, null, 2));
  await client.end();
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
