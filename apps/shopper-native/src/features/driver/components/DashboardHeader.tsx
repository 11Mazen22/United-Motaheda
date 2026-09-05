import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { gradients } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { displayNameFromEmail } from "@/utils/displayName";

const IS_RTL = isRtl();

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

interface Props {
  isOnline: boolean;
  onToggleAvailability: () => void;
  todayEarnings: number;
  completedToday: number;
  acceptanceRate: number | null;
  unreadCount: number;
  user?: User | null;
}

function pulseValue(active: boolean) {
  "worklet";
  if (!active) return 1;
  return withRepeat(withSequence(withTiming(1.15, { duration: 800 }), withTiming(1, { duration: 800 })), -1, false);
}

export function DashboardHeader({
  isOnline,
  onToggleAvailability,
  todayEarnings,
  completedToday,
  acceptanceRate,
  unreadCount,
  user,
}: Props): React.ReactElement {
  const { theme } = useTheme();
  const { pagePad } = useScreenLayout();
  const pulse = useSharedValue(1);

  React.useEffect(() => {
    pulse.value = pulseValue(isOnline);
  }, [isOnline]);

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || displayNameFromEmail(user.email) : "Driver";

  const s = useMemo(() => StyleSheet.create({
    gradient: { paddingHorizontal: pagePad, paddingTop: 20, paddingBottom: 32, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
    topRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between" },
    leftRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
    avatarWrap: { position: "relative" as const, width: 48, height: 48 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
    statusDot: { position: "absolute" as const, bottom: 0, end: 0, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: isOnline ? "#10B981" : "#94A3B8", backgroundColor: isOnline ? "#10B981" : "#94A3B8" },
    greeting: { fontSize: 22, fontFamily: legacyTheme.fonts.black, color: "#fff", marginTop: 4 },
    greetingSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
    headerActions: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
    actionBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
    notifDot: { position: "absolute" as const, top: 8, end: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
    notifDotText: { fontSize: 9, fontFamily: legacyTheme.fonts.bold, color: "#fff" },
    statsRow: { flexDirection: flexRow(IS_RTL), gap: 10, marginTop: 16 },
    statChip: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", gap: 4 },
    statValue: { fontSize: 18, fontFamily: legacyTheme.fonts.black, color: "#fff" },
    statLabel: { fontSize: 10, fontFamily: legacyTheme.fonts.bold, color: "rgba(255,255,255,0.75)", textAlign: "center" as const },
  }), [theme, pagePad, isOnline]);

  const acceptanceLabel = acceptanceRate !== null ? `${acceptanceRate}%` : "—";

  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <LinearGradient colors={gradients.heroPrimary as unknown as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradient}>
        <View style={s.topRow}>
          <View style={s.leftRow}>
            <View style={s.avatarWrap}>
              <Animated.View style={[s.avatar, avatarAnimatedStyle]}>
                <Ionicons name="person" size={24} color="#fff" />
              </Animated.View>
              <View style={s.statusDot} />
            </View>
            <View>
              <UIText style={s.greeting}>{`Hi, ${displayName}`}</UIText>
              <UIText variant="caption" color="inverse-muted" style={s.greetingSub}>{isOnline ? "You're online" : "You're offline"}</UIText>
            </View>
          </View>
          <View style={s.headerActions}>
            <Pressable onPress={onToggleAvailability} style={s.actionBtn} accessibilityRole="switch" accessibilityState={{ checked: isOnline }}>
              <Ionicons name={isOnline ? "power" : "power-outline"} size={20} color="#fff" />
            </Pressable>
            <View style={s.actionBtn}>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              {unreadCount > 0 && (
                <View style={s.notifDot}>
                  <UIText style={s.notifDotText}>{unreadCount > 9 ? "9+" : String(unreadCount)}</UIText>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.statChip}>
            <UIText variant="metric" color="inverse" style={{ fontSize: 20 }}>{formatPrice(todayEarnings)}</UIText>
            <UIText variant="caption" color="inverse-muted" style={s.statLabel}>Today</UIText>
          </View>
          <View style={s.statChip}>
            <UIText variant="metric" color="inverse" style={{ fontSize: 20 }}>{String(completedToday)}</UIText>
            <UIText variant="caption" color="inverse-muted" style={s.statLabel}>Delivered</UIText>
          </View>
          <View style={s.statChip}>
            <UIText variant="metric" color="inverse" style={{ fontSize: 20 }}>{acceptanceLabel}</UIText>
            <UIText variant="caption" color="inverse-muted" style={s.statLabel}>Acceptance</UIText>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export default DashboardHeader;
