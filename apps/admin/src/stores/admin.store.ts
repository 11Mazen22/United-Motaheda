import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
}

interface AdminStore {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  isDark: boolean;

  setAuth: (token: string, user: AdminUser) => void;
  logout: () => void;
  toggleDark: () => void;
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isDark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,

      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
      toggleDark: () =>
        set((s) => {
          const next = !s.isDark;
          document.documentElement.classList.toggle('dark', next);
          return { isDark: next };
        }),
    }),
    {
      name: 'admin-auth',
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated, isDark: s.isDark }),
    },
  ),
);
