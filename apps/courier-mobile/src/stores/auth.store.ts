import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DriverProfile {
  id: string;
  vehicleType: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'INACTIVE';
  isOnline: boolean;
  rating: string;
  totalDeliveries: number;
  completionRate: string;
  totalEarnings: string;
  currentLat?: number;
  currentLng?: number;
  licensePhotoUrl?: string;
  idPhotoUrl?: string;
  vehiclePhotoUrl?: string;
  insurancePhotoUrl?: string;
  rejectionReason?: string;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  driverProfile: DriverProfile;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (token: string, user: AuthUser) => void;
  updateUser: (user: Partial<AuthUser>) => void;
  updateDriverProfile: (profile: Partial<DriverProfile>) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) =>
        set({ token, user, isAuthenticated: true }),

      updateUser: (partial) =>
        set((s) => ({
          user: s.user ? { ...s.user, ...partial } : null,
        })),

      updateDriverProfile: (partial) =>
        set((s) => ({
          user: s.user
            ? { ...s.user, driverProfile: { ...s.user.driverProfile, ...partial } }
            : null,
        })),

      setOnlineStatus: (isOnline) =>
        set((s) => ({
          user: s.user
            ? {
                ...s.user,
                driverProfile: {
                  ...s.user.driverProfile,
                  isOnline,
                  status: isOnline ? 'ACTIVE' : 'APPROVED',
                },
              }
            : null,
        })),

      logout: () =>
        set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'driver-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
