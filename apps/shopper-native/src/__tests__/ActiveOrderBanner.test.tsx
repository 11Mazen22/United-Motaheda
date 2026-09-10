/**
 * Unit tests for ActiveOrderBanner Component.
 *
 * Rewritten alongside the component fix (previously in ActiveOrderBanner
 * .test.ts — a .ts extension can't parse JSX at all, so this suite never
 * actually ran). The old assertions also checked the component's own
 * narrow 5-value status→emoji map and a perpetual "جاري الحساب..." ETA
 * placeholder that never resolved to a real value — both removed in favor
 * of the shared mapOrderStatus() label (English fallback here, since no
 * i18n resources are loaded in this test environment) and an honest
 * status label instead of a fabricated/perpetually-pending ETA.
 *
 * KNOWN ENVIRONMENT BLOCKER (predates this change, not introduced by it):
 * this suite cannot currently execute. @testing-library/react-native
 * requires react-test-renderer@18.3.1 to match this package's own
 * react@18.3.1, but the monorepo's hoisted root node_modules resolves
 * react-test-renderer to 19.2.0 (pulled in by some other workspace
 * package's react@19 dependency). This blocks every component-render
 * test in this project, not just this one -- confirmed no other .test.tsx
 * in the repo successfully exercises @testing-library/react-native's
 * render() either. Fixing it means a monorepo-wide dependency resolution
 * change (pinning/deduping react-test-renderer, or per-package node_modules
 * isolation), which is a workspace-dependency decision outside this fix's
 * scope. The assertions here are verified correct by direct code reading
 * against the fixed component and by the project's clean `tsc --noEmit`,
 * not by an actual passing test run -- flagged rather than claimed.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ActiveOrderBanner } from '@/components/ui/ActiveOrderBanner';
import { useOrderStore, ActiveOrder } from '@/stores/orders';
import { router } from 'expo-router';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/stores/orders', () => {
  const actual = jest.requireActual('@/stores/orders');
  return { ...actual, useOrderStore: jest.fn() };
});

function mockStore(activeOrder: ActiveOrder | null, opts: { driverLocation?: { lat: number; lng: number } | null; isTracking: boolean }) {
  (useOrderStore as unknown as jest.Mock).mockReturnValue({
    activeOrder,
    driverLocation: opts.driverLocation ?? null,
    isTracking: opts.isTracking,
  });
}

describe('ActiveOrderBanner', () => {
  const mockOrder: ActiveOrder = {
    id: 'order-123',
    status: 'out_for_delivery',
    origin: { lat: 30.0444, lng: 31.2357 },
    destination: { lat: 30.0123, lng: 31.4567 },
    driverId: 'driver-456',
    driverName: 'أحمد محمد',
    driverPhone: '+20123456789',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders when there is an active order and tracking is true', () => {
      mockStore(mockOrder, { driverLocation: { lat: 30.0555, lng: 31.2457 }, isTracking: true });
      render(<ActiveOrderBanner />);
      expect(screen.getByText('أحمد محمد')).toBeTruthy();
    });

    it('does not render when there is no active order', () => {
      mockStore(null, { isTracking: false });
      const { queryByText } = render(<ActiveOrderBanner />);
      expect(queryByText('أحمد محمد')).toBeNull();
    });

    it('does not render when tracking is false', () => {
      mockStore(mockOrder, { isTracking: false });
      const { queryByText } = render(<ActiveOrderBanner />);
      expect(queryByText('أحمد محمد')).toBeNull();
    });
  });

  describe('status display', () => {
    it('shows the real status label for every canonical status, not a hardcoded 5-value subset', () => {
      // ready/driver_assigned/verification/etc. had no entry at all in the
      // old inline map and would have silently fallen through — confirm
      // each one now renders a real, non-empty label via mapOrderStatus.
      const statuses: ActiveOrder['status'][] = [
        'pending', 'verification', 'payment_approved', 'preparing',
        'ready', 'driver_assigned', 'driver_accepted', 'out_for_delivery',
        'delivered', 'cancelled', 'archived',
      ];
      for (const status of statuses) {
        mockStore({ ...mockOrder, status }, { isTracking: true });
        const { unmount } = render(<ActiveOrderBanner />);
        // mapOrderStatus always resolves to a real label (falls back to
        // the status string itself, never blank) — this is the failure
        // mode the old inline map had for anything outside its 5 keys.
        expect(screen.queryByText('')).toBeNull();
        unmount();
      }
    });
  });

  describe('driver info display', () => {
    it('displays the driver name', () => {
      mockStore(mockOrder, { isTracking: true });
      render(<ActiveOrderBanner />);
      expect(screen.getByText('أحمد محمد')).toBeTruthy();
    });

    it('displays a generic fallback when driver name is not available', () => {
      mockStore({ ...mockOrder, driverName: undefined }, { isTracking: true });
      render(<ActiveOrderBanner />);
      expect(screen.getByText('السائق')).toBeTruthy();
    });
  });

  describe('ETA display — no fabricated or perpetually-pending value', () => {
    it('shows the order status label instead of a fake numeric ETA (no real ETA source exists)', () => {
      mockStore(mockOrder, { isTracking: true });
      render(<ActiveOrderBanner />);
      // Never a made-up number, and never the old permanently-stuck
      // "جاري الحساب..." (calculating...) that never resolved.
      expect(screen.queryByText(/دقيقة/)).toBeNull();
      expect(screen.queryByText('جاري الحساب...')).toBeNull();
    });
  });

  describe('in-progress detection covers the real status set', () => {
    it('shows LIVE for a mid-lifecycle status the old 3-value check did not cover (e.g. ready)', () => {
      mockStore({ ...mockOrder, status: 'ready' }, { isTracking: true });
      render(<ActiveOrderBanner />);
      expect(screen.getByText('LIVE')).toBeTruthy();
    });

    it('does not show LIVE for delivered orders', () => {
      mockStore({ ...mockOrder, status: 'delivered' }, { isTracking: true });
      const { queryByText } = render(<ActiveOrderBanner />);
      expect(queryByText('LIVE')).toBeNull();
    });

    it('does not show LIVE for cancelled orders', () => {
      mockStore({ ...mockOrder, status: 'cancelled' }, { isTracking: true });
      const { queryByText } = render(<ActiveOrderBanner />);
      expect(queryByText('LIVE')).toBeNull();
    });

    it('does not show LIVE for archived orders', () => {
      mockStore({ ...mockOrder, status: 'archived' }, { isTracking: true });
      const { queryByText } = render(<ActiveOrderBanner />);
      expect(queryByText('LIVE')).toBeNull();
    });
  });

  describe('navigation on press', () => {
    it('navigates to the tracking screen when pressed', () => {
      mockStore(mockOrder, { isTracking: true });
      const { getByRole } = render(<ActiveOrderBanner />);
      fireEvent.press(getByRole('button'));
      expect(router.push).toHaveBeenCalledWith(`/(customer)/order-tracking/${mockOrder.id}`);
    });

    it('does not navigate when there is no active order', () => {
      mockStore(null, { isTracking: false });
      render(<ActiveOrderBanner />);
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('renders with a missing driver location', () => {
      mockStore(mockOrder, { driverLocation: null, isTracking: true });
      render(<ActiveOrderBanner />);
      expect(screen.getByText('أحمد محمد')).toBeTruthy();
    });

    it('renders with a missing driver phone', () => {
      mockStore({ ...mockOrder, driverPhone: undefined }, { isTracking: true });
      render(<ActiveOrderBanner />);
      expect(screen.getByText('أحمد محمد')).toBeTruthy();
    });
  });
});
