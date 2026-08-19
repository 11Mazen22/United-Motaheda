import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdminAuthGuard } from '../../auth/admin-auth.guard';

@Controller('admin/inventory')
@UseGuards(AdminAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.inventoryService.list(parseInt(page, 10), parseInt(limit, 10));
  }
}
