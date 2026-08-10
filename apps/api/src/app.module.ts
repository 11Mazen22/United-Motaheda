import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { PromotionCopilotModule } from "./modules/promotion-copilot/promotion-copilot.module";
import { DriverModule } from "./modules/driver/driver.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    PrismaModule,
    BranchesModule,
    DeliveryModule,
    PromotionCopilotModule,
    DriverModule,
    NotificationsModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
