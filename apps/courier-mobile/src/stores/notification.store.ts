import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  receivedAt: number;
}

interface NotificationStore {
  pushToken: string | null;
  notifications: AppNotification[];
  unreadCount: number;

  setToken: (token: string) => void;
  addNotification: (n: Omit<AppNotification, 'isRead' | 'receivedAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set) => ({
      pushToken: null,
      notifications: [],
      unreadCount: 0,

      setToken: (token) => set({ pushToken: token }),

      addNotification: (n) =>
        set((s) => {
          const notification: AppNotification = {
            ...n,
            isRead: false,
            receivedAt: Date.now(),
          };
          const notifications = [notification, ...s.notifications].slice(0, 100); // keep last 100
          return { notifications, unreadCount: s.unreadCount + 1 };
        }),

      markRead: (id) =>
        set((s) => {
          const notifications = s.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n,
          );
          return {
            notifications,
            unreadCount: Math.max(0, notifications.filter((n) => !n.isRead).length),
          };
        }),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        })),

      clearAll: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'driver-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ pushToken: s.pushToken, notifications: s.notifications.slice(0, 20) }),
    },
  ),
);
