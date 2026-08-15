import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AcceptOrderDto,
  RejectOrderDto,
  ArrivedPharmacyDto,
  PickedUpDto,
  ArrivedCustomerDto,
  CompleteDeliveryDto,
} from './dto';
import { LocationBroadcastGateway } from './location-broadcast.gateway';

// Pharmacy location — in production this comes from the Branch table
const DEFAULT_PHARMACY = {
  name: 'Main Pharmacy Branch',
  lat: 30.0444,
  lng: 31.2357,
  address: '123 Cairo Street, Cairo, Egypt',
};

// Base delivery fee in EGP
const BASE_DELIVERY_FEE = 15;

// Geofence radius in meters for arrival checks
const ARRIVAL_RADIUS_METERS = 200;

/** Haversine distance between two coordinates in metres */
function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class DriverOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: LocationBroadcastGateway,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async getDriverProfile(userId: string) {
    const profile = await this.prisma.profiles.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });
    if (!profile?.driverProfile)
      throw new NotFoundException('Driver profile not found');
    return profile;
  }

  private requireOnline(isOnline: boolean) {
    if (!isOnline) throw new ForbiddenException('Driver must be online');
  }

  // ─── Available Orders ─────────────────────────────────────────────────────

  /**
   * GET /driver/orders/available
   * Returns "ready" orders not yet assigned, sorted nearest-first when
   * the driver's coordinates are available.
   */
  async getAvailableOrders(userId: string) {
    const profile = await this.getDriverProfile(userId);
    this.requireOnline(profile.driverProfile!.isOnline);

    // Get orders that are ready and not currently assigned.
    // Include orders that were previously rejected/cancelled (they can be retried).
    const orders = await this.prisma.orders.findMany({
      where: {
        status: 'ready',
        assigned_driver_id: null,
        OR: [
          { deliveryAssignment: null },
          {
            deliveryAssignment: {
              status: { in: ['REJECTED', 'CANCELLED', 'FAILED'] },
            },
          },
        ],
      },
      include: { order_items: true },
      orderBy: { created_at: 'asc' },
    });

    const driverLat = profile.driverProfile!.currentLat;
    const driverLng = profile.driverProfile!.currentLng;

    const mapped = orders.map((order) => {
      const customerLat = order.customer_lat
        ? Number(order.customer_lat)
        : null;
      const customerLng = order.customer_lng
        ? Number(order.customer_lng)
        : null;

      // Straight-line distance from driver → pharmacy (pickup)
      const distanceToPickup =
        driverLat && driverLng
          ? Math.round(
              haversineMeters(
                driverLat,
                driverLng,
                DEFAULT_PHARMACY.lat,
                DEFAULT_PHARMACY.lng,
              ),
            )
          : null;

      // Pharmacy → customer (delivery leg)
      const distanceToCustomer =
        customerLat && customerLng
          ? Math.round(
              haversineMeters(
                DEFAULT_PHARMACY.lat,
                DEFAULT_PHARMACY.lng,
                customerLat,
                customerLng,
              ),
            )
          : null;

      const totalDistanceKm =
        distanceToPickup && distanceToCustomer
          ? Math.round((distanceToPickup + distanceToCustomer) / 100) / 10
          : null;

      const estimatedEarnings = BASE_DELIVERY_FEE + (totalDistanceKm ? totalDistanceKm * 2 : 0);

      return {
        id: order.id,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        customerLat,
        customerLng,
        itemCount: order.order_items.length,
        subtotal: order.subtotal.toString(),
        total: order.total.toString(),
        paymentMethod: order.payment_method,
        note: order.note,
        createdAt: order.created_at,
        pharmacy: {
          name: DEFAULT_PHARMACY.name,
          lat: DEFAULT_PHARMACY.lat,
          lng: DEFAULT_PHARMACY.lng,
          address: DEFAULT_PHARMACY.address,
        },
        estimatedEarnings: Math.round(estimatedEarnings * 100) / 100,
        distanceToPickupMeters: distanceToPickup,
        distanceToCustomerMeters: distanceToCustomer,
        totalDistanceKm,
        estimatedMinutes: totalDistanceKm ? Math.ceil(totalDistanceKm * 3) + 10 : null,
      };
    });

    // Sort by distance to pickup when available
    if (driverLat && driverLng) {
      mapped.sort(
        (a, b) =>
          (a.distanceToPickupMeters ?? Infinity) -
          (b.distanceToPickupMeters ?? Infinity),
      );
    }

    return { count: mapped.length, orders: mapped };
  }

  // ─── Accept Order ─────────────────────────────────────────────────────────

  async acceptOrder(userId: string, orderId: string, dto: AcceptOrderDto) {
    const profile = await this.getDriverProfile(userId);
    this.requireOnline(profile.driverProfile!.isOnline);

    // Check driver has no active delivery
    const activeDelivery = await this.prisma.deliveryAssignment.findFirst({
      where: {
        driverId: profile.driverProfile!.id,
        status: {
          in: ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PHARMACY',
               'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'ARRIVED_AT_CUSTOMER'],
        },
      },
    });
    if (activeDelivery)
      throw new ConflictException('You already have an active delivery');

    // Lock & fetch the order in a transaction
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({
        where: { id: orderId },
        include: { order_items: true },
      });

      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'ready')
        throw new BadRequestException('Order is no longer available');
      if (order.assigned_driver_id)
        throw new ConflictException('Order already assigned to another driver');

      const totalDistanceKm = order.customer_lat && order.customer_lng
        ? Math.round(
            haversineMeters(
              DEFAULT_PHARMACY.lat, DEFAULT_PHARMACY.lng,
              Number(order.customer_lat), Number(order.customer_lng),
            ) / 100,
          ) / 10
        : 5; // default 5 km

      const distanceFee  = totalDistanceKm * 2;
      const totalEarnings = BASE_DELIVERY_FEE + distanceFee;

      // Create delivery assignment
      const assignment = await tx.deliveryAssignment.create({
        data: {
          orderId: order.id,
          driverId: profile.driverProfile!.id,
          pharmacyName:    DEFAULT_PHARMACY.name,
          pharmacyLat:     DEFAULT_PHARMACY.lat,
          pharmacyLng:     DEFAULT_PHARMACY.lng,
          pharmacyAddress: DEFAULT_PHARMACY.address,
          baseFee:          BASE_DELIVERY_FEE,
          distanceFee,
          totalEarnings,
          status:           'ACCEPTED',
          acceptedAt:       new Date(),
          estimatedDistance: totalDistanceKm,
          estimatedDuration: Math.ceil(totalDistanceKm * 3) + 10,
        },
      });

      // Update order to the canonical driver-accepted lifecycle state.
      await tx.orders.update({
        where: { id: orderId },
        data: {
          assigned_driver_id: profile.id,
          status: 'driver_accepted' as any,
          last_status_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Broadcast update to admin
      this.gateway.sendToAdmins('order-assigned', {
        orderId,
        driverId:   profile.driverProfile!.id,
        driverName: profile.full_name,
        assignedAt: assignment.assignedAt,
      });

      return {
        message: 'Order accepted successfully',
        assignment: {
          id: assignment.id,
          orderId,
          status: assignment.status,
          pharmacyName:    assignment.pharmacyName,
          pharmacyLat:     assignment.pharmacyLat,
          pharmacyLng:     assignment.pharmacyLng,
          pharmacyAddress: assignment.pharmacyAddress,
          estimatedDistance: assignment.estimatedDistance,
          estimatedDuration: assignment.estimatedDuration,
          estimatedEarnings: assignment.totalEarnings.toString(),
        },
        order: {
          id:              order.id,
          customerName:    order.customer_name,
          customerPhone:   order.customer_phone,
          customerAddress: order.customer_address,
          customerLat:     order.customer_lat ? Number(order.customer_lat) : null,
          customerLng:     order.customer_lng ? Number(order.customer_lng) : null,
          itemCount:       order.order_items.length,
          total:           order.total.toString(),
          paymentMethod:   order.payment_method,
          note:            order.note,
        },
      };
    });
  }

  // ─── Reject Order ─────────────────────────────────────────────────────────

  async rejectOrder(userId: string, orderId: string, dto: RejectOrderDto) {
    const profile = await this.getDriverProfile(userId);
    this.requireOnline(profile.driverProfile!.isOnline);

    // Check for an assigned (not yet accepted) delivery
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: { orderId, driverId: profile.driverProfile!.id, status: 'ASSIGNED' },
    });
    if (!assignment)
      throw new NotFoundException('No pending assignment found for this order');

    await this.prisma.$transaction([
      this.prisma.deliveryAssignment.update({
        where: { id: assignment.id },
        data: { status: 'REJECTED', rejectedAt: new Date(), cancellationReason: dto.reason },
      }),
      this.prisma.orders.update({
        where: { id: orderId },
        data: { assigned_driver_id: null, status: 'ready', last_status_at: new Date() },
      }),
    ]);

    return { message: 'Order rejected' };
  }

  // ─── Active Delivery ──────────────────────────────────────────────────────

  async getActiveDelivery(userId: string) {
    const profile = await this.getDriverProfile(userId);

    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: {
        driverId: profile.driverProfile!.id,
        status: {
          in: ['ACCEPTED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PHARMACY',
               'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', 'ARRIVED_AT_CUSTOMER'],
        },
      },
      include: {
        order: { include: { order_items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!assignment) return { activeDelivery: null };

    return {
      activeDelivery: {
        assignmentId:    assignment.id,
        status:          assignment.status,
        pharmacyName:    assignment.pharmacyName,
        pharmacyLat:     assignment.pharmacyLat,
        pharmacyLng:     assignment.pharmacyLng,
        pharmacyAddress: assignment.pharmacyAddress,
        assignedAt:      assignment.assignedAt,
        acceptedAt:      assignment.acceptedAt,
        estimatedEarnings: assignment.totalEarnings.toString(),
        order: {
          id:              assignment.order.id,
          customerName:    assignment.order.customer_name,
          customerPhone:   assignment.order.customer_phone,
          customerAddress: assignment.order.customer_address,
          customerLat:     assignment.order.customer_lat
            ? Number(assignment.order.customer_lat) : null,
          customerLng:     assignment.order.customer_lng
            ? Number(assignment.order.customer_lng) : null,
          itemCount:       assignment.order.order_items.length,
          items:           assignment.order.order_items.map(i => ({
            productId: i.product_id,
            quantity:  i.quantity.toString(),
            unitPrice: i.unit_price.toString(),
            snapshot:  i.product_snapshot,
          })),
          total:         assignment.order.total.toString(),
          paymentMethod: assignment.order.payment_method,
          note:          assignment.order.note,
        },
      },
    };
  }

  // ─── Workflow Transitions ─────────────────────────────────────────────────

  async markEnRouteToPickup(userId: string, orderId: string) {
    return this._transition(userId, orderId, 'ACCEPTED', 'EN_ROUTE_TO_PICKUP', {});
  }

  async markArrivedAtPharmacy(userId: string, orderId: string, dto: ArrivedPharmacyDto) {
    const profile = await this.getDriverProfile(userId);
    const assignment = await this._findAssignment(profile.driverProfile!.id, orderId, 'EN_ROUTE_TO_PICKUP');

    const dist = haversineMeters(dto.currentLat, dto.currentLng, assignment.pharmacyLat, assignment.pharmacyLng);
    if (dist > ARRIVAL_RADIUS_METERS)
      throw new BadRequestException(`You are ${Math.round(dist)}m from the pharmacy. You must be within ${ARRIVAL_RADIUS_METERS}m.`);

    await this.prisma.deliveryAssignment.update({
      where: { id: assignment.id },
      data: { status: 'ARRIVED_AT_PHARMACY', arrivedPharmacyAt: new Date() },
    });
    this._broadcastDeliveryUpdate(orderId, 'ARRIVED_AT_PHARMACY');
    return { message: 'Marked as arrived at pharmacy', status: 'ARRIVED_AT_PHARMACY' };
  }

  async markPickedUp(userId: string, orderId: string, dto: PickedUpDto) {
    return this._transition(userId, orderId, 'ARRIVED_AT_PHARMACY', 'PICKED_UP', {
      pickedUpAt: new Date(),
      ...(dto.notes && { deliveryNotes: dto.notes }),
    });
  }

  async markEnRouteToCustomer(userId: string, orderId: string) {
    return this._transition(userId, orderId, 'PICKED_UP', 'EN_ROUTE_TO_CUSTOMER', {});
  }

  async markArrivedAtCustomer(userId: string, orderId: string, dto: ArrivedCustomerDto) {
    const profile = await this.getDriverProfile(userId);
    const assignment = await this._findAssignment(profile.driverProfile!.id, orderId, 'EN_ROUTE_TO_CUSTOMER');

    const order = await this.prisma.orders.findUnique({ where: { id: orderId } });
    if (order?.customer_lat && order?.customer_lng) {
      const dist = haversineMeters(
        dto.currentLat, dto.currentLng,
        Number(order.customer_lat), Number(order.customer_lng),
      );
      if (dist > ARRIVAL_RADIUS_METERS)
        throw new BadRequestException(`You are ${Math.round(dist)}m from the customer. You must be within ${ARRIVAL_RADIUS_METERS}m.`);
    }

    await this.prisma.deliveryAssignment.update({
      where: { id: assignment.id },
      data: { status: 'ARRIVED_AT_CUSTOMER', arrivedCustomerAt: new Date() },
    });
    this._broadcastDeliveryUpdate(orderId, 'ARRIVED_AT_CUSTOMER');
    return { message: 'Marked as arrived at customer', status: 'ARRIVED_AT_CUSTOMER' };
  }

  async completeDelivery(userId: string, orderId: string, dto: CompleteDeliveryDto) {
    const profile = await this.getDriverProfile(userId);
    const assignment = await this._findAssignment(
      profile.driverProfile!.id, orderId, 'ARRIVED_AT_CUSTOMER',
    );

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // Update assignment
      await tx.deliveryAssignment.update({
        where: { id: assignment.id },
        data: {
          status:            'DELIVERED',
          deliveredAt:       now,
          proofPhotoUrl:     dto.proofPhotoUrl,
          customerSignature: dto.customerSignature,
          deliveryNotes:     dto.deliveryNotes,
          customerRating:    dto.customerRating,
          customerFeedback:  dto.customerFeedback,
          actualDuration:    assignment.assignedAt
            ? Math.floor((now.getTime() - assignment.assignedAt.getTime()) / 60000)
            : null,
        },
      });

      // Update order status
      await tx.orders.update({
        where: { id: orderId },
        data: { status: 'delivered', last_status_at: now },
      });

      // Create earnings record
      await tx.driverEarning.create({
        data: {
          driverId:    profile.driverProfile!.id,
          deliveryId:  assignment.id,
          baseFee:     assignment.baseFee,
          distanceFee: assignment.distanceFee,
          tipAmount:   assignment.tipAmount,
          bonusAmount: assignment.bonusAmount,
          totalAmount: assignment.totalEarnings,
          earnedAt:    now,
        },
      });

      // Update driver profile counters
      await tx.driverProfile.update({
        where: { id: profile.driverProfile!.id },
        data: {
          totalDeliveries: { increment: 1 },
          totalEarnings:   { increment: assignment.totalEarnings },
          ...(dto.customerRating && {
            rating: {
              // Simple rolling average — replace with proper weighted avg in production
              set: parseFloat(
                (
                  (profile.driverProfile!.rating * profile.driverProfile!.totalDeliveries +
                    dto.customerRating) /
                  (profile.driverProfile!.totalDeliveries + 1)
                ).toFixed(2),
              ),
            },
          }),
        },
      });
    });

    this._broadcastDeliveryUpdate(orderId, 'DELIVERED');

    return {
      message: 'Delivery completed successfully',
      earnings: assignment.totalEarnings.toString(),
      status:   'DELIVERED',
    };
  }

  // ─── Delivery History ─────────────────────────────────────────────────────

  async getDeliveryHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const profile = await this.getDriverProfile(userId);
    const skip = (page - 1) * limit;

    const [total, assignments] = await this.prisma.$transaction([
      this.prisma.deliveryAssignment.count({
        where: { driverId: profile.driverProfile!.id, status: 'DELIVERED' },
      }),
      this.prisma.deliveryAssignment.findMany({
        where: { driverId: profile.driverProfile!.id, status: 'DELIVERED' },
        include: { order: { include: { order_items: true } } },
        orderBy: { deliveredAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      deliveries: assignments.map((a) => ({
        id:               a.id,
        orderId:          a.orderId,
        status:           a.status,
        customerName:     a.order.customer_name,
        customerAddress:  a.order.customer_address,
        itemCount:        a.order.order_items.length,
        earnings:         a.totalEarnings.toString(),
        customerRating:   a.customerRating,
        deliveredAt:      a.deliveredAt,
        actualDuration:   a.actualDuration,
        actualDistance:   a.actualDistance,
      })),
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async _findAssignment(driverId: string, orderId: string, expectedStatus: string) {
    const assignment = await this.prisma.deliveryAssignment.findFirst({
      where: { driverId, orderId, status: expectedStatus as any },
    });
    if (!assignment)
      throw new NotFoundException(
        `No delivery in status ${expectedStatus} found for this order`,
      );
    return assignment;
  }

  private async _transition(
    userId: string,
    orderId: string,
    fromStatus: string,
    toStatus: string,
    extra: Record<string, any>,
  ) {
    const profile = await this.getDriverProfile(userId);
    const assignment = await this._findAssignment(
      profile.driverProfile!.id, orderId, fromStatus,
    );

    const nextOrderStatus = {
      ACCEPTED: 'driver_accepted',
      EN_ROUTE_TO_PICKUP: 'driver_accepted',
      ARRIVED_AT_PHARMACY: 'driver_accepted',
      PICKED_UP: 'out_for_delivery',
      EN_ROUTE_TO_CUSTOMER: 'out_for_delivery',
      ARRIVED_AT_CUSTOMER: 'out_for_delivery',
      DELIVERED: 'delivered',
    }[toStatus] as string | undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.deliveryAssignment.update({
        where: { id: assignment.id },
        data: { status: toStatus as any, ...extra },
      });

      if (nextOrderStatus) {
        await tx.orders.update({
          where: { id: orderId },
          data: {
            status: nextOrderStatus as any,
            last_status_at: new Date(),
            updated_at: new Date(),
          },
        });
      }
    });

    this._broadcastDeliveryUpdate(orderId, toStatus);
    return { message: `Status updated to ${toStatus}`, status: toStatus };
  }

  private _broadcastDeliveryUpdate(orderId: string, status: string) {
    try {
      this.gateway.sendToAdmins('delivery-status-update', { orderId, status, at: new Date() });
    } catch (_) {
      // Non-critical — don't fail the request
    }
  }
}
