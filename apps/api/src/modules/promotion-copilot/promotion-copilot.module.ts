import { Module } from "@nestjs/common";
import { PromotionCopilotController } from "./promotion-copilot.controller";
import { PromotionCopilotService } from "./promotion-copilot.service";
import { PromotionCopilotToolsService } from "./promotion-copilot-tools.service";

@Module({
  controllers: [PromotionCopilotController],
  providers: [PromotionCopilotService, PromotionCopilotToolsService],
})
export class PromotionCopilotModule {}
