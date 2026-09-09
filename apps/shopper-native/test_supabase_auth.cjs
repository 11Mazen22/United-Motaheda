const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://gntpxffonjvnvadjclpl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudHB4ZmZvbmp2bnZhZGpjbHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzA4NzEsImV4cCI6MjA5MDQwNjg3MX0.hLDucOsGEci6iWq7eHS6RsQIZEpipBxjuqlep5f9Pcs');

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
