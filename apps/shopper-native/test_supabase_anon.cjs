const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://envoy-production-1cbe.up.railway.app', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI');

async function test() {
  const email = 'test' + Date.now() + '@example.com';
  // I will just use the anon key to query profiles without auth
  const start = Date.now();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .limit(1);
    
  console.log('Profiles query took:', Date.now() - start, 'ms');
  console.log('Result:', { data, error });
}

test();
