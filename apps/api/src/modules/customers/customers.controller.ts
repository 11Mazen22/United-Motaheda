import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { AdminAuthGuard } from '../../auth/admin-auth.guard';

@Controller('admin/customers')
@UseGuards(AdminAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.customersService.list(parseInt(page, 10), parseInt(limit, 10));
  }
}
