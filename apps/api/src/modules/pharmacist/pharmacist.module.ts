import { Module } from "@nestjs/common";
import { PharmacistController } from "./pharmacist.controller";
import { PharmacistService } from "./pharmacist.service";

@Module({
  controllers: [PharmacistController],
  providers:   [PharmacistService],
})
export class PharmacistModule {}
