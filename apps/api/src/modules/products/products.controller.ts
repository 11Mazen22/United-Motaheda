import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { AdminAuthGuard } from '../../auth/admin-auth.guard';

@Controller('admin/products')
@UseGuards(AdminAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.productsService.list(parseInt(page, 10), parseInt(limit, 10));
  }
}
