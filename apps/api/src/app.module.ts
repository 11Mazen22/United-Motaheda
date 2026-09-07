/**
 * App Module - Updated with BullMQ Queue Support & Event Emitter
 * 
 * Adds:
 * - BullModule for Redis queue
 * - EventEmitterModule for event-driven architecture
 * - Notification Processor
 * - Batch Processor
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';

// ============================================================
// Import your existing modules
// ============================================================
// import { AuthModule } from './modules/auth/auth.module';
// import { OrdersModule } from './modules/orders/orders.module';
// import { ProductsModule } from './modules/products/products.module';
// ... etc

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    
    // ============================================================
    // 🆕 BullMQ Queue Setup for Notifications
    // ============================================================
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
          db: configService.get('REDIS_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),

    // ============================================================
    // 🆕 Register Queues for Notifications
    // ============================================================
    BullModule.registerQueue({
      name: 'notifications',
    }),
    BullModule.registerQueue({
      name: 'batches',
    }),

    // ============================================================
    // 🆕 Event Emitter for Event-Driven Architecture
    // ============================================================
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // ============================================================
    // Your existing modules
    // ============================================================
    // AuthModule,
    // OrdersModule,
    // ProductsModule,
    // UsersModule,
    // NotificationsModule,
    // ... etc
  ],
  providers: [
    // ... existing providers
  ],
})
export class AppModule {}