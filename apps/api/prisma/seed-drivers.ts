/**
 * Seed script for driver platform development data
 * Run with: npx ts-node -r tsconfig-paths/register prisma/seed-drivers.ts
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  console.log('🚀 Starting driver platform seed...');

  // Create test driver users and profiles
  const drivers = [
    {
      email: 'driver1@pharmacy.com',
      fullName: 'Ahmed Hassan',
      phone: '+201234567890',
      vehicleType: 'motorcycle',
      vehiclePlate: 'ABC-1234',
      vehicleModel: 'Honda PCX',
      vehicleColor: 'Red',
    },
    {
      email: 'driver2@pharmacy.com',
      fullName: 'Mohamed Ali',
      phone: '+201234567891',
      vehicleType: 'car',
      vehiclePlate: 'XYZ-5678',
      vehicleModel: 'Toyota Corolla',
      vehicleColor: 'White',
    },
    {
      email: 'driver3@pharmacy.com',
      fullName: 'Sara Ahmed',
      phone: '+201234567892',
      vehicleType: 'motorcycle',
      vehiclePlate: 'DEF-9012',
      vehicleModel: 'Yamaha Nmax',
      vehicleColor: 'Blue',
    },
  ];

  for (const driverData of drivers) {
    // Check if user already exists
    const existingProfile = await prisma.profiles.findFirst({
      where: { email: driverData.email },
    });

    if (existingProfile) {
      console.log(`✓ Driver ${driverData.fullName} already exists`);
      continue;
    }

    console.log(`Creating driver: ${driverData.fullName}...`);

    try {
      const seedPassword = process.env.SEED_DRIVER_PASSWORD;
      if (!seedPassword) throw new Error('SEED_DRIVER_PASSWORD is required');

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: driverData.email,
        password: seedPassword,
        phone: driverData.phone,
        email_confirm: true,
        user_metadata: { full_name: driverData.fullName, phone: driverData.phone },
      });
      if (authError || !authData.user) throw authError ?? new Error('Auth user creation failed');

      const profile = await prisma.profiles.upsert({
        where: { id: authData.user.id },
        create: {
          id: authData.user.id,
          full_name: driverData.fullName,
          email: driverData.email,
          phone: driverData.phone,
          role: 'driver',
          status: 'Active',
        },
        update: {
          full_name: driverData.fullName,
          email: driverData.email,
          phone: driverData.phone,
          role: 'driver',
          status: 'Active',
        },
      });

      // Create driver profile
      await prisma.driverProfile.create({
        data: {
          userId: profile.id,
          vehicleType: driverData.vehicleType,
          vehiclePlate: driverData.vehiclePlate,
          vehicleModel: driverData.vehicleModel,
          vehicleColor: driverData.vehicleColor,
          status: 'APPROVED',
          isOnline: false,
          rating: 5.0,
          totalDeliveries: 0,
          completionRate: 100.0,
          licenseNumber: `LIC${Math.floor(Math.random() * 100000)}`,
          licenseExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        },
      });

      console.log(`✓ Created driver: ${driverData.fullName}`);
    } catch (error) {
      console.error(`✗ Failed to create driver ${driverData.fullName}:`, error);
    }
  }

  // Create sample delivery assignments for testing
  console.log('\n📦 Creating sample delivery assignments...');

  const approvedDrivers = await prisma.driverProfile.findMany({
    where: { status: 'APPROVED' },
    take: 2,
  });

  if (approvedDrivers.length > 0) {
    // Get some pending orders
    const pendingOrders = await prisma.orders.findMany({
      where: {
        status: 'pending',
        assigned_driver_id: null,
      },
      take: 3,
    });

    for (let i = 0; i < Math.min(pendingOrders.length, 2); i++) {
      const order = pendingOrders[i];
      const driver = approvedDrivers[i % approvedDrivers.length];

      try {
        await prisma.deliveryAssignment.create({
          data: {
            orderId: order.id,
            driverId: driver.id,
            pharmacyName: 'Main Pharmacy Branch',
            pharmacyLat: 30.0444,
            pharmacyLng: 31.2357,
            pharmacyAddress: '123 Cairo Street, Cairo, Egypt',
            baseFee: 15.0,
            distanceFee: 5.0,
            totalEarnings: 20.0,
            status: 'ASSIGNED',
          },
        });

        // Update order
        await prisma.orders.update({
          where: { id: order.id },
          data: {
            assigned_driver_id: driver.userId,
            status: 'confirmed',
          },
        });

        console.log(`✓ Assigned order ${order.id} to driver ${driver.userId}`);
      } catch (error) {
        console.error(`✗ Failed to create delivery assignment:`, error);
      }
    }
  }

  console.log('\n✅ Driver platform seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
