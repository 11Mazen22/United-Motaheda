import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { BranchesModule } from "./modules/branches/branches.module";
import { DeliveryModule } from "./modules/delivery/delivery.module";

// Note: an OrdersModule (unauthenticated POST /orders, never set orders.user_id)
// used to be registered here. Both clients now create orders via the
// Supabase `create-order` Edge Function instead (authenticated, sets
// user_id correctly — see apps/shopper-native/src/features/checkout/api.ts
// and apps/shopper-web/src/services/shopperCheckoutApi.ts), so it was
// removed rather than left live and reachable with no auth guard.
@Module({
  imports: [PrismaModule, BranchesModule, DeliveryModule],
})
export class AppModule {}
