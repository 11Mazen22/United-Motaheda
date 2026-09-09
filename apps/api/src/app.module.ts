/**
 * App Module
 *
 * The Centralized Notification Hub commit (87aa5f6e) replaced this file
 * wholesale with a notifications-only version instead of adding to the
 * existing one, silently dropping every other domain module (Branches,
 * Delivery, PromotionCopilot, Driver, Auth, Admin, Products, Inventory,
 * Customers) from the running app — confirmed by diffing against the
 * pre-regression version at 8cdbe565. Restored here alongside the
 * notification-hub additions (ConfigModule/ScheduleModule/EventEmitterModule/
 * NotificationWorker), which are legitimate and kept as-is.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from './prisma/prisma.module';
import { BranchesModule } from './modules/branches/branches.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { PromotionCopilotModule } from './modules/promotion-copilot/promotion-copilot.module';
import { DriverModule } from './modules/driver/driver.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CustomersModule } from './modules/customers/customers.module';
import { NotificationWorker } from './worker/notification.worker';

@Module({
  imports: [
    // ── Config ────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Scheduler (powers @Cron in NotificationWorker) ────────────────────
    ScheduleModule.forRoot(),

    // ── Event bus (used by NotificationsService for analytics events) ──────
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // ── Domain modules ──────────────────────────────────────────────────────
    PrismaModule,
    BranchesModule,
    DeliveryModule,
    PromotionCopilotModule,
    DriverModule,
    NotificationsModule,
    AuthModule,
    AdminModule,
    ProductsModule,
    InventoryModule,
    CustomersModule,
  ],
  providers: [
    // Background outbox processor – runs inside the main NestJS process.
    // Start the main app (nest start) and this worker boots automatically.
    NotificationWorker,
  ],
})
export class AppModule {}