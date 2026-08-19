import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from "@nestjs/common";
import { BranchesService } from "./branches.service";
import { AdminAuthGuard } from '../../auth/admin-auth.guard';

@Controller("branches")
export class BranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  async listBranches() {
    return this.branches.listBranches();
  }
}

@Controller("admin/branches")
@UseGuards(AdminAuthGuard)
export class AdminBranchesController {
  constructor(private readonly branches: BranchesService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.branches.adminListBranches(parseInt(page, 10), parseInt(limit, 10));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.branches.getBranch(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.branches.createBranch(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.branches.updateBranch(id, body);
  }
}
