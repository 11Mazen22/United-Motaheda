const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://envoy-production-1cbe.up.railway.app', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI', {
  global: {
    headers: {
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI` // Invalid signature but whatever
    }
  }
});
const DRIVER_PROFILE_COLUMNS = 'id, userId, vehicleType, vehiclePlate, vehicleModel, vehicleColor, licenseNumber, licensePhotoUrl, idPhotoUrl, vehiclePhotoUrl, insurancePhotoUrl, status, rejectionReason, createdAt, isOnline, currentLat, currentLng, lastLocationAt, rating, totalDeliveries, completionRate, totalEarnings';

supabase
    .from("DriverProfile")
    .select(DRIVER_PROFILE_COLUMNS)
    .eq("userId", "00000000-0000-0000-0000-000000000000")
    .maybeSingle()
    .then(res => console.log('Result:', res))
    .catch(err => console.error('Crash:', err));
