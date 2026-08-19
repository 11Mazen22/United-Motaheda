import { Module } from "@nestjs/common";
import { BranchesController, AdminBranchesController } from "./branches.controller";
import { BranchesService } from "./branches.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuthModule } from "../../auth/auth.module";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BranchesController, AdminBranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
