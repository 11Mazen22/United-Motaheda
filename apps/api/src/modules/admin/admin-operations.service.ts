import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

function addressText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const address = value as Record<string, unknown>;
  if (typeof address.formatted === 'string') return address.formatted;
  return [address.streetLine, address.street, address.buildingNumber, address.building, address.city]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');
}

const CANONICAL_ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ['verification', 'cancelled'],
  verification: ['payment_pending', 'payment_approved', 'cancelled'],
  payment_pending: ['payment_approved', 'cancelled'],
  payment_approved: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['driver_assigned', 'cancelled'],
  driver_assigned: ['driver_accepted', 'cancelled'],
  driver_accepted: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

const LEGACY_STATUS_ALIASES: Record<string, string> = {
  processing: 'preparing',
  shipped: 'out_for_delivery',
  picked_up: 'out_for_delivery',
  confirmed: 'payment_approved',
  pending_payment: 'payment_pending',
};

function normalizeOrderStatus(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  return LEGACY_STATUS_ALIASES[normalized] ?? normalized;
}

@Injectable()
export class AdminOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listDrivers(page = 1, limit = 20, status?: string) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = status ? { status: status as any } : {};
    const [total, drivers] = await this.prisma.$transaction([
      this.prisma.driverProfile.count({ where }),
      this.prisma.driverProfile.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      drivers: drivers.map((driver) => this.mapDriver(driver)),
    };
  }

  async getDriver(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.mapDriver(driver);
  }

  async approveDriver(driverId: string, adminUserId?: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.driverProfile.update({
        where: { id: driverId },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          approvedBy: adminUserId ?? null,
          rejectionReason: null,
          updatedAt: now,
        },
      });

      await tx.profiles.update({
        where: { id: driver.userId },
        data: {
          status: 'Active',
          updated_at: now,
        },
      });
    });

    return { success: true, message: 'Driver approved', driverId, status: 'APPROVED' };
  }

  async rejectDriver(driverId: string, reason?: string, adminUserId?: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const now = new Date();
    const rejectionReason = reason?.trim() || 'Application did not meet platform requirements';

    await this.prisma.$transaction(async (tx) => {
      await tx.driverProfile.update({
        where: { id: driverId },
        data: {
          status: 'REJECTED',
          approvedAt: null,
          approvedBy: adminUserId ?? null,
          rejectionReason,
          updatedAt: now,
        },
      });

      await tx.profiles.update({
        where: { id: driver.userId },
        data: {
          status: 'Inactive',
          updated_at: now,
        },
      });
    });

    return { success: true, message: 'Driver rejected', driverId, status: 'REJECTED', reason: rejectionReason };
  }

  async suspendDriver(driverId: string, reason?: string, adminUserId?: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const now = new Date();
    const suspensionReason = reason?.trim() || 'Administrative suspension';

    await this.prisma.$transaction(async (tx) => {
      await tx.driverProfile.update({
        where: { id: driverId },
        data: {
          status: 'SUSPENDED',
          rejectionReason: suspensionReason,
          updatedAt: now,
          approvedBy: adminUserId ?? null,
        },
      });

      await tx.profiles.update({
        where: { id: driver.userId },
        data: {
          status: 'Suspended',
          updated_at: now,
        },
      });
    });

    return { success: true, message: 'Driver suspended', driverId, status: 'SUSPENDED', reason: suspensionReason };
  }

  async assignOrder(orderId: string, driverId?: string, adminUserId?: string) {
    if (!driverId) throw new BadRequestException('driverId is required');

    const order = await this.prisma.orders.findUnique({
      where: { id: orderId },
      include: { order_items: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const resolvedDriver = await this.prisma.driverProfile.findFirst({
      where: {
        OR: [{ id: driverId }, { userId: driverId }],
      },
      include: { user: true },
    });
    if (!resolvedDriver) throw new NotFoundException('Driver not found');

    const allowedDriverStatuses = ['APPROVED', 'ACTIVE'];
    if (!allowedDriverStatuses.includes(resolvedDriver.status)) {
      throw new ConflictException('Driver is not eligible to receive assignments');
    }

    if (order.assigned_driver_id && order.assigned_driver_id !== resolvedDriver.userId) {
      throw new ConflictException('Order is already assigned to another driver');
    }

    const allowedOrderStatuses = ['ready', 'driver_assigned', 'driver_accepted'];
    if (!allowedOrderStatuses.includes(order.status as string)) {
      throw new BadRequestException('Order is not in an assignable lifecycle state');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.deliveryAssignment.upsert({
        where: { orderId },
        update: {
          driverId: resolvedDriver.id,
          status: 'ASSIGNED',
          assignedAt: now,
          acceptedAt: null,
          rejectedAt: null,
          cancellationReason: null,
          updatedAt: now,
        },
        create: {
          orderId,
          driverId: resolvedDriver.id,
          pharmacyName: 'Main Pharmacy Branch',
          pharmacyLat: 30.0444,
          pharmacyLng: 31.2357,
          pharmacyAddress: '123 Cairo Street, Cairo, Egypt',
          baseFee: 15,
          distanceFee: 0,
          totalEarnings: 15,
          status: 'ASSIGNED',
          assignedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });

      const updatedOrder = await tx.orders.update({
        where: { id: orderId },
        data: {
          assigned_driver_id: resolvedDriver.userId,
          status: 'driver_assigned' as any,
          last_status_at: now,
          updated_at: now,
        },
      });

      return updatedOrder;
    });

    return {
      success: true,
      message: 'Driver assigned successfully',
      orderId,
      driverId: resolvedDriver.userId,
      status: result.status,
    };
  }

  async updateOrderStatus(orderId: string, nextStatus?: string, adminUserId?: string) {
    if (!nextStatus) throw new BadRequestException('status is required');

    const normalized = normalizeOrderStatus(nextStatus);
    const current = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (!current) throw new NotFoundException('Order not found');

    const allowed = CANONICAL_ORDER_TRANSITIONS[current.status as string] ?? [];
    if (!allowed.includes(normalized)) {
      throw new BadRequestException(`Illegal order transition from ${current.status} to ${normalized}`);
    }

    const updated = await this.prisma.orders.update({
      where: { id: orderId },
      data: {
        status: normalized as any,
        last_status_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Order status updated',
      orderId,
      from: current.status,
      to: updated.status,
    };
  }

  async listOrders(page = 1, limit = 20, status?: string) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = status ? { status: normalizeOrderStatus(status) as any } : {};
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.orders.count({ where }),
      this.prisma.orders.findMany({
        where,
        include: { order_items: true },
        orderBy: { created_at: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);

    return {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
      orders: orders.map((order) => ({
        id: order.id,
        external_ref: order.external_ref,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: addressText(order.customer_address),
        customer_lat: order.customer_lat ? Number(order.customer_lat) : null,
        customer_lng: order.customer_lng ? Number(order.customer_lng) : null,
        status: order.status,
        assigned_driver_id: order.assigned_driver_id,
        subtotal: order.subtotal.toString(),
        shipping_fee: order.shipping_fee.toString(),
        total: order.total.toString(),
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        note: order.note,
        created_at: order.created_at,
        updated_at: order.updated_at,
        last_status_at: order.last_status_at,
        order_items: order.order_items,
      })),
    };
  }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeStatuses = ['driver_assigned', 'driver_accepted', 'out_for_delivery'] as any;

    const [activeDeliveries, todayDeliveries, revenue] = await this.prisma.$transaction([
      this.prisma.orders.count({ where: { status: { in: activeStatuses } } }),
      this.prisma.orders.count({ where: { status: 'delivered', updated_at: { gte: today } } }),
      this.prisma.orders.aggregate({
        where: { status: 'delivered', updated_at: { gte: today } },
        _sum: { total: true },
      }),
    ]);

    return {
      activeDeliveries,
      todayDeliveries,
      todayRevenue: revenue._sum.total?.toString() ?? '0',
    };
  }

  private mapDriver(driver: any) {
    return {
      id: driver.user.id,
      fullName: driver.user.full_name,
      email: driver.user.email,
      phone: driver.user.phone,
      role: driver.user.role,
      driverProfile: {
        id: driver.id,
        status: driver.status,
        vehicleType: driver.vehicleType,
        vehiclePlate: driver.vehiclePlate,
        vehicleModel: driver.vehicleModel,
        vehicleColor: driver.vehicleColor,
        rating: driver.rating.toString(),
        totalDeliveries: driver.totalDeliveries,
        totalEarnings: driver.totalEarnings.toString(),
        completionRate: driver.completionRate.toString(),
        licensePhotoUrl: driver.licensePhotoUrl,
        idPhotoUrl: driver.idPhotoUrl,
        vehiclePhotoUrl: driver.vehiclePhotoUrl,
        insurancePhotoUrl: driver.insurancePhotoUrl,
        rejectionReason: driver.rejectionReason,
        isOnline: driver.isOnline,
        currentLat: driver.currentLat,
        currentLng: driver.currentLng,
        lastLocationAt: driver.lastLocationAt,
      },
    };
  }
}