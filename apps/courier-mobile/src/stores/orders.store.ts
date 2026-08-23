import { create } from 'zustand';

export interface PharmacyInfo {
  name: string;
  lat: number;
  lng: number;
  address: string;
}

export interface AvailableOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerLat: number | null;
  customerLng: number | null;
  itemCount: number;
  subtotal: string;
  total: string;
  paymentMethod: string;
  note: string | null;
  createdAt: string;
  pharmacy: PharmacyInfo;
  estimatedEarnings: number;
  distanceToPickupMeters: number | null;
  distanceToCustomerMeters: number | null;
  totalDistanceKm: number | null;
  estimatedMinutes: number | null;
}

export interface OrderItem {
  productId: string;
  quantity: string;
  unitPrice: string;
  snapshot: unknown;
}

export interface ActiveDelivery {
  assignmentId: string;
  status: DeliveryStatus;
  pharmacyName: string;
  pharmacyLat: number;
  pharmacyLng: number;
  pharmacyAddress: string;
  assignedAt: string;
  acceptedAt: string | null;
  estimatedEarnings: string;
  order: {
    id: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    customerLat: number | null;
    customerLng: number | null;
    itemCount: number;
    items: OrderItem[];
    total: string;
    paymentMethod: string;
    note: string | null;
  };
}

export type DeliveryStatus =
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_TO_PICKUP'
  | 'ARRIVED_AT_PHARMACY'
  | 'PICKED_UP'
  | 'EN_ROUTE_TO_CUSTOMER'
  | 'ARRIVED_AT_CUSTOMER'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REJECTED';

export interface DeliveryHistoryItem {
  id: string;
  orderId: string;
  status: string;
  customerName: string;
  customerAddress: string;
  itemCount: number;
  earnings: string;
  customerRating: number | null;
  deliveredAt: string | null;
  actualDuration: number | null;
  actualDistance: number | null;
}

interface OrdersStore {
  availableOrders: AvailableOrder[];
  activeDelivery: ActiveDelivery | null;
  deliveryHistory: DeliveryHistoryItem[];
  lastFetchedAt: number | null;

  setAvailableOrders: (orders: AvailableOrder[]) => void;
  setActiveDelivery: (delivery: ActiveDelivery | null) => void;
  updateActiveDeliveryStatus: (status: DeliveryStatus) => void;
  addHistoryItems: (items: DeliveryHistoryItem[]) => void;
  clearActive: () => void;
  reset: () => void;
}

export const useOrdersStore = create<OrdersStore>((set) => ({
  availableOrders: [],
  activeDelivery: null,
  deliveryHistory: [],
  lastFetchedAt: null,

  setAvailableOrders: (orders) =>
    set({ availableOrders: orders, lastFetchedAt: Date.now() }),

  setActiveDelivery: (delivery) => set({ activeDelivery: delivery }),

  updateActiveDeliveryStatus: (status) =>
    set((s) =>
      s.activeDelivery
        ? { activeDelivery: { ...s.activeDelivery, status } }
        : {},
    ),

  addHistoryItems: (items) =>
    set((s) => ({
      deliveryHistory: [
        ...s.deliveryHistory,
        ...items.filter((i) => !s.deliveryHistory.find((h) => h.id === i.id)),
      ],
    })),

  clearActive: () => set({ activeDelivery: null }),

  reset: () =>
    set({ availableOrders: [], activeDelivery: null, deliveryHistory: [], lastFetchedAt: null }),
}));
