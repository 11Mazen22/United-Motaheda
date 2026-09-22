const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
client.connect().then(async () => {
  try {
    const res = await client.query(`SELECT id, userId, vehicleType, vehiclePlate, vehicleModel, vehicleColor, licenseNumber, licensePhotoUrl, idPhotoUrl, vehiclePhotoUrl, insurancePhotoUrl, status, rejectionReason, createdAt, isOnline, currentLat, currentLng, lastLocationAt, rating, totalDeliveries, completionRate, totalEarnings FROM "DriverProfile" LIMIT 1;`);
    console.log('Query successful');
  } catch (e) {
    console.error('Crash:', e.message);
  }
  client.end();
});
