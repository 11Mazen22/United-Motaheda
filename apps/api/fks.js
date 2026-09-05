require('dotenv').config();
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });

const sql = `
  SELECT c.constraint_name,
         tc.table_schema,
         tc.table_name,
         kcu.column_name,
         ccu.table_name as ref_table
  FROM information_schema.table_constraints AS c
  JOIN information_schema.table_constraints AS tc
    ON c.constraint_name = tc.constraint_name
  JOIN information_schema.key_column_usage AS kcu
    ON c.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = c.constraint_name
  WHERE c.constraint_type = 'FOREIGN KEY'
    AND ccu.table_schema IN ('public', 'auth')
    AND ccu.table_name IN ('users', 'profiles');
`;

client.connect()
  .then(() => client.query(sql))
  .then(res => console.table(res.rows))
  .catch(e => console.error(e))
  .finally(() => client.end());
