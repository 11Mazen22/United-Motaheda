# Driver Platform Database Schema Migration

## Overview
This migration adds comprehensive database tables for the driver/courier delivery platform, including driver profiles, real-time location tracking, delivery assignments, earnings, and push notifications.

## New Tables

### 1. **DriverProfile**
Complete driver information and status tracking.

**Key Fields:**
- `userId` - Links to auth user/profile
- `vehicleType`, `vehiclePlate`, `vehicleModel`, `vehicleColor` - Vehicle information
- `licenseNumber`, `licenseExpiry`, document URLs - Driver documents
- `status` - PENDING_APPROVAL, APPROVED, ACTIVE, SUSPENDED, REJECTED, INACTIVE
- `isOnline` - Current availability status
- `currentLat`, `currentLng`, `lastLocationAt` - Last known location
- `rating`, `totalDeliveries`, `completionRate`, `totalEarnings` - Performance metrics

**Indexes:**
- `status` - For filtering by approval/active status
- `isOnline` - For finding available drivers
- `userId` - For lookups by user

### 2. **DriverLocation**
Real-time GPS location tracking with high precision.

**Key Fields:**
- `driverId` - Reference to DriverProfile
- `latitude`, `longitude`, `accuracy` - GPS coordinates and accuracy in meters
- `heading`, `speed`, `altitude` - Movement data
- `timestamp` - When location was recorded

**Indexes:**
- `(driverId, timestamp DESC)` - For fetching driver's location history
- `timestamp DESC` - For cleanup of old location data

**Usage:** Location updates are inserted frequently (every 5-30 seconds when driver is online). Implement cleanup job to remove data older than 7 days.

### 3. **DeliveryAssignment**
Complete delivery workflow tracking from assignment to completion.

**Key Fields:**
- `orderId`, `driverId` - Links order to assigned driver
- `pharmacyName`, `pharmacyLat`, `pharmacyLng`, `pharmacyAddress` - Pickup location
- Workflow timestamps: `assignedAt`, `acceptedAt`, `arrivedPharmacyAt`, `pickedUpAt`, `arrivedCustomerAt`, `deliveredAt`
- `proofPhotoUrl`, `customerSignature`, `deliveryNotes` - Delivery proof
- `customerRating`, `customerFeedback` - Customer satisfaction
- Earnings: `baseFee`, `distanceFee`, `tipAmount`, `bonusAmount`, `totalEarnings`
- `status` - Current delivery state (11 possible states)
- `estimatedDistance`, `actualDistance`, `estimatedDuration`, `actualDuration` - Performance tracking

**Indexes:**
- `(driverId, status)` - For driver's active deliveries
- `orderId` - For order lookup
- `(status, assignedAt DESC)` - For pending order queue
- `(driverId, deliveredAt DESC)` - For driver's delivery history

### 4. **DriverSession**
Track driver work shifts for analytics and earnings.

**Key Fields:**
- `driverId` - Reference to DriverProfile
- `startedAt`, `endedAt` - Shift start/end times
- `totalOnlineTime` - Minutes online during shift
- `totalDeliveries`, `totalEarnings`, `totalDistance` - Shift statistics

**Usage:** Created when driver goes online, updated when offline. Used for earnings reports and shift analytics.

### 5. **DriverEarning**
Individual earnings records per delivery.

**Key Fields:**
- `driverId`, `deliveryId` - Links to driver and delivery
- Earnings breakdown: `baseFee`, `distanceFee`, `tipAmount`, `bonusAmount`, `totalAmount`
- Payment status: `isPaid`, `paidAt`, `paymentMethod`, `paymentRef`
- `earnedAt` - When earning was recorded

**Indexes:**
- `(driverId, earnedAt DESC)` - For earnings history
- `isPaid` - For finding unpaid earnings

**Usage:** Created upon successful delivery. Used for payment processing and earnings reports.

### 6. **NotificationToken**
Device tokens for push notifications (FCM/APNs).

**Key Fields:**
- `userId` - Links to profile (driver or customer)
- `token` - Unique device token
- `platform` - ios, android, web
- `deviceId`, `deviceName` - Device identification
- `isActive` - Whether token is still valid
- `lastUsedAt` - Last successful notification

**Indexes:**
- `(userId, isActive)` - For finding user's active tokens
- `token` - For token lookup

**Usage:** Tokens are registered when app launches. Set `isActive=false` when token becomes invalid (user uninstalls app, token refresh).

### 7. **NotificationLog**
Track all notifications sent for analytics and debugging.

**Key Fields:**
- `userId`, `tokenId` - Target user and device
- `title`, `body`, `data`, `imageUrl` - Notification content
- `status` - sent, delivered, failed, clicked
- `platform` - ios, android, web
- `errorMessage` - If delivery failed
- `sentAt`, `deliveredAt`, `clickedAt` - Status timestamps

**Indexes:**
- `(userId, sentAt DESC)` - For user's notification history
- `status` - For analytics and retry queue

## New Enums

### DriverStatus
- `PENDING_APPROVAL` - New driver, documents under review
- `APPROVED` - Documents approved, can go online
- `ACTIVE` - Currently online and taking orders
- `SUSPENDED` - Temporarily deactivated (violations, complaints)
- `REJECTED` - Application rejected
- `INACTIVE` - Voluntarily offline or deactivated

### DeliveryStatus
Complete delivery workflow states:
- `ASSIGNED` - Order assigned to driver
- `ACCEPTED` - Driver accepted the order
- `REJECTED` - Driver rejected the order
- `EN_ROUTE_TO_PICKUP` - Driver heading to pharmacy
- `ARRIVED_AT_PHARMACY` - Driver at pharmacy location
- `PICKED_UP` - Order picked up from pharmacy
- `EN_ROUTE_TO_CUSTOMER` - Driver heading to customer
- `ARRIVED_AT_CUSTOMER` - Driver at delivery location
- `DELIVERED` - Successfully delivered
- `CANCELLED` - Delivery cancelled
- `FAILED` - Delivery failed

## Schema Modifications

### Modified: `profiles` table
- Added `driverProfile` relation (one-to-one)
- Added `notificationTokens` relation (one-to-many)

### Modified: `orders` table
- Added `deliveryAssignment` relation (one-to-one)
- Added index on `assigned_driver_id` for driver order lookups
- Added index on `(status, created_at DESC)` for order queues

## Data Integrity

### Foreign Keys
All new tables use CASCADE delete to maintain referential integrity:
- Deleting a driver profile removes all locations, sessions, earnings
- Deleting an order removes its delivery assignment
- Deleting a profile removes all notification tokens

### Constraints
- `DriverProfile.userId` - UNIQUE, ensures one driver profile per user
- `DeliveryAssignment.orderId` - UNIQUE, ensures one delivery per order
- `NotificationToken.token` - UNIQUE, prevents duplicate token registration

## Migration Safety

This migration:
- ✅ Only adds new tables and enums
- ✅ Does not modify existing data
- ✅ Can be rolled back safely
- ✅ Includes comprehensive indexes for performance
- ✅ Follows existing schema patterns

## Performance Considerations

### Location Tracking
- Expected insert rate: 100-500 rows/minute (10-50 drivers updating every 5-30s)
- Implement cleanup job: DELETE locations older than 7 days
- Consider partitioning by date if scale exceeds 1000 concurrent drivers

### Notification Logs
- Can grow rapidly (1000s per day)
- Implement archival: move logs older than 30 days to archive table
- Consider retention policy based on compliance needs

### Indexes
All indexes are optimized for:
- Driver queries (finding available drivers, driver status)
- Order queries (pending assignments, delivery history)
- Time-series queries (recent locations, earnings reports)

## Next Steps

After running this migration:

1. **Run seed script** (optional for development):
   ```bash
   npx ts-node -r tsconfig-paths/register prisma/seed-drivers.ts
   ```

2. **Verify migration**:
   ```bash
   npx prisma studio  # Browse new tables
   ```

3. **Create API endpoints** (Task 2-4 in implementation plan)

4. **Setup push notifications** (Task 5-6 in implementation plan)

## Rollback

To rollback this migration:
```bash
npx prisma migrate resolve --rolled-back 20260726042623_add_driver_tables
```

Then manually drop tables:
```sql
DROP TABLE IF EXISTS "public"."NotificationLog";
DROP TABLE IF EXISTS "public"."NotificationToken";
DROP TABLE IF EXISTS "public"."DriverEarning";
DROP TABLE IF EXISTS "public"."DriverSession";
DROP TABLE IF EXISTS "public"."DeliveryAssignment";
DROP TABLE IF EXISTS "public"."DriverLocation";
DROP TABLE IF EXISTS "public"."DriverProfile";
DROP TYPE IF EXISTS "public"."DeliveryStatus";
DROP TYPE IF EXISTS "public"."DriverStatus";
```
