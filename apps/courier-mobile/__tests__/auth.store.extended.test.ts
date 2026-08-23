import { useAuthStore, type AuthUser } from '../src/stores/auth.store';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const mockUser = (overrides?: Partial<AuthUser>): AuthUser => ({
  id: '1',
  fullName: 'Test Driver',
  email: 'test@example.com',
  phone: '01012345678',
  role: 'DRIVER',
  driverProfile: {
    id: '1',
    vehicleType: 'Car',
    vehiclePlate: 'ABC123',
    vehicleModel: 'Toyota',
    vehicleColor: 'White',
    status: 'APPROVED',
    isOnline: false,
    rating: '4.5',
    totalDeliveries: 10,
    completionRate: '95',
    totalEarnings: '500',
    currentLat: 30,
    currentLng: 31,
    licensePhotoUrl: undefined,
    idPhotoUrl: undefined,
    vehiclePhotoUrl: undefined,
    insurancePhotoUrl: undefined,
    rejectionReason: undefined,
  },
  ...overrides,
});

describe('auth.store — extended', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  describe('authentication', () => {
    it('sets auth state and marks authenticated', () => {
      const user = mockUser();
      useAuthStore.getState().setAuth('token-123', user);
      const state = useAuthStore.getState();
      expect(state.token).toBe('token-123');
      expect(state.user?.id).toBe('1');
      expect(state.isAuthenticated).toBe(true);
    });

    it('clears all auth state on logout', () => {
      useAuthStore.getState().setAuth('token-123', mockUser());
      useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });

    it('preserves driver profile fields after login', () => {
      useAuthStore.getState().setAuth('token-123', mockUser());
      const profile = useAuthStore.getState().user?.driverProfile;
      expect(profile?.status).toBe('APPROVED');
      expect(profile?.isOnline).toBe(false);
      expect(profile?.vehiclePlate).toBe('ABC123');
    });
  });

  describe('session restoration', () => {
    it('updateUser merges partial user fields', () => {
      useAuthStore.getState().setAuth('token-123', mockUser());
      useAuthStore.getState().updateUser({ fullName: 'Updated Name' });
      expect(useAuthStore.getState().user?.fullName).toBe('Updated Name');
      expect(useAuthStore.getState().user?.email).toBe('test@example.com');
    });

    it('updateDriverProfile merges partial profile fields', () => {
      useAuthStore.getState().setAuth('token-123', mockUser());
      useAuthStore.getState().updateDriverProfile({ status: 'ACTIVE', totalEarnings: '600' });
      const profile = useAuthStore.getState().user?.driverProfile;
      expect(profile?.status).toBe('ACTIVE');
      expect(profile?.totalEarnings).toBe('600');
      expect(profile?.vehiclePlate).toBe('ABC123');
    });
  });

  describe('unauthorized / session expired behavior', () => {
    it('does not allow updateUser when no user is logged in', () => {
      useAuthStore.getState().updateUser({ fullName: 'Ghost' });
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('does not allow updateDriverProfile when no user is logged in', () => {
      useAuthStore.getState().updateDriverProfile({ status: 'ACTIVE' });
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('availability / online status', () => {
    it('sets online status and updates driver profile', () => {
      useAuthStore.getState().setAuth('token-123', mockUser());
      useAuthStore.getState().setOnlineStatus(true);
      const profile = useAuthStore.getState().user?.driverProfile;
      expect(profile?.isOnline).toBe(true);
      expect(profile?.status).toBe('ACTIVE');
    });

    it('sets offline status and reverts driver profile', () => {
      useAuthStore.getState().setAuth('token-123', mockUser({ driverProfile: { ...mockUser().driverProfile, isOnline: true, status: 'ACTIVE' } }));
      useAuthStore.getState().setOnlineStatus(false);
      const profile = useAuthStore.getState().user?.driverProfile;
      expect(profile?.isOnline).toBe(false);
      expect(profile?.status).toBe('APPROVED');
    });
  });
});
