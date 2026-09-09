/**
 * App Module
 *
 * Bootstraps the United Pharmacy API with:
 * - ConfigModule (global)
 * - ScheduleModule (for the outbox worker cron)
 * - EventEmitterModule (event-driven notification dispatch)
 * - NotificationsModule (push channel + expo provider + notification service)
 * - NotificationWorker (background outbox processor)
 *
 * NOTE: BullMQ queue infrastructure is wired here for future use.
 * The current notification pipeline uses the Supabase outbox table with
 * a cron-based worker — no Redis queue is required for the outbox path.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationWorker } from './worker/notification.worker';

// Import other domain modules as they are added, e.g.:
// import { AuthModule } from './modules/auth/auth.module';
// import { OrdersModule } from './modules/orders/orders.module';
// import { DriverModule } from './modules/driver/driver.module';

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

    // ── Notification feature module ────────────────────────────────────────
    NotificationsModule,

    // ── Domain modules (uncomment as they are introduced) ─────────────────
    // AuthModule,
    // OrdersModule,
    // DriverModule,
  ],
  providers: [
    // Background outbox processor – runs inside the main NestJS process.
    // Start the main app (nest start) and this worker boots automatically.
    NotificationWorker,
  ],
})
export class AppModule {}