/**
 * Notification Registry
 * 
 * Defines the strict dictionary of allowed notifications,
 * required payload data, default priorities, and supported channels.
 * 
 * This is the single source of truth for all notification types
 * in the entire system.
 */

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';
export type NotificationPriority = 'high' | 'normal' | 'low';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

/**
 * Notification type definition
 */
export interface NotificationTypeDefinition {
  /** Unique identifier for the notification type */
  type: string;
  
  /** Human-readable name */
  name: string;
  
  /** Description of when this notification is triggered */
  description: string;
  
  /** Default priority level */
  defaultPriority: NotificationPriority;
  
  /** Supported channels for this notification type */
  supportedChannels: NotificationChannel[];
  
  /** Required data fields that must be provided */
  requiredData: string[];
  
  /** Optional data fields that can be provided */
  optionalData?: string[];
  
  /** Whether this notification can be batched for bulk sending */
  batchable: boolean;
  
  /** Maximum age of data before notification should be considered stale (in minutes) */
  staleAfterMinutes?: number;
}

/**
 * Registry of all notification types
 */
export const NOTIFICATION_REGISTRY: Record<string, NotificationTypeDefinition> = {
  // ============================================================
  // ORDER NOTIFICATIONS
  // ============================================================

  'order.created': {
    type: 'order.created',
    name: 'Order Created',
    description: 'Triggered when a new order is created',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber'],
    optionalData: ['totalAmount', 'itemsCount'],
    batchable: false,
    staleAfterMinutes: 60,
  },

  'order.ready': {
    type: 'order.ready',
    name: 'Order Ready',
    description: 'Triggered when an order is ready for pickup',
    defaultPriority: 'high',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'userName'],
    optionalData: ['pickupLocation'],
    batchable: false,
    staleAfterMinutes: 30,
  },

  'order.accepted': {
    type: 'order.accepted',
    name: 'Order Accepted',
    description: 'Triggered when a driver accepts the order',
    defaultPriority: 'high',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'driverName'],
    optionalData: ['driverPhone', 'eta'],
    batchable: false,
    staleAfterMinutes: 30,
  },

  'order.out_for_delivery': {
    type: 'order.out_for_delivery',
    name: 'Out for Delivery',
    description: 'Triggered when the driver is on the way to deliver',
    defaultPriority: 'high',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'driverName', 'eta'],
    optionalData: ['driverPhone', 'driverLocation'],
    batchable: false,
    staleAfterMinutes: 15,
  },

  'order.delivered': {
    type: 'order.delivered',
    name: 'Order Delivered',
    description: 'Triggered when the order has been successfully delivered',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber'],
    optionalData: ['deliveryTime'],
    batchable: false,
    staleAfterMinutes: 120,
  },

  'order.cancelled': {
    type: 'order.cancelled',
    name: 'Order Cancelled',
    description: 'Triggered when an order is cancelled',
    defaultPriority: 'high',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber'],
    optionalData: ['reason'],
    batchable: false,
    staleAfterMinutes: 60,
  },

  // ============================================================
  // PAYMENT NOTIFICATIONS
  // ============================================================

  'payment.success': {
    type: 'payment.success',
    name: 'Payment Successful',
    description: 'Triggered when a payment is successfully processed',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'amount'],
    optionalData: ['paymentMethod'],
    batchable: false,
    staleAfterMinutes: 60,
  },

  'payment.failed': {
    type: 'payment.failed',
    name: 'Payment Failed',
    description: 'Triggered when a payment fails',
    defaultPriority: 'high',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'amount'],
    optionalData: ['reason'],
    batchable: false,
    staleAfterMinutes: 30,
  },

  'payment.refunded': {
    type: 'payment.refunded',
    name: 'Payment Refunded',
    description: 'Triggered when a payment is refunded',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'amount'],
    optionalData: ['refundReason'],
    batchable: false,
    staleAfterMinutes: 120,
  },

  // ============================================================
  // DRIVER NOTIFICATIONS
  // ============================================================

  'driver.assigned': {
    type: 'driver.assigned',
    name: 'Driver Assigned',
    description: 'Triggered when a driver is assigned to an order',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'driverName'],
    optionalData: ['driverPhone', 'pickupLocation'],
    batchable: false,
    staleAfterMinutes: 30,
  },

  'driver.arrived': {
    type: 'driver.arrived',
    name: 'Driver Arrived',
    description: 'Triggered when the driver arrives at the pickup location',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber', 'driverName'],
    optionalData: ['pickupLocation'],
    batchable: false,
    staleAfterMinutes: 15,
  },

  // ============================================================
  // SYSTEM NOTIFICATIONS
  // ============================================================

  'system.announcement': {
    type: 'system.announcement',
    name: 'System Announcement',
    description: 'System-wide announcement sent by admin',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push', 'email'],
    requiredData: ['message'],
    optionalData: ['link', 'linkText'],
    batchable: true,
  },

  'system.maintenance': {
    type: 'system.maintenance',
    name: 'Maintenance Alert',
    description: 'Alert about scheduled maintenance',
    defaultPriority: 'high',
    supportedChannels: ['in_app', 'push', 'email'],
    requiredData: ['message', 'startTime'],
    optionalData: ['endTime'],
    batchable: true,
  },

  // ============================================================
  // PROMOTIONAL NOTIFICATIONS
  // ============================================================

  'promo.offer': {
    type: 'promo.offer',
    name: 'Promotional Offer',
    description: 'Promotional offer sent to users',
    defaultPriority: 'normal',
    supportedChannels: ['in_app', 'push', 'email'],
    requiredData: ['title', 'message'],
    optionalData: ['code', 'expiryDate', 'link'],
    batchable: true,
  },

  // ============================================================
  // REMINDER NOTIFICATIONS
  // ============================================================

  'reminder.cart': {
    type: 'reminder.cart',
    name: 'Cart Reminder',
    description: 'Reminder about items left in cart',
    defaultPriority: 'low',
    supportedChannels: ['in_app', 'push', 'email'],
    requiredData: ['itemsCount'],
    optionalData: ['totalAmount'],
    batchable: true,
    staleAfterMinutes: 120,
  },

  'reminder.order_review': {
    type: 'reminder.order_review',
    name: 'Order Review Reminder',
    description: 'Reminder to review a delivered order',
    defaultPriority: 'low',
    supportedChannels: ['in_app', 'push'],
    requiredData: ['orderId', 'orderNumber'],
    optionalData: ['rating'],
    batchable: true,
    staleAfterMinutes: 1440, // 24 hours
  },
};

/**
 * Get a notification type definition by type name
 */
export function getNotificationDefinition(type: string): NotificationTypeDefinition | undefined {
  return NOTIFICATION_REGISTRY[type];
}

/**
 * Check if a notification type is valid
 */
export function isValidNotificationType(type: string): boolean {
  return !!NOTIFICATION_REGISTRY[type];
}

/**
 * Get all supported channels for a notification type
 */
export function getSupportedChannels(type: string): NotificationChannel[] {
  const def = getNotificationDefinition(type);
  return def?.supportedChannels || [];
}

/**
 * Get all batchable notification types
 */
export function getBatchableNotificationTypes(): string[] {
  return Object.entries(NOTIFICATION_REGISTRY)
    .filter(([, def]) => def.batchable)
    .map(([type]) => type);
}

/**
 * Validate notification data against the registry definition
 */
export function validateNotificationData(
  type: string,
  data: Record<string, any>
): { valid: boolean; missingFields: string[] } {
  const def = getNotificationDefinition(type);
  
  if (!def) {
    return { valid: false, missingFields: [`Unknown notification type: ${type}`] };
  }

  const missingFields: string[] = [];

  for (const field of def.requiredData) {
    if (!data[field]) {
      missingFields.push(field);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}