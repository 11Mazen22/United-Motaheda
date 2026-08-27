import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { MapView, Marker } from "@/shared/maps";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withTiming, useAnimatedStyle } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { useOrderTracking } from "../hooks/useOrderTracking";
import { Text as UIText } from "@pharmacy/ui-native";
import { useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { gradients } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const STATUS_STEPS = [
  { status: "placed", icon: "receipt-outline" as IoniconsName, labelKey: "order.statusPlaced" },
  { status: "confirmed", icon: "checkmark-done-outline" as IoniconsName, labelKey: "order.statusConfirmed" },
  { status: "preparing", icon: "cube-outline" as IoniconsName, labelKey: "order.statusPreparing" },
  { status: "out_for_delivery", icon: "bicycle-outline" as IoniconsName, labelKey: "order.statusOutForDelivery" },
  { status: "delivered", icon: "home-outline" as IoniconsName, labelKey: "order.statusDelivered" },
];

const MAP_DELTA = 0.02;

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return t("order.updatedNow", { defaultValue: "Updated just now" });
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return t("order.updatedMinutesAgo", { defaultValue: `Updated ${mins}m ago`, count: mins });
  const hrs = Math.floor(mins / 60);
  return t("order.updatedHoursAgo", { defaultValue: `Updated ${hrs}h ago`, count: hrs });
}

// ─── Timeline step ──────────────────────────────────────────────────────────

function TimelineStep({ step, isCompleted, isCurrent, isLast }: { step: { status: string; icon: IoniconsName; labelKey: string }; isCompleted: boolean; isCurrent: boolean; isLast: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();

  const pulse = useSharedValue(1);
  React.useEffect(() => {
    if (isCurrent) {
      pulse.value = withRepeat(withTiming(1.3, { duration: 1000 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [isCurrent, pulse]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const iconColor = isCompleted || isCurrent ? theme.colors.canvas.background : theme.colors.text.muted;
  const bgColor = isCompleted ? theme.colors.status.success : isCurrent ? theme.colors.brand.primary : theme.colors.border.default;

  return (
    <View style={[styles.stepContainer, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={styles.stepIndicator}>
        <Animated.View style={[styles.stepDot, { backgroundColor: bgColor }, isCurrent && glowStyle(theme.colors.brand.primary), animatedDotStyle]}>
          <Ionicons name={step.icon} size={16} color={iconColor} />
        </Animated.View>
        {!isLast && (
          <View style={[styles.stepLine, { backgroundColor: isCompleted ? theme.colors.status.success : theme.colors.border.default }]} />
        )}
      </View>
      <View style={styles.stepContent}>
        <UIText style={[styles.stepLabel, { color: isCompleted || isCurrent ? theme.colors.text.primary : theme.colors.text.secondary, textAlign: TEXT_START }]}>
          {t(step.labelKey, { defaultValue: step.status })}
        </UIText>
        {isCurrent && (
          <UIText style={[styles.stepSublabel, { color: theme.colors.brand.primary, textAlign: TEXT_START }]}>
            {t("order.inProgress", { defaultValue: "In Progress..." })}
          </UIText>
        )}
      </View>
    </View>
  );
}

function glowStyle(color: string) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  };
}

// ─── Loading skeleton ───────────────────────────────────────────────────────

function TrackSkeleton({ topInset }: { topInset: number }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}>
      <View style={[styles.headerGradient, { paddingTop: topInset, height: topInset + 56 }]} />
      <View style={[styles.content, { paddingTop: 24 }]}>
        <View style={[styles.skelBlock, { height: 76, backgroundColor: theme.colors.canvas.surfaceMuted }]} />
        <View style={[styles.skelBlock, { height: 180, backgroundColor: theme.colors.canvas.surfaceMuted }]} />
        <View style={[styles.skelBlock, { height: 84, backgroundColor: theme.colors.canvas.surfaceMuted }]} />
        <View style={[styles.skelBlock, { height: 260, backgroundColor: theme.colors.canvas.surfaceMuted }]} />
      </View>
    </View>
  );
}

// ─── Error state ────────────────────────────────────────────────────────────

function TrackErrorState({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  return (
    <View style={[styles.errorRoot, { backgroundColor: theme.colors.canvas.background }]}>
      <Pressable onPress={onBack} style={styles.errorBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>
        <Ionicons name={BACK_CHEVRON} size={22} color={theme.colors.text.primary} />
      </Pressable>
      <View style={[styles.errorIconWell, { backgroundColor: `${theme.colors.status.error}14` }]}>
        <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.status.error} />
      </View>
      <UIText style={[styles.errorTitle, { color: theme.colors.text.primary }]}>
        {t("order.trackErrorTitle", { defaultValue: "Couldn't load tracking" })}
      </UIText>
      <UIText style={[styles.errorBody, { color: theme.colors.text.secondary }]}>
        {t("order.trackErrorBody", { defaultValue: "Check your connection and try again." })}
      </UIText>
      <Pressable onPress={onRetry} style={[styles.errorRetry, { backgroundColor: theme.colors.brand.primary }]} accessibilityRole="button" accessibilityLabel={t("common.retry", { defaultValue: "Retry" })}>
        <Ionicons name="refresh" size={16} color="#fff" />
        <UIText style={styles.errorRetryText}>{t("common.retry", { defaultValue: "Retry" })}</UIText>
      </Pressable>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function TrackOrderScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, token } = useLocalSearchParams<{ id: string; token: string }>();

  const { data: track, isLoading, isError, refetch } = useOrderTracking(id as string, token as string);

  const currentStepIndex = useMemo(() => {
    if (!track) return 0;
    const idx = STATUS_STEPS.findIndex(s => s.status === track.order.status);
    return idx >= 0 ? idx : 0;
  }, [track]);

  const destination = track?.order.customer_lat != null && track.order.customer_lng != null
    ? { latitude: track.order.customer_lat, longitude: track.order.customer_lng }
    : null;
  const driverPos = track?.location
    ? { latitude: track.location.lat, longitude: track.location.lng }
    : null;
  const mapCenter = driverPos ?? destination;

  if (isLoading) return <TrackSkeleton topInset={insets.top} />;
  if (isError || !track) return <TrackErrorState onRetry={() => void refetch()} onBack={() => router.back()} />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(200)} style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t("common.back")}>
            <Ionicons name={BACK_CHEVRON} size={24} color="#fff" />
          </Pressable>
          <UIText style={styles.title}>{t("order.trackTitle", { defaultValue: "Track Order" })}</UIText>
          <View style={{ width: 40 }} />
        </Animated.View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(50)}>

          {/* Order Meta Header */}
          <View style={[styles.metaCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
             <View style={[styles.metaRow, { flexDirection: flexRow(IS_RTL) }]}>
               <View>
                 <UIText style={[styles.metaLabel, { color: theme.colors.text.secondary, textAlign: TEXT_START }]}>{t("order.orderId", { defaultValue: "Order ID" })}</UIText>
                 <UIText style={[styles.metaValue, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>#{id?.slice(0, 8).toUpperCase()}</UIText>
               </View>
               {track.location && (
                 <View>
                   <UIText style={[styles.metaLabel, { color: theme.colors.text.secondary, textAlign: IS_RTL ? "left" : "right" }]}>{t("order.lastUpdate", { defaultValue: "Last Update" })}</UIText>
                   <UIText style={[styles.metaValueSm, { color: theme.colors.brand.primary, textAlign: IS_RTL ? "left" : "right" }]}>{timeAgo(track.location.captured_at, t)}</UIText>
                 </View>
               )}
             </View>
          </View>

          {/* Live map / placeholder */}
          <View style={[styles.mapCard, { backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}>
             {mapCenter ? (
               <MapView
                 style={StyleSheet.absoluteFill}
                 initialRegion={{ ...mapCenter, latitudeDelta: MAP_DELTA, longitudeDelta: MAP_DELTA }}
                 region={{ ...mapCenter, latitudeDelta: MAP_DELTA, longitudeDelta: MAP_DELTA }}
                 scrollEnabled={false}
                 zoomEnabled={false}
                 pitchEnabled={false}
                 rotateEnabled={false}
                 showsCompass={false}
                 toolbarEnabled={false}
                 pointerEvents="none"
               >
                 {destination && (
                   <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }}>
                     <View style={[styles.destPin, { backgroundColor: theme.colors.pharmacy.navy }]}>
                       <Ionicons name="home" size={14} color="#fff" />
                     </View>
                   </Marker>
                 )}
                 {driverPos && (
                   <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }}>
                     <View style={[styles.driverPin, { backgroundColor: theme.colors.brand.primary }]}>
                       <Ionicons name="bicycle" size={16} color="#fff" />
                     </View>
                   </Marker>
                 )}
               </MapView>
             ) : (
               <>
                 <Ionicons name="map-outline" size={40} color={theme.colors.text.muted} />
                 <UIText style={{ color: theme.colors.text.secondary, marginTop: 8 }}>{t("order.mapPending", { defaultValue: "Waiting for driver location…" })}</UIText>
               </>
             )}

             {track.location && (
               <Pressable
                 style={[styles.mapBtn, { backgroundColor: theme.colors.canvas.background }]}
                 onPress={() => Linking.openURL(`https://maps.google.com/?q=${track.location!.lat},${track.location!.lng}`)}
               >
                 <Ionicons name="navigate-outline" size={14} color={theme.colors.brand.primary} />
                 <UIText style={[styles.mapBtnText, { color: theme.colors.brand.primary }]}>{t("order.openMaps", { defaultValue: "Open in Maps" })}</UIText>
               </Pressable>
             )}
          </View>

          {/* Driver Info Card */}
          {track.driver && (
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={[styles.driverCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
              <View style={[styles.driverHeader, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={[styles.driverAvatar, { backgroundColor: theme.colors.brand.primaryLight }]}>
                  <Ionicons name="person" size={24} color={theme.colors.brand.primary} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <UIText style={[styles.driverName, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>
                     {track.driver.first_name || t("order.driverAssigned", { defaultValue: "Driver Assigned" })}
                  </UIText>
                  <UIText style={[styles.driverStatus, { color: theme.colors.brand.primary, textAlign: TEXT_START }]}>
                    {t("order.onTheWay", { defaultValue: "On the way" })}
                  </UIText>
                </View>
                {track.driver.phone && (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${track.driver!.phone}`)}
                    style={[styles.callBtn, { backgroundColor: `${theme.colors.status.success}14` }]}
                    accessibilityRole="button"
                    accessibilityLabel={t("order.callDriver", { defaultValue: "Call driver" })}
                  >
                    <Ionicons name="call" size={18} color={theme.colors.status.success} />
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          {/* Timeline Card */}
          <View style={[styles.timelineCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <UIText style={[styles.timelineHeader, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>{t("order.timeline", { defaultValue: "Delivery Status" })}</UIText>
            <View style={styles.timelineList}>
              {STATUS_STEPS.map((step, idx) => (
                <TimelineStep
                  key={step.status}
                  step={step}
                  isCompleted={idx < currentStepIndex}
                  isCurrent={idx === currentStepIndex}
                  isLast={idx === STATUS_STEPS.length - 1}
                />
              ))}
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
  headerGradient: {
    zIndex: 10,
  },
  header: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 18,
    color: "#fff",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  skelBlock: {
    borderRadius: 16,
    marginBottom: 24,
  },
  metaCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  metaRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    fontFamily: legacyTheme.fonts.medium,
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontFamily: legacyTheme.fonts.extrabold,
    fontSize: 18,
  },
  metaValueSm: {
    fontFamily: legacyTheme.fonts.extrabold,
    fontSize: 13,
  },
  mapCard: {
    height: 180,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  destPin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  driverPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  mapBtn: {
    position: "absolute",
    bottom: 12,
    end: 12,
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    ...theme.shadows[1],
  },
  mapBtnText: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 13,
  },
  driverCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
    ...theme.shadows[1],
  },
  driverHeader: {
    alignItems: "center",
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 15,
  },
  driverStatus: {
    fontFamily: legacyTheme.fonts.medium,
    fontSize: 13,
    marginTop: 2,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timelineHeader: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 16,
    marginBottom: 24,
  },
  timelineList: {
    paddingLeft: 8,
  },
  stepContainer: {
    alignItems: "flex-start",
  },
  stepIndicator: {
    alignItems: "center",
    width: 32,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  stepLine: {
    width: 2,
    height: 40,
    marginVertical: -4,
    zIndex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    minHeight: 64,
  },
  stepLabel: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 15,
  },
  stepSublabel: {
    fontFamily: legacyTheme.fonts.medium,
    fontSize: 13,
    marginTop: 4,
  },
  errorRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  errorBack: {
    position: "absolute",
    top: 56,
    start: 16,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  errorIconWell: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  errorTitle: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  errorBody: {
    fontFamily: legacyTheme.fonts.medium,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  errorRetry: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  errorRetryText: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 14,
    color: "#fff",
  },
  });
}
