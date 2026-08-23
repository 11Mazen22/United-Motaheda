import { useAuthStore, type AuthUser } from '../src/stores/auth.store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('auth.store', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  describe('authentication', () => {
    it('sets auth state', () => {
      const user: AuthUser = {
        id: '1',
        fullName: 'Test Driver',
        role: 'DRIVER',
        driverProfile: {
          id: 'dp-1',
          vehicleType: 'car',
          status: 'PENDING_APPROVAL',
          isOnline: false,
          rating: '0',
          totalDeliveries: 0,
          completionRate: '0',
          totalEarnings: '0',
        },
      };
      useAuthStore.getState().setAuth('token-123', user);
      const state = useAuthStore.getState();
      expect(state.token).toBe('token-123');
      expect(state.user?.id).toBe('1');
      expect(state.isAuthenticated).toBe(true);
    });

    it('clears auth on logout', () => {
      useAuthStore.getState().setAuth('token-123', {
        id: '1',
        fullName: 'Test',
        role: 'DRIVER',
        driverProfile: {
          id: 'dp-1',
          vehicleType: 'car',
          status: 'PENDING_APPROVAL',
          isOnline: false,
          rating: '0',
          totalDeliveries: 0,
          completionRate: '0',
          totalEarnings: '0',
        },
      });
      useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('updates driver profile', () => {
      useAuthStore.getState().setAuth('token-123', {
        id: '1',
        fullName: 'Test',
        role: 'DRIVER',
        driverProfile: {
          id: 'dp-1',
          vehicleType: 'car',
          status: 'PENDING_APPROVAL',
          isOnline: false,
          rating: '0',
          totalDeliveries: 0,
          completionRate: '0',
          totalEarnings: '0',
        },
      });
      useAuthStore.getState().updateDriverProfile({ status: 'ACTIVE' });
      expect(useAuthStore.getState().user?.driverProfile?.status).toBe('ACTIVE');
    });

    it('sets online status', () => {
      useAuthStore.getState().setAuth('token-123', {
        id: '1',
        fullName: 'Test',
        role: 'DRIVER',
        driverProfile: {
          id: 'dp-1',
          vehicleType: 'car',
          status: 'PENDING_APPROVAL',
          isOnline: false,
          rating: '0',
          totalDeliveries: 0,
          completionRate: '0',
          totalEarnings: '0',
        },
      });
      useAuthStore.getState().setOnlineStatus(true);
      expect(useAuthStore.getState().user?.driverProfile?.isOnline).toBe(true);
    });
  });
});
