import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  priority: 'high' | 'normal' | 'low';
}

interface NotificationsState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  fetchNotifications: (options?: { unreadOnly?: boolean; refresh?: boolean }) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  getUnreadCount: () => Promise<number>;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async (options = {}) => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (options.unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      set({ notifications: data as NotificationItem[] });

      // Update unread count
      get().getUnreadCount();
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  },

  markAllAsRead: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  },

  deleteNotification: async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set((state) => {
        const notification = state.notifications.find(n => n.id === id);
        const wasUnread = notification && !notification.is_read;
        return {
          notifications: state.notifications.filter(n => n.id !== id),
          unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
        };
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  },

  clearAllNotifications: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      set({ notifications: [], unreadCount: 0 });
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  },

  getUnreadCount: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      const unreadCount = count || 0;
      set({ unreadCount });
      return unreadCount;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }
}));
