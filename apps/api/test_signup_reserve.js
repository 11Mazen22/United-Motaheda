const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://envoy-production-1cbe.up.railway.app',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI'
);

async function test() {
  const email = 'test_' + Date.now() + '@example.com';
  const password = 'password123';
  
  console.log('Signing up...');
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  if (authError) {
    console.error('Auth error:', authError);
    return;
  }
  
  console.log('User ID:', authData.user.id);
  
  const { data, error } = await supabase.rpc('reserve_inventory', {
    p_product_id: 'cae659a6-cfa3-4baa-b5e3-e62d4a22583b',
    p_quantity: 1,
    p_reservation_kind: 'cart',
    p_reservation_ref: authData.user.id,
    p_idempotency_key: 'test' + Date.now(),
    p_expires_in_secs: 900
  });
  
  console.log('Reserve Data:', data);
  console.log('Reserve Error:', error);
}

test();
