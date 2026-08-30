const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://envoy-production-1cbe.up.railway.app',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI'
);

async function test() {
  const { data, error } = await supabase.rpc('validate_inventory', {
    p_product_id: 'cae659a6-cfa3-4baa-b5e3-e62d4a22583b',
    p_requested: 1
  });
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
