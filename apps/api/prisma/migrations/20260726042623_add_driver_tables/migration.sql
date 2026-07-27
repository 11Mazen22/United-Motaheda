-- CreateEnum
CREATE TYPE "public"."DriverStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."DeliveryStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'REJECTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PHARMACY', 'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'ARRIVED_AT_CUSTOMER', 'DELIVERED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."DriverProfile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "vehiclePlate" TEXT,
    "vehicleModel" TEXT,
    "vehicleColor" TEXT,
    "licenseNumber" TEXT,
    "licenseExpiry" TIMESTAMPTZ(6),
    "licensePhotoUrl" TEXT,
    "idPhotoUrl" TEXT,
    "vehiclePhotoUrl" TEXT,
    "insurancePhotoUrl" TEXT,
    "status" "public"."DriverStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMPTZ(6),
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMPTZ(6),
    "approvedBy" UUID,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverLocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driverId" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "altitude" DOUBLE PRECISION,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryAssignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "orderId" UUID NOT NULL,
    "driverId" UUID NOT NULL,
    "pharmacyName" TEXT NOT NULL,
    "pharmacyLat" DOUBLE PRECISION NOT NULL,
    "pharmacyLng" DOUBLE PRECISION NOT NULL,
    "pharmacyAddress" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(6),
    "rejectedAt" TIMESTAMPTZ(6),
    "arrivedPharmacyAt" TIMESTAMPTZ(6),
    "pickedUpAt" TIMESTAMPTZ(6),
    "arrivedCustomerAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "proofPhotoUrl" TEXT,
    "customerSignature" TEXT,
    "deliveryNotes" TEXT,
    "customerRating" INTEGER,
    "customerFeedback" TEXT,
    "baseFee" DECIMAL(10,2) NOT NULL,
    "distanceFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(10,2) NOT NULL,
    "status" "public"."DeliveryStatus" NOT NULL DEFAULT 'ASSIGNED',
    "cancellationReason" TEXT,
    "estimatedDistance" DOUBLE PRECISION,
    "estimatedDuration" INTEGER,
    "actualDistance" DOUBLE PRECISION,
    "actualDuration" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DeliveryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driverId" UUID NOT NULL,
    "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(6),
    "totalOnlineTime" INTEGER NOT NULL DEFAULT 0,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDistance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DriverSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DriverEarning" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driverId" UUID NOT NULL,
    "deliveryId" UUID NOT NULL,
    "baseFee" DECIMAL(10,2) NOT NULL,
    "distanceFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tipAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bonusAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMPTZ(6),
    "paymentMethod" TEXT,
    "paymentRef" TEXT,
    "earnedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "tokenId" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB DEFAULT '{}',
    "imageUrl" TEXT,
    "status" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(6),
    "clickedAt" TIMESTAMPTZ(6),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "public"."DriverProfile"("userId");

-- CreateIndex
CREATE INDEX "DriverProfile_status_idx" ON "public"."DriverProfile"("status");

-- CreateIndex
CREATE INDEX "DriverProfile_isOnline_idx" ON "public"."DriverProfile"("isOnline");

-- CreateIndex
CREATE INDEX "DriverProfile_userId_idx" ON "public"."DriverProfile"("userId");

-- CreateIndex
CREATE INDEX "DriverLocation_driverId_timestamp_idx" ON "public"."DriverLocation"("driverId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "DriverLocation_timestamp_idx" ON "public"."DriverLocation"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAssignment_orderId_key" ON "public"."DeliveryAssignment"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_driverId_status_idx" ON "public"."DeliveryAssignment"("driverId", "status");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_orderId_idx" ON "public"."DeliveryAssignment"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryAssignment_status_assignedAt_idx" ON "public"."DeliveryAssignment"("status", "assignedAt" DESC);

-- CreateIndex
CREATE INDEX "DeliveryAssignment_driverId_deliveredAt_idx" ON "public"."DeliveryAssignment"("driverId", "deliveredAt" DESC);

-- CreateIndex
CREATE INDEX "DriverSession_driverId_startedAt_idx" ON "public"."DriverSession"("driverId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "DriverEarning_driverId_earnedAt_idx" ON "public"."DriverEarning"("driverId", "earnedAt" DESC);

-- CreateIndex
CREATE INDEX "DriverEarning_isPaid_idx" ON "public"."DriverEarning"("isPaid");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationToken_token_key" ON "public"."NotificationToken"("token");

-- CreateIndex
CREATE INDEX "NotificationToken_userId_isActive_idx" ON "public"."NotificationToken"("userId", "isActive");

-- CreateIndex
CREATE INDEX "NotificationToken_token_idx" ON "public"."NotificationToken"("token");

-- CreateIndex
CREATE INDEX "NotificationLog_userId_sentAt_idx" ON "public"."NotificationLog"("userId", "sentAt" DESC);

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "public"."NotificationLog"("status");

-- CreateIndex
CREATE INDEX "orders_assigned_driver_id_idx" ON "public"."orders"("assigned_driver_id");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "public"."orders"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."DriverProfile" ADD CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryAssignment" ADD CONSTRAINT "DeliveryAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverSession" ADD CONSTRAINT "DriverSession_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DriverEarning" ADD CONSTRAINT "DriverEarning_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NotificationToken" ADD CONSTRAINT "NotificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
