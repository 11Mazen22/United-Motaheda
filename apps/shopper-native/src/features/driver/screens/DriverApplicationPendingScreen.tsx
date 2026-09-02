/**
 * DriverApplicationPendingScreen — status view for an existing application.
 * Status->icon/title/body mapping and 30s poll are a direct port of
 * courier-mobile's app/(auth)/pending.tsx.
 */
import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Screen, Text as UIText, Button, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { useMyDriverProfilePolling } from "../hooks/useDriverProfile";
import type { DriverApplicationStatus } from "../api";

const IS_RTL = isRtl();

const LIVE_DRIVER_STATUSES = new Set<DriverApplicationStatus>(["APPROVED", "ACTIVE"]);

const STATUS_CONFIG: Record<DriverApplicationStatus, { icon: React.ComponentProps<typeof Ionicons>["name"]; titleKey: string; bodyKey: string; color: "warning" | "success" | "error" | "muted" }> = {
  PENDING_APPROVAL: { icon: "time-outline", titleKey: "driverApplication.statusPendingTitle", bodyKey: "driverApplication.statusPendingBody", color: "warning" },
  APPROVED: { icon: "checkmark-circle-outline", titleKey: "driverApplication.statusApprovedTitle", bodyKey: "driverApplication.statusApprovedBody", color: "success" },
  ACTIVE: { icon: "checkmark-circle-outline", titleKey: "driverApplication.statusApprovedTitle", bodyKey: "driverApplication.statusApprovedBody", color: "success" },
  SUSPENDED: { icon: "pause-circle-outline", titleKey: "driverApplication.statusSuspendedTitle", bodyKey: "driverApplication.statusSuspendedBody", color: "error" },
  REJECTED: { icon: "close-circle-outline", titleKey: "driverApplication.statusRejectedTitle", bodyKey: "driverApplication.statusRejectedBody", color: "error" },
  INACTIVE: { icon: "pause-circle-outline", titleKey: "driverApplication.statusSuspendedTitle", bodyKey: "driverApplication.statusSuspendedBody", color: "muted" },
};

export function DriverApplicationPendingScreen(): React.ReactElement {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  const router = useRouter();
  const { user } = useAuth();
  const profileQuery = useMyDriverProfilePolling(user?.id, true);
  const profile = profileQuery.data;

  // Confirmed gap: this screen used to poll status every 30s but never
  // acted on the result reaching APPROVED/ACTIVE — a driver sitting here
  // when approved had to force-quit and relaunch the app (re-triggering
  // app/index.tsx's cold-launch role redirect) to actually reach (driver).
  useEffect(() => {
    if (profile?.status && LIVE_DRIVER_STATUSES.has(profile.status)) {
      router.replace("/(driver)" as never);
    }
  }, [profile?.status, router]);

  const status = profile?.status ?? "PENDING_APPROVAL";
  const config = STATUS_CONFIG[status];
  const colorValue = config.color === "muted" ? theme.colors.text.muted : theme.colors.status[config.color];

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = status === "PENDING_APPROVAL"
      ? withRepeat(withTiming(1.08, { duration: 900 }), -1, true)
      : withTiming(1, { duration: 200 });
  }, [status, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driverApplication.title")} />
      <View style={s.wrap}>
        <Animated.View entering={FadeInDown.duration(320)} style={{ alignItems: "center" }}>
          <Animated.View style={[s.iconWrap, { backgroundColor: `${colorValue}1A` }, pulseStyle]}>
            <Ionicons name={config.icon} size={40} color={colorValue} />
          </Animated.View>
          <UIText variant="screen-title" style={{ textAlign: "center", marginTop: 16 }}>
            {t(config.titleKey)}
          </UIText>
          <UIText variant="body-sm" color="secondary" style={{ textAlign: "center", marginTop: 8, paddingHorizontal: pagePad }}>
            {t(config.bodyKey)}
          </UIText>

          <ApplicationTimeline status={status} theme={theme} t={t} />

          {status === "REJECTED" && profile?.rejectionReason && (
            <View style={[s.reasonCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
              <UIText variant="caption" color="secondary" style={{ textAlign: "center" }}>{profile.rejectionReason}</UIText>
            </View>
          )}
          <View style={{ height: 24 }} />
          <Button label={t("common.back")} variant="ghost" onPress={() => router.back()} />
        </Animated.View>
      </View>
    </Screen>
  );
}

type TimelineNodeState = "done" | "active" | "upcoming" | "error";

function ApplicationTimeline({
  status, theme, t,
}: {
  status: DriverApplicationStatus;
  theme: NativeTheme;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  if (status !== "PENDING_APPROVAL" && status !== "REJECTED") return null;
  const isRejected = status === "REJECTED";

  const nodes: { labelKey: string; state: TimelineNodeState }[] = isRejected
    ? [
        { labelKey: "driverApplication.timelineSubmitted", state: "done" },
        { labelKey: "driverApplication.timelineReview", state: "done" },
        { labelKey: "driverApplication.timelineDecision", state: "error" },
      ]
    : [
        { labelKey: "driverApplication.timelineSubmitted", state: "done" },
        { labelKey: "driverApplication.timelineReview", state: "active" },
        { labelKey: "driverApplication.timelineDecision", state: "upcoming" },
      ];

  const dotColor = (st: TimelineNodeState) =>
    st === "done" ? theme.colors.status.success
    : st === "active" ? theme.colors.brand.primaryDark
    : st === "error" ? theme.colors.status.error
    : theme.colors.canvas.surfaceMuted;

  return (
    <View style={[tl.row, { flexDirection: flexRow(IS_RTL) }]}>
      {nodes.map((n, i) => (
        <React.Fragment key={n.labelKey}>
          <View style={tl.col}>
            <View style={[tl.dot, { backgroundColor: dotColor(n.state) }, n.state === "upcoming" && { borderWidth: 1, borderColor: theme.colors.border.default }]}>
              {n.state === "done" ? <Ionicons name="checkmark" size={11} color="#fff" />
                : n.state === "error" ? <Ionicons name="close" size={11} color="#fff" />
                : n.state === "active" ? <View style={tl.activeCore} /> : null}
            </View>
            <UIText variant="caption" numberOfLines={1} color={n.state === "upcoming" ? "secondary" : "primary"} style={tl.label}>
              {t(n.labelKey)}
            </UIText>
          </View>
          {i < nodes.length - 1 ? (
            <View style={[tl.connector, { backgroundColor: nodes[i].state === "done" ? theme.colors.status.success : theme.colors.border.default }]} />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  reasonCard: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, maxWidth: 320 },
});

const tl = StyleSheet.create({
  row: { alignItems: "flex-start", marginTop: 24, width: "100%", maxWidth: 320, paddingHorizontal: 8 },
  col: { alignItems: "center", gap: 6, width: 84 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  activeCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  label: { textAlign: "center" },
  connector: { flex: 1, height: 2, marginTop: 11, borderRadius: 1 },
});
