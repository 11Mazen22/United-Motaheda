/**
 * Order Events
 * 
 * Strongly typed event classes for order-related events.
 * Used with NestJS Event Emitter for decoupled architecture.
 * 
 * Events:
 * - OrderCreatedEvent
 * - OrderReadyEvent
 * - OrderAcceptedEvent
 * - OrderOutForDeliveryEvent
 * - OrderDeliveredEvent
 * - OrderCancelledEvent
 * - DriverAssignedEvent
 * - DriverArrivedEvent
 */

export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly totalAmount?: number,
    public readonly itemsCount?: number,
  ) {}

  getEventName(): string {
    return 'order.created';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      totalAmount: this.totalAmount,
      itemsCount: this.itemsCount,
    };
  }
}

export class OrderReadyEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly userName: string,
    public readonly pickupLocation?: string,
  ) {}

  getEventName(): string {
    return 'order.ready';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      userName: this.userName,
      pickupLocation: this.pickupLocation,
    };
  }
}

export class OrderAcceptedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly driverName: string,
    public readonly driverPhone?: string,
    public readonly eta?: number,
  ) {}

  getEventName(): string {
    return 'order.accepted';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      driverName: this.driverName,
      driverPhone: this.driverPhone,
      eta: this.eta,
    };
  }
}

export class OrderOutForDeliveryEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly driverName: string,
    public readonly eta: number,
    public readonly driverPhone?: string,
    public readonly driverLocation?: { lat: number; lng: number },
  ) {}

  getEventName(): string {
    return 'order.out_for_delivery';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      driverName: this.driverName,
      eta: this.eta,
      driverPhone: this.driverPhone,
      driverLocation: this.driverLocation,
    };
  }
}

export class OrderDeliveredEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly deliveryTime?: Date,
  ) {}

  getEventName(): string {
    return 'order.delivered';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      deliveryTime: this.deliveryTime,
    };
  }
}

export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly reason?: string,
  ) {}

  getEventName(): string {
    return 'order.cancelled';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      reason: this.reason,
    };
  }
}

export class DriverAssignedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly driverName: string,
    public readonly driverPhone?: string,
    public readonly pickupLocation?: string,
  ) {}

  getEventName(): string {
    return 'driver.assigned';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      driverName: this.driverName,
      driverPhone: this.driverPhone,
      pickupLocation: this.pickupLocation,
    };
  }
}

export class DriverArrivedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly driverName: string,
    public readonly pickupLocation?: string,
  ) {}

  getEventName(): string {
    return 'driver.arrived';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      driverName: this.driverName,
      pickupLocation: this.pickupLocation,
    };
  }
}

/**
 * Payment Events
 */
export class PaymentSuccessEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly amount: string,
    public readonly paymentMethod?: string,
  ) {}

  getEventName(): string {
    return 'payment.success';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      amount: this.amount,
      paymentMethod: this.paymentMethod,
    };
  }
}

export class PaymentFailedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly orderNumber: string,
    public readonly amount: string,
    public readonly reason?: string,
  ) {}

  getEventName(): string {
    return 'payment.failed';
  }

  toJSON(): Record<string, any> {
    return {
      orderId: this.orderId,
      userId: this.userId,
      orderNumber: this.orderNumber,
      amount: this.amount,
      reason: this.reason,
    };
  }
}