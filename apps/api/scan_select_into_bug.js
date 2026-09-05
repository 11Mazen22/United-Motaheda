const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://supabase_admin:g8xgx4euzlkcr26er1y0t3bh2ka6v8lx2x98oww4n9h97d6aaa3ym7j4vxcn2vr2@altaria.proxy.rlwy.net:40973/postgres' });

async function main() {
  await client.connect();
  const fns = await client.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prolang = (SELECT oid FROM pg_language WHERE lanname = 'plpgsql')
  `);
  const suspects = [];
  const re = /SELECT\s+(\w+)\s*\r?\n?\s*INTO\s+(\w+)\s*\r?\n?\s*FROM\s+\S+\s+\1\b/gi;
  for (const row of fns.rows) {
    let m;
    const localRe = new RegExp(re.source, re.flags);
    while ((m = localRe.exec(row.def))) {
      suspects.push({ proname: row.proname, alias: m[1], target: m[2], snippet: m[0] });
    }
  }
  console.log('Total functions scanned:', fns.rows.length);
  console.log(JSON.stringify(suspects, null, 2));
  await client.end();
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
