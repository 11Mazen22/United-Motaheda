import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, spacing, radii, shadows } from '@/theme/tokens';
import { Button } from '@/components/ui';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

type ProfileStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'INACTIVE';

const STATUS_CONFIG: Record<
  ProfileStatus,
  { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string; title: string; desc: string }
> = {
  PENDING_APPROVAL: {
    icon: 'time-outline',
    color: colors.warning,
    bg: '#FEF9C3',
    title: 'Under Review',
    desc: 'Your application is being reviewed by our team. This usually takes 1–2 business days.',
  },
  APPROVED: {
    icon: 'checkmark-circle',
    color: colors.success,
    bg: '#DCFCE7',
    title: 'Approved!',
    desc: 'Your account has been approved. You can now start accepting deliveries.',
  },
  ACTIVE: {
    icon: 'checkmark-circle',
    color: colors.success,
    bg: '#DCFCE7',
    title: 'Active',
    desc: 'Your account is active. You can start accepting deliveries.',
  },
  SUSPENDED: {
    icon: 'ban-outline',
    color: colors.error,
    bg: '#FEE2E2',
    title: 'Account Suspended',
    desc: 'Your account has been suspended. Please contact support for assistance.',
  },
  REJECTED: {
    icon: 'close-circle-outline',
    color: colors.error,
    bg: '#FEE2E2',
    title: 'Application Rejected',
    desc: 'Unfortunately your application was not approved.',
  },
  INACTIVE: {
    icon: 'ellipse-outline',
    color: colors.inkMuted,
    bg: colors.well,
    title: 'Inactive',
    desc: 'Your account is inactive. Please contact support.',
  },
};

export default function PendingApprovalScreen() {
  const router = useRouter();
  const updateDriverProfile = useAuthStore((s) => s.updateDriverProfile);
  const user = useAuthStore((s) => s.user);

  const { data, refetch } = useQuery({
    queryKey: ['driver', 'profile', 'status'],
    queryFn: driverApi.getProfile,
    refetchInterval: 30_000, // Poll every 30s
    staleTime: 0,
  });

  const status: ProfileStatus =
    data?.driverProfile?.status ?? 'PENDING_APPROVAL';
  const rejectionReason: string | undefined = data?.driverProfile?.rejectionReason;

  // When status changes to APPROVED/ACTIVE, update store and navigate
  useEffect(() => {
    if (status === 'APPROVED' || status === 'ACTIVE') {
      updateDriverProfile({ status });
    }
  }, [status]);

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING_APPROVAL;

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout();
    router.replace('/(auth)/login');
  }, []);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <View style={[s.statusCard, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={64} color={config.color} />
          <Text style={[s.statusTitle, { color: config.color }]}>{config.title}</Text>
          <Text style={s.statusDesc}>{config.desc}</Text>

          {status === 'REJECTED' && rejectionReason && (
            <View style={s.reasonBox}>
              <Text style={s.reasonLabel}>Reason:</Text>
              <Text style={s.reasonText}>{rejectionReason}</Text>
            </View>
          )}
        </View>

        {/* Steps while pending */}
        {status === 'PENDING_APPROVAL' && (
          <View style={s.stepsCard}>
            <Text style={s.stepsTitle}>What happens next?</Text>

            {[
              { icon: 'document-text-outline', text: 'Your documents are being verified' },
              { icon: 'shield-checkmark-outline', text: 'Background check in progress' },
              { icon: 'checkmark-circle-outline', text: 'Account activation upon approval' },
            ].map(({ icon, text }, i) => (
              <View key={i} style={s.step}>
                <View style={s.stepIcon}>
                  <Ionicons name={icon as any} size={20} color={colors.primary} />
                </View>
                <Text style={s.stepText}>{text}</Text>
              </View>
            ))}

            <Pressable onPress={() => refetch()} style={s.refreshBtn}>
              <Ionicons name="refresh-outline" size={16} color={colors.primary} />
              <Text style={s.refreshText}>Check Status</Text>
            </Pressable>
          </View>
        )}

        {/* If approved, show start button */}
        {(status === 'APPROVED' || status === 'ACTIVE') && (
          <Button
            title="Start Delivering"
            onPress={() => router.replace('/(tabs)')}
            fullWidth
            size="lg"
            style={s.startBtn}
          />
        )}

        {/* If rejected, re-register option */}
        {status === 'REJECTED' && (
          <Button
            title="Re-apply"
            variant="outline"
            onPress={() => router.replace('/(auth)/register')}
            fullWidth
            size="lg"
            style={s.startBtn}
          />
        )}

        {/* Contact support */}
        <View style={s.supportRow}>
          <Ionicons name="headset-outline" size={16} color={colors.inkMuted} />
          <Text style={s.supportText}>Need help? Contact support</Text>
        </View>

        {/* Logout */}
        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surfaceAlt },
  scroll: {
    flexGrow: 1,
    padding: spacing[5],
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusCard: {
    width: '100%',
    borderRadius: radii['2xl'],
    padding: spacing[8],
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[5],
    ...shadows.md,
  },
  statusTitle: {
    fontSize: typography['2xl'],
    fontWeight: typography.extrabold,
    textAlign: 'center',
  },
  statusDesc: {
    fontSize: typography.base,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: typography.base * typography.lineHeightNormal,
  },
  reasonBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing[3],
    width: '100%',
    marginTop: spacing[2],
  },
  reasonLabel: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: colors.error,
    marginBottom: 4,
  },
  reasonText: { fontSize: typography.sm, color: colors.inkSoft },

  stepsCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii['2xl'],
    padding: spacing[5],
    gap: spacing[4],
    marginBottom: spacing[5],
    ...shadows.sm,
  },
  stepsTitle: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    color: colors.ink,
    marginBottom: spacing[2],
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: typography.sm, color: colors.inkSoft },

  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    alignSelf: 'center',
    marginTop: spacing[2],
    padding: spacing[2],
  },
  refreshText: { fontSize: typography.sm, color: colors.primary, fontWeight: typography.semibold },

  startBtn: { marginBottom: spacing[4] },

  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  supportText: { fontSize: typography.sm, color: colors.inkMuted },

  logoutBtn: { marginTop: spacing[6], padding: spacing[2] },
  logoutText: { fontSize: typography.sm, color: colors.error, fontWeight: typography.medium },
});
