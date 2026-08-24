import type { Ionicons } from '@expo/vector-icons';

/**
 * Shared GPS-warning-banner logic, used by both map.tsx and delivery.tsx so
 * the permission/services/accuracy detection and copy never drift apart.
 */
export interface GpsBannerConfig {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  text: string;
  color: string;
}

export function useGpsBanner(
  warning: string | null,
  hasLocation: boolean,
  colors: { status: { warning: string; error: string }; text: { primary: string } },
  t: (key: string) => string,
): GpsBannerConfig | null {
  const isPermissionDenied = warning?.toLowerCase().includes('permission denied') ?? false;
  const isServicesDisabled = warning?.toLowerCase().includes('location services disabled') ?? false;
  const isPoorAccuracy = (warning?.toLowerCase().includes('accuracy') ?? false) && !isPermissionDenied && !isServicesDisabled;

  if (isPermissionDenied) {
    return { icon: 'location-outline', text: t('delivery.permissionDenied'), color: colors.status.warning };
  }
  if (isServicesDisabled) {
    return { icon: 'settings-outline', text: t('delivery.servicesDisabled'), color: colors.status.error };
  }
  if (isPoorAccuracy) {
    return { icon: 'warning-outline', text: warning ?? t('delivery.poorAccuracy'), color: colors.status.warning };
  }
  if (!hasLocation) {
    return { icon: 'location-outline', text: t('delivery.acquiringGps'), color: colors.text.primary };
  }
  return null;
}
