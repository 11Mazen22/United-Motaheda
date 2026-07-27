import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { PromotionCopilotModule } from "./modules/promotion-copilot/promotion-copilot.module";
import { DriverModule } from "./modules/driver/driver.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";

@Module({
  imports: [
    PrismaModule,
    BranchesModule,
    DeliveryModule,
    PromotionCopilotModule,
    DriverModule,
    NotificationsModule,
  ],
})
export class AppModule {}
