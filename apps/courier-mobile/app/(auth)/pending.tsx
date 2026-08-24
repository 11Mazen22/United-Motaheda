import React, { useEffect, useCallback, useState } from 'react';
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
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { typography, spacing, radii, shadows, animation } from '@pharmacy/ui-native/courier-tokens';
import { Button, useCourierTheme, Dialog } from '@pharmacy/ui-native';
import { driverApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

type ProfileStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'INACTIVE';

function statusConfig(
  status: ProfileStatus,
  t: (key: string) => string,
): { icon: React.ComponentProps<typeof Ionicons>['name']; colorKey: 'warning' | 'success' | 'error' | 'muted'; title: string; desc: string } {
  switch (status) {
    case 'PENDING_APPROVAL':
      return { icon: 'time-outline', colorKey: 'warning', title: t('pending.underReviewTitle'), desc: t('pending.underReviewDesc') };
    case 'APPROVED':
      return { icon: 'checkmark-circle', colorKey: 'success', title: t('pending.approvedTitle'), desc: t('pending.approvedDesc') };
    case 'ACTIVE':
      return { icon: 'checkmark-circle', colorKey: 'success', title: t('pending.activeTitle'), desc: t('pending.activeDesc') };
    case 'SUSPENDED':
      return { icon: 'ban-outline', colorKey: 'error', title: t('pending.suspendedTitle'), desc: t('pending.suspendedDesc') };
    case 'REJECTED':
      return { icon: 'close-circle-outline', colorKey: 'error', title: t('pending.rejectedTitle'), desc: t('pending.rejectedDesc') };
    case 'INACTIVE':
      return { icon: 'ellipse-outline', colorKey: 'muted', title: t('pending.inactiveTitle'), desc: t('pending.inactiveDesc') };
  }
}

function nextSteps(t: (key: string) => string): { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }[] {
  return [
    { icon: 'document-text-outline', text: t('pending.stepDocuments') },
    { icon: 'shield-checkmark-outline', text: t('pending.stepBackgroundCheck') },
    { icon: 'checkmark-circle-outline', text: t('pending.stepActivation') },
  ];
}

function PulsingDot({ color }: { color: string }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.4, { duration: 1000 })
      ),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors: tc } = useCourierTheme();
  const updateDriverProfile = useAuthStore((s) => s.updateDriverProfile);
  const [logoutDialog, setLogoutDialog] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ['driver', 'profile', 'status'],
    queryFn: driverApi.getProfile,
    refetchInterval: 30_000,
    staleTime: 0,
  });

  const status: ProfileStatus =
    data?.driverProfile?.status ?? 'PENDING_APPROVAL';
  const rejectionReason: string | undefined = data?.driverProfile?.rejectionReason;

  useEffect(() => {
    if (status === 'APPROVED' || status === 'ACTIVE') {
      updateDriverProfile({ status });
    }
  }, [status, updateDriverProfile]);

  const statusColor =
    status === 'PENDING_APPROVAL' ? tc.status.warning :
    status === 'APPROVED' || status === 'ACTIVE' ? tc.status.success :
    status === 'SUSPENDED' || status === 'REJECTED' ? tc.status.error :
    tc.text.muted;

  const statusBg = statusColor + '20';

  const config = statusConfig(status, t);

  const handleLogout = useCallback(() => {
    useAuthStore.getState().logout();
    router.replace('/(auth)/login');
  }, [router]);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: tc.canvas.screen }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <Animated.View
          entering={FadeInDown.duration(animation.normal).springify()}
          style={[s.statusCard, { backgroundColor: statusBg }]}
        >
          <View style={s.iconWrap}>
            <Ionicons name={config.icon} size={72} color={statusColor} />
          </View>
          <Text
            style={[s.statusTitle, { color: statusColor }]}
            accessibilityRole="header"
          >
            {config.title}
          </Text>
          <Text style={[s.statusDesc, { color: tc.text.secondary }]}>{config.desc}</Text>

          {status === 'PENDING_APPROVAL' && (
            <View style={[s.liveRow, { backgroundColor: tc.canvas.surface }]}>
              <PulsingDot color={statusColor} />
              <Text style={[s.liveText, { color: tc.text.secondary }]}>{t('pending.checkingUpdates')}</Text>
            </View>
          )}

          {status === 'REJECTED' && rejectionReason && (
            <View style={[s.reasonBox, { backgroundColor: tc.canvas.surface }]}>
              <Text style={[s.reasonLabel, { color: tc.status.error }]}>{t('pending.reason')}</Text>
              <Text style={[s.reasonText, { color: tc.text.secondary }]}>{rejectionReason}</Text>
            </View>
          )}
        </Animated.View>

        {/* Steps while pending */}
        {status === 'PENDING_APPROVAL' && (
          <Animated.View
            entering={FadeIn.duration(animation.normal).delay(150)}
            style={[s.stepsCard, { backgroundColor: tc.canvas.surface }]}
          >
            <Text style={[s.stepsTitle, { color: tc.text.primary }]} accessibilityRole="header">{t('pending.whatsNext')}</Text>

            {nextSteps(t).map(({ icon, text }, i) => (
              <View key={i} style={s.step}>
                <View style={[s.stepIcon, { backgroundColor: tc.brand.primaryLight }]}>
                  <Ionicons name={icon} size={20} color={tc.brand.primary} />
                </View>
                <Text style={[s.stepText, { color: tc.text.secondary }]}>{text}</Text>
              </View>
            ))}

            <Pressable
              onPress={() => refetch()}
              hitSlop={12}
              style={[s.refreshBtn, { backgroundColor: tc.brand.primaryLight }]}
              accessibilityRole="button"
              accessibilityLabel={t('pending.checkStatusA11y')}
              accessibilityHint={t('pending.checkStatusHint')}
            >
              <Ionicons
               name="refresh-outline"
               size={18}
               color={tc.brand.primary}
              />
              <Text style={[s.refreshText, { color: tc.brand.primary }]}>{t('pending.checkStatus')}</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* If approved, show start button */}
        {(status === 'APPROVED' || status === 'ACTIVE') && (
          <Animated.View entering={FadeIn.duration(animation.normal).delay(100)}>
            <Button
              title={t('pending.startDelivering')}
              onPress={() => router.replace('/(tabs)')}
              fullWidth
              size="lg"
              style={s.startBtn}
              accessibilityLabel={t('pending.startDeliveringA11y')}
              accessibilityHint={t('pending.startDeliveringHint')}
            />
          </Animated.View>
        )}

        {/* If rejected, re-register option */}
        {status === 'REJECTED' && (
          <Animated.View entering={FadeIn.duration(animation.normal).delay(100)}>
            <Button
              title={t('pending.reapply')}
              variant="outline"
              onPress={() => router.replace('/(auth)/register')}
              fullWidth
              size="lg"
              style={s.startBtn}
              accessibilityLabel={t('pending.reapply')}
              accessibilityHint={t('pending.reapplyHint')}
            />
          </Animated.View>
        )}

        {/* Contact support */}
        <View style={s.supportRow}>
          <Ionicons name="headset-outline" size={18} color={tc.text.secondary} />
          <Text style={[s.supportText, { color: tc.text.secondary }]}>{t('pending.needHelp')}</Text>
        </View>

        {/* Logout */}
        <Pressable
          onPress={() => setLogoutDialog(true)}
          hitSlop={12}
          style={[s.logoutBtn, { backgroundColor: tc.canvas.surfaceMuted }]}
          accessibilityRole="button"
          accessibilityLabel={t('pending.signOut')}
        >
          <Text style={[s.logoutText, { color: tc.status.error }]}>{t('pending.signOut')}</Text>
        </Pressable>

        <Dialog
          visible={logoutDialog}
          onCancel={() => setLogoutDialog(false)}
          onConfirm={handleLogout}
          title={t('pending.signOut')}
          message={t('pending.signOutConfirm')}
          confirmLabel={t('pending.signOut')}
          cancelLabel={t('pending.cancel')}
          destructive
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: spacing[5],
    paddingTop: spacing[10],
    alignItems: 'center',
    justifyContent: 'center',
  },

  statusCard: {
    width: '100%',
    borderRadius: radii['2xl'],
    padding: spacing[8],
    alignItems: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
    ...shadows.md,
  },
  iconWrap: {
    marginBottom: spacing[2],
  },
  statusTitle: {
    fontSize: typography['2xl'],
    fontFamily: typography.black,
    textAlign: 'center',
  },
  statusDesc: {
    fontSize: typography.base,
    textAlign: 'center',
    lineHeight: typography.base * typography.normal,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radii.full,
  },
  liveText: {
    fontSize: typography.xs,
    fontFamily: typography.medium,
  },
  reasonBox: {
    borderRadius: radii.lg,
    padding: spacing[4],
    width: '100%',
    marginTop: spacing[2],
  },
  reasonLabel: {
    fontSize: typography.xs,
    fontFamily: typography.bold,
    marginBottom: 4,
  },
  reasonText: { fontSize: typography.sm },

  stepsCard: {
    width: '100%',
    borderRadius: radii['2xl'],
    padding: spacing[6],
    gap: spacing[4],
    marginBottom: spacing[6],
    ...shadows.sm,
  },
  stepsTitle: {
    fontSize: typography.md,
    fontFamily: typography.bold,
    textAlign: 'center',
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: typography.sm },

  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    alignSelf: 'center',
    marginTop: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radii.full,
  },
  refreshText: { fontSize: typography.sm, fontFamily: typography.semibold },

  startBtn: { marginBottom: spacing[4] },

  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
  },
  supportText: { fontSize: typography.sm },

  logoutBtn: {
    marginTop: spacing[6],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radii.full,
  },
  logoutText: {
    fontSize: typography.sm,
    fontFamily: typography.semibold,
  },
});
