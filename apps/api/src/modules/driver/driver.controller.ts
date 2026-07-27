import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Param,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DriverAuthService } from './driver-auth.service';
import { DriverProfileService } from './driver-profile.service';
import { DriverLocationService } from './driver-location.service';
import { DriverOrdersService } from './driver-orders.service';
import { FileUploadService } from './file-upload.service';
import {
  RegisterDriverDto,
  LoginDriverDto,
  UpdateDriverProfileDto,
  LocationUpdateDto,
  AcceptOrderDto,
  RejectOrderDto,
  ArrivedPharmacyDto,
  PickedUpDto,
  ArrivedCustomerDto,
  CompleteDeliveryDto,
} from './dto';
import { DriverAuthGuard } from './guards/driver-auth.guard';

@Controller('driver')
export class DriverController {
  constructor(
    private readonly authService: DriverAuthService,
    private readonly profileService: DriverProfileService,
    private readonly locationService: DriverLocationService,
    private readonly ordersService: DriverOrdersService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  // ─── Auth ────────────────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDriverDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDriverDto) {
    return this.authService.login(dto);
  }

  // ─── Profile ─────────────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(DriverAuthGuard)
  async getProfile(@Request() req: any) {
    return this.profileService.getProfile(req.user.userId);
  }

  @Patch('profile')
  @UseGuards(DriverAuthGuard)
  async updateProfile(@Request() req: any, @Body() dto: UpdateDriverProfileDto) {
    return this.profileService.updateProfile(req.user.userId, dto);
  }

  @Get('statistics')
  @UseGuards(DriverAuthGuard)
  async getStatistics(@Request() req: any) {
    return this.profileService.getStatistics(req.user.userId);
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  @Post('status/online')
  @UseGuards(DriverAuthGuard)
  async goOnline(@Request() req: any) {
    this.locationService.resetDriverFilter(req.user.driverProfile?.id);
    return this.profileService.updateOnlineStatus(req.user.userId, true);
  }

  @Post('status/offline')
  @UseGuards(DriverAuthGuard)
  async goOffline(@Request() req: any) {
    this.locationService.cleanupDriverTracking(req.user.driverProfile?.id);
    return this.profileService.updateOnlineStatus(req.user.userId, false);
  }

  // ─── Location ─────────────────────────────────────────────────────────────

  @Post('location')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateLocation(@Request() req: any, @Body() dto: LocationUpdateDto) {
    return this.locationService.updateLocation(req.user.userId, dto);
  }

  @Get('location/current')
  @UseGuards(DriverAuthGuard)
  async getCurrentLocation(@Request() req: any) {
    return this.locationService.getCurrentLocation(req.user.userId);
  }

  @Get('location/history')
  @UseGuards(DriverAuthGuard)
  async getLocationHistory(@Request() req: any, @Query('limit') limit?: string) {
    return this.locationService.getLocationHistory(
      req.user.userId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ─── Documents ────────────────────────────────────────────────────────────

  @Post('documents/upload/:type')
  @UseGuards(DriverAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Request() req: any,
    @Param('type') type: string,
    @UploadedFile() file: any,
  ) {
    const allowed = ['license', 'id', 'vehicle', 'insurance'];
    if (!allowed.includes(type)) throw new BadRequestException('Invalid document type');
    if (!file) throw new BadRequestException('No file provided');

    const fileUrl = await this.fileUploadService.uploadDriverDocument(
      req.user.driverProfile?.id ?? req.user.userId,
      file,
      type as any,
    );

    const update: UpdateDriverProfileDto = {};
    if (type === 'license')   update.licensePhotoUrl   = fileUrl;
    if (type === 'id')        update.idPhotoUrl         = fileUrl;
    if (type === 'vehicle')   update.vehiclePhotoUrl    = fileUrl;
    if (type === 'insurance') update.insurancePhotoUrl  = fileUrl;

    await this.profileService.updateProfile(req.user.userId, update);
    return { message: `${type} document uploaded`, fileUrl, type };
  }

  // ─── Orders ───────────────────────────────────────────────────────────────

  @Get('orders/available')
  @UseGuards(DriverAuthGuard)
  async getAvailableOrders(@Request() req: any) {
    return this.ordersService.getAvailableOrders(req.user.userId);
  }

  @Get('orders/active')
  @UseGuards(DriverAuthGuard)
  async getActiveDelivery(@Request() req: any) {
    return this.ordersService.getActiveDelivery(req.user.userId);
  }

  @Get('orders/history')
  @UseGuards(DriverAuthGuard)
  async getDeliveryHistory(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getDeliveryHistory(
      req.user.userId,
      page  ? parseInt(page,  10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('orders/:orderId/accept')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acceptOrder(@Request() req: any, @Param('orderId') orderId: string, @Body() dto: AcceptOrderDto) {
    return this.ordersService.acceptOrder(req.user.userId, orderId, dto);
  }

  @Post('orders/:orderId/reject')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async rejectOrder(@Request() req: any, @Param('orderId') orderId: string, @Body() dto: RejectOrderDto) {
    return this.ordersService.rejectOrder(req.user.userId, orderId, dto);
  }

  @Post('orders/:orderId/en-route-pickup')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enRouteToPickup(@Request() req: any, @Param('orderId') orderId: string) {
    return this.ordersService.markEnRouteToPickup(req.user.userId, orderId);
  }

  @Post('orders/:orderId/arrived-pharmacy')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async arrivedPharmacy(@Request() req: any, @Param('orderId') orderId: string, @Body() dto: ArrivedPharmacyDto) {
    return this.ordersService.markArrivedAtPharmacy(req.user.userId, orderId, dto);
  }

  @Post('orders/:orderId/picked-up')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async pickedUp(@Request() req: any, @Param('orderId') orderId: string, @Body() dto: PickedUpDto) {
    return this.ordersService.markPickedUp(req.user.userId, orderId, dto);
  }

  @Post('orders/:orderId/en-route-customer')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enRouteToCustomer(@Request() req: any, @Param('orderId') orderId: string) {
    return this.ordersService.markEnRouteToCustomer(req.user.userId, orderId);
  }

  @Post('orders/:orderId/arrived-customer')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async arrivedCustomer(@Request() req: any, @Param('orderId') orderId: string, @Body() dto: ArrivedCustomerDto) {
    return this.ordersService.markArrivedAtCustomer(req.user.userId, orderId, dto);
  }

  @Post('orders/:orderId/complete')
  @UseGuards(DriverAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeDelivery(@Request() req: any, @Param('orderId') orderId: string, @Body() dto: CompleteDeliveryDto) {
    return this.ordersService.completeDelivery(req.user.userId, orderId, dto);
  }
}
