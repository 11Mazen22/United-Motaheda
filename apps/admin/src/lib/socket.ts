import { io, Socket } from 'socket.io-client';
import { useAdminStore } from '@/stores/admin.store';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

class AdminSocketManager {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<(data: any) => void>>();

  connect() {
    const token = useAdminStore.getState().token;
    if (!token || this.socket?.connected) return;

    this.socket = io(BASE_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 30_000,
    });

    this.socket.on('connect', () => {
      console.log('[AdminSocket] Connected');
    });

    this.socket.on('disconnect', () => {
      console.log('[AdminSocket] Disconnected');
    });

    // Re-attach all listeners to the new socket
    for (const [event, cbs] of this.listeners) {
      for (const cb of cbs) {
        this.socket.on(event, cb);
      }
    }
  }

  on<T = any>(event: string, cb: (data: T) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    this.socket?.on(event, cb);
    return () => this.off(event, cb);
  }

  off(event: string, cb: (data: any) => void) {
    this.listeners.get(event)?.delete(cb);
    this.socket?.off(event, cb);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected() {
    return this.socket?.connected ?? false;
  }
}

export const adminSocket = new AdminSocketManager();
