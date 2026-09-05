require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'prescriptions'
`;

client.connect()
  .then(() => client.query(sql))
  .then(res => console.log(res.rows.map(r => r.column_name)))
  .catch(e => console.error(e))
  .finally(() => client.end());
