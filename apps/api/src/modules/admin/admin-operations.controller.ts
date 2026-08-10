import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from '../../auth/admin-auth.guard';
import { AdminOperationsService } from './admin-operations.service';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get('drivers')
  listDrivers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.operations.listDrivers(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('drivers/:id')
  getDriver(@Param('id') id: string) {
    return this.operations.getDriver(id);
  }

  @Patch('drivers/:id/approve')
  approveDriver(@Param('id') id: string, @Request() req: any) {
    return this.operations.approveDriver(id, req.user?.userId);
  }

  @Patch('drivers/:id/reject')
  rejectDriver(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req: any) {
    return this.operations.rejectDriver(id, body?.reason, req.user?.userId);
  }

  @Patch('drivers/:id/suspend')
  suspendDriver(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req: any) {
    return this.operations.suspendDriver(id, body?.reason, req.user?.userId);
  }

  @Get('orders')
  listOrders(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.operations.listOrders(Number(page) || 1, Number(limit) || 20, status);
  }

  @Post('orders/:id/assign')
  assignOrder(@Param('id') id: string, @Body() body: { driverId?: string }, @Request() req: any) {
    return this.operations.assignOrder(id, body?.driverId, req.user?.userId);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body() body: { status?: string }, @Request() req: any) {
    return this.operations.updateOrderStatus(id, body?.status, req.user?.userId);
  }

  @Get('stats')
  getStats() {
    return this.operations.getStats();
  }
}