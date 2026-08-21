import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { useOrdersStore } from '@/stores/orders.store';
import { queryClient } from '@/lib/queryClient';

const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Constants = require('expo-constants').default;
    const extra = Constants.expoConfig?.extra ?? {};
    return extra.apiUrl ?? 'http://localhost:3000';
  } catch {
    return 'http://localhost:3000';
  }
};

class DriverSocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  connect() {
    const token = useAuthStore.getState().token;
    if (!token || this.socket?.connected) return;

    this.socket = io(getBaseUrl(), {
      auth: { token },
      transports: ['websocket'],
      timeout: 10_000,
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason: any) => {
      console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err: any) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    // New order available → refresh orders list
    this.socket.on('new-order', () => {
      queryClient.invalidateQueries({ queryKey: ['availableOrders'] });
    });

    // Delivery status updated by admin/system
    this.socket.on('delivery-status-update', (data: { orderId: string; status: string }) => {
      const { activeDelivery } = useOrdersStore.getState();
      if (activeDelivery?.order.id === data.orderId) {
        useOrdersStore.getState().updateActiveDeliveryStatus(data.status as any);
        queryClient.invalidateQueries({ queryKey: ['activeDelivery'] });
      }
    });

    // Order assigned to this driver
    this.socket.on('order-assigned', () => {
      queryClient.invalidateQueries({ queryKey: ['activeDelivery'] });
    });
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.disconnect();
    this.socket = null;
    this.reconnectAttempts = 0;
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const socketManager = new DriverSocketManager();
