const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI';
const url = 'https://envoy-production-1cbe.up.railway.app/rest/v1/DriverProfile?select=id,userId,vehicleType,vehiclePlate,vehicleModel,vehicleColor,licenseNumber,licensePhotoUrl,idPhotoUrl,vehiclePhotoUrl,insurancePhotoUrl,status,rejectionReason,createdAt,isOnline,currentLat,currentLng,lastLocationAt,rating,totalDeliveries,completionRate,totalEarnings&userId=eq.00000000-0000-0000-0000-000000000000';

const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg4MDA2ODUzLCJleHAiOjIxMDMzNjY4NTN9.cGHr99POxNCCxKSXmYK1ySwsTiRsNMvnrDUV0UBrnoI'; // invalid signature, but postgrest on railway might check signature? 

// Actually, PostgREST verifies the JWT signature using the JWT secret.
// I can't generate a valid JWT without the secret.
