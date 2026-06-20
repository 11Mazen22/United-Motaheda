import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";
import { OrdersModule } from "./modules/orders/orders.module";

@Module({
  imports: [PrismaModule, BranchesModule, DeliveryModule, OrdersModule],
})
export class AppModule {}
