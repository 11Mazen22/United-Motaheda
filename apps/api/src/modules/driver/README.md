# Driver API Module

Complete authentication and profile management API for delivery drivers.

> **Status note (2026-08-24):** the client that consumed these driver-facing endpoints
> (`driver.controller.ts`, `driver-auth.service.ts`, `driver-orders.service.ts`,
> `location-broadcast.gateway.ts`) was `apps/courier-mobile`, which has been retired —
> its driver product is now `apps/shopper-native`'s `(driver)` persona, which talks to
> Supabase directly rather than through this REST API. These endpoints currently have
> **no client**. They are left in place, not deleted, because the underlying
> `DriverProfile`/`DriverEarning`/`DriverSession` Prisma models are still live and in
> active use — the **admin/ops half** of this module (`admin-driver.controller.ts`, and
> the driver methods on `admin-operations.controller.ts`/`.service.ts`) is consumed by
> `apps/admin`'s `DriversPage.tsx` today, and the driver-consolidation plan intends for
> shopper-native to read/write these same tables going forward (pending an RLS check).
> Do not delete this module assuming it's fully dead, and do not assume it's fully live either.

## Overview

This module provides:
- Driver registration with vehicle and document information
- JWT-based authentication
- Profile management and document uploads
- Online/offline status management
- Performance statistics and earnings tracking

## Endpoints

### Authentication

#### POST `/driver/register`
Register a new driver account.

**Request Body:**
```json
{
  "fullName": "Ahmed Hassan",
  "email": "ahmed@example.com",
  "phone": "+201234567890",
  "password": "securepassword123",
  "vehicleType": "motorcycle",
  "vehiclePlate": "ABC-1234",
  "vehicleModel": "Honda PCX",
  "vehicleColor": "Red",
  "licenseNumber": "LIC123456",
  "licenseExpiry": "2025-12-31"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "driver": {
    "id": "uuid",
    "fullName": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "phone": "+201234567890",
    "role": "driver",
    "driverProfile": {
      "id": "uuid",
      "vehicleType": "motorcycle",
      "vehiclePlate": "ABC-1234",
      "vehicleModel": "Honda PCX",
      "status": "PENDING_APPROVAL",
      "rating": "5.0",
      "totalDeliveries": 0
    }
  }
}
```

#### POST `/driver/login`
Login with email/phone and password.

**Request Body:**
```json
{
  "emailOrPhone": "ahmed@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "driver": {
    "id": "uuid",
    "fullName": "Ahmed Hassan",
    "email": "ahmed@example.com",
    "phone": "+201234567890",
    "role": "driver",
    "driverProfile": {
      "id": "uuid",
      "vehicleType": "motorcycle",
      "vehiclePlate": "ABC-1234",
      "status": "APPROVED",
      "isOnline": false,
      "rating": "4.8",
      "totalDeliveries": 157,
      "completionRate": "98.5",
      "totalEarnings": "2450.00"
    }
  }
}
```

### Profile Management

#### GET `/driver/profile`
Get complete driver profile information.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "fullName": "Ahmed Hassan",
  "email": "ahmed@example.com",
  "phone": "+201234567890",
  "role": "driver",
  "status": "Active",
  "driverProfile": {
    "id": "uuid",
    "vehicleType": "motorcycle",
    "vehiclePlate": "ABC-1234",
    "vehicleModel": "Honda PCX",
    "vehicleColor": "Red",
    "licenseNumber": "LIC123456",
    "licenseExpiry": "2025-12-31T00:00:00.000Z",
    "licensePhotoUrl": "https://storage.supabase.co/...",
    "idPhotoUrl": "https://storage.supabase.co/...",
    "vehiclePhotoUrl": "https://storage.supabase.co/...",
    "insurancePhotoUrl": null,
    "status": "APPROVED",
    "isOnline": false,
    "currentLat": null,
    "currentLng": null,
    "lastLocationAt": null,
    "rating": "4.8",
    "totalDeliveries": 157,
    "completionRate": "98.5",
    "totalEarnings": "2450.00",
    "approvedAt": "2024-01-15T10:30:00.000Z",
    "rejectionReason": null,
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-26T15:20:00.000Z"
  }
}
```

#### PATCH `/driver/profile`
Update driver profile information.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "vehicleType": "car",
  "vehiclePlate": "XYZ-5678",
  "vehicleModel": "Toyota Corolla",
  "vehicleColor": "White",
  "licenseNumber": "LIC654321",
  "licenseExpiry": "2026-06-30"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "driverProfile": {
    "id": "uuid",
    "vehicleType": "car",
    "vehiclePlate": "XYZ-5678",
    "vehicleModel": "Toyota Corolla",
    "vehicleColor": "White",
    "updatedAt": "2024-01-26T15:25:00.000Z"
  }
}
```

### Document Upload

#### POST `/driver/documents/upload/:type`
Upload driver documents (license, id, vehicle, insurance).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Parameters:**
- `type`: Document type (license, id, vehicle, insurance)

**Form Data:**
- `file`: Image file (JPEG/PNG, max 5MB)

**Response:**
```json
{
  "message": "license document uploaded successfully",
  "fileUrl": "https://storage.supabase.co/object/public/driver-documents/uuid/license/1706282400000.jpg",
  "type": "license"
}
```

### Status Management

#### POST `/driver/status/online`
Set driver status to online (available for orders).

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Driver is now online",
  "isOnline": true,
  "status": "ACTIVE"
}
```

#### POST `/driver/status/offline`
Set driver status to offline.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Driver is now offline",
  "isOnline": false,
  "status": "APPROVED"
}
```

### Statistics

#### GET `/driver/statistics`
Get driver performance statistics and earnings.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rating": "4.8",
  "totalDeliveries": 157,
  "completionRate": "98.5",
  "totalEarnings": "2450.00",
  "today": {
    "deliveries": 5,
    "earnings": "85.50"
  },
  "thisWeek": {
    "deliveries": 28,
    "earnings": "420.00"
  },
  "thisMonth": {
    "deliveries": 89,
    "earnings": "1340.00"
  }
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### Common Error Codes

- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - Action not allowed (e.g., suspended driver)
- `404 Not Found` - Driver profile not found
- `409 Conflict` - Email/phone already registered
- `413 Payload Too Large` - File too large (>5MB)
- `415 Unsupported Media Type` - Invalid file type

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

The token is returned from successful login/register and expires after 30 days.

## File Upload Requirements

### Supported Document Types
- `license` - Driver's license photo
- `id` - National ID or passport photo
- `vehicle` - Vehicle registration/photo
- `insurance` - Insurance document photo

### File Requirements
- **Format:** JPEG, PNG only
- **Size:** Maximum 5MB
- **Storage:** Supabase Storage with public URLs

### Upload Process
1. Call upload endpoint with multipart form data
2. File is validated and uploaded to Supabase Storage
3. Profile is automatically updated with file URL
4. Public URL is returned for immediate use

## Driver Status Flow

```
PENDING_APPROVAL (new registration)
    ↓ (admin approves)
APPROVED (can go online)
    ↓ (driver goes online)
ACTIVE (receiving orders)
    ↓ (driver goes offline)
APPROVED (offline but approved)

Other states:
- SUSPENDED (temporarily deactivated)
- REJECTED (application rejected)
- INACTIVE (voluntarily deactivated)
```

## Environment Variables

Required environment variables:

```env
# Supabase Auth and file uploads
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_ANON_KEY="your-anon-key"

# Database
DATABASE_URL="postgresql://..."
```

## Development Testing

### Using cURL

**Register a driver:**
```bash
curl -X POST http://localhost:4000/driver/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Driver",
    "email": "test@driver.com",
    "phone": "+201234567890",
    "password": "password123",
    "vehicleType": "motorcycle",
    "vehiclePlate": "TEST-123"
  }'
```

**Login:**
```bash
curl -X POST http://localhost:4000/driver/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrPhone": "test@driver.com",
    "password": "password123"
  }'
```

**Get profile:**
```bash
curl -X GET http://localhost:4000/driver/profile \
  -H "Authorization: Bearer <token>"
```

**Upload document:**
```bash
curl -X POST http://localhost:4000/driver/documents/upload/license \
  -H "Authorization: Bearer <token>" \
  -F "file=@license.jpg"
```

## Next Steps

This completes Task 2 of the implementation plan. Next tasks:

**Task 3:** Location tracking APIs
- POST `/driver/location` - Receive GPS updates
- WebSocket real-time location broadcasting
- Kalman filter for GPS smoothing

**Task 4:** Order and delivery workflow APIs
- GET `/driver/orders/available` - Available orders
- POST `/driver/orders/:id/accept` - Accept delivery
- Workflow state transitions

**Task 5:** Push notification service
- FCM/APNs integration
- Device token management
- Admin broadcast capabilities