const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://envoy-production-1cbe.up.railway.app', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI');

async function test() {
  const email = 'test' + Date.now() + '@example.com';
  // Sign up a dummy user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: 'password123'
  });
  
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  
  console.log('Signed up user:', authData.user.id);
  
  const start = Date.now();
  const DRIVER_PROFILE_COLUMNS = 'id, userId, vehicleType, vehiclePlate, vehicleModel, vehicleColor, licenseNumber, licensePhotoUrl, idPhotoUrl, vehiclePhotoUrl, insurancePhotoUrl, status, rejectionReason, createdAt, isOnline, currentLat, currentLng, lastLocationAt, rating, totalDeliveries, completionRate, totalEarnings';

  const { data, error } = await supabase
    .from("DriverProfile")
    .select(DRIVER_PROFILE_COLUMNS)
    .eq("userId", authData.user.id)
    .maybeSingle();
    
  console.log('Query took:', Date.now() - start, 'ms');
  console.log('Result:', { data, error });
}

test();
