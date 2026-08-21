import { useAuthStore } from '../src/stores/auth.store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('auth.store', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  describe('authentication', () => {
    it('sets auth state', () => {
      const user = { id: '1', fullName: 'Test Driver', role: 'DRIVER' } as any;
      useAuthStore.getState().setAuth('token-123', user);
      const state = useAuthStore.getState();
      expect(state.token).toBe('token-123');
      expect(state.user?.id).toBe('1');
      expect(state.isAuthenticated).toBe(true);
    });

    it('clears auth on logout', () => {
      useAuthStore.getState().setAuth('token-123', { id: '1', fullName: 'Test', role: 'DRIVER' } as any);
      useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('updates driver profile', () => {
      useAuthStore.getState().setAuth('token-123', { id: '1', fullName: 'Test', role: 'DRIVER' } as any);
      useAuthStore.getState().updateDriverProfile({ status: 'ACTIVE' });
      expect(useAuthStore.getState().user?.driverProfile?.status).toBe('ACTIVE');
    });

    it('sets online status', () => {
      useAuthStore.getState().setAuth('token-123', { id: '1', fullName: 'Test', role: 'DRIVER', driverProfile: { isOnline: false } } as any);
      useAuthStore.getState().setOnlineStatus(true);
      expect(useAuthStore.getState().user?.driverProfile?.isOnline).toBe(true);
    });
  });
});
