const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(async () => {
  await client.query("SET ROLE authenticated;");
  // Set fake jwt claims to simulate an authenticated user
  await client.query("set request.jwt.claims to '{\"sub\": \"00000000-0000-0000-0000-000000000000\", \"role\": \"authenticated\"}';");
  
  const res = await client.query(`
    EXPLAIN ANALYZE SELECT * FROM "DriverProfile" WHERE "userId" = '00000000-0000-0000-0000-000000000000'
  `);
  console.log(res.rows.map(r => r['QUERY PLAN']).join('\\n'));
  client.end();
}).catch(e => {
  console.error(e);
  client.end();
});
