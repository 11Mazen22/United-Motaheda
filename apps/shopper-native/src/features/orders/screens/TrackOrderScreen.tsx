/**
 * TrackOrderScreen — customer-facing live driver tracking view.
 *
 * Shows:
 *   - Order ID header
 *   - Live driver position as lat/lng coordinates and last-updated time
 *     (map library is not yet in this project; coordinates are displayed
 *     as text with a "Open in Maps" deep link to Google Maps)
 *   - Driver's first name and phone (if available)
 *   - Order status badge
 *   - Connection state banner (live / stale / no location yet)
 *
 * Navigation:
 *   Entry point: app/order/track/[id].tsx (Task 4b)
 *   Route params: { id: orderId, token: qrToken }
 *   Back: router.back() → order detail screen
 *
 * Data:
 *   useOrderTracking polls track-order Edge Function every 20 s.
 *   Realtime invalidation (Task 5) triggers re-fetch faster on new pings.
 *   Both paths share the same TanStack Query cache entry.
 *
 * Graceful degradation:
 *   - location: null → "Driver location updating…" state
 *   - driver: null   → driver info section hidden
 *   - Network error  → retry button via query.refetch()
 *
 * RTL: all layout uses isRtl() / textAlignStart() / flexRow() helpers
 * from @/utils/layout, matching every other screen in this project.
 */

import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useQueryClient } from "@tanstack/react-query";

import { Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { Badge } from "@/components/ui/Badge";
import { BACK_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useOrderDetail } from "../hooks/useOrders";
import { useOrderTracking } from "../hooks/useOrderTracking";
import { ORDER_STATUS_META } from "../components/OrderDetailHelpers";
import { subscribeToOrderTracking } from "../realtime";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCapturedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function ageSeconds(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 1000);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function TrackOrderScreen(): React.ReactElement {
  const { t }      = useTranslation();
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { id: orderId, token: qrToken } =
    useLocalSearchParams<{ id: string; token: string }>();

  // Order detail: supplies status badge and qrToken fallback validation.
  const orderQuery = useOrderDetail(orderId);
  const order      = orderQuery.data;

  // Tracking snapshot: polls and is invalidated by realtime (Task 5).
  const trackingQuery = useOrderTracking(orderId, qrToken);
  const snapshot      = trackingQuery.data;

  const handleRefresh = useCallback(() => {
    void trackingQuery.refetch();
  }, [trackingQuery]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  // Subscribe on mount; unsubscribe on unmount. The subscription calls
  // invalidateOrderTracking (defined in useOrderTracking) which triggers a
  // cache invalidation so the polling refetch fires immediately on new pings.
  React.useEffect(() => {
    if (!orderId) return;
    const sub = subscribeToOrderTracking(orderId, () => {
      void queryClient.invalidateQueries({
        queryKey: ["orders", "tracking", orderId],
      });
    });
    return () => sub.unsubscribe();
  }, [orderId, queryClient]);

  const statusMeta = order
    ? (ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.pending)
    : null;
  const shortId = (orderId ?? "").slice(-8).toUpperCase();

  // ── Derive location state ─────────────────────────────────────────────────
  const location     = snapshot?.location ?? null;
  const driver       = snapshot?.driver   ?? null;
  const hasLocation  = Boolean(location);
  const locationAge  = location ? ageSeconds(location.captured_at) : null;

  // ── Open in Google Maps ───────────────────────────────────────────────────
  const openInMaps = () => {
    if (!location) return;
    void Linking.openURL(
      `https://www.google.com/maps?q=${location.lat},${location.lng}`,
    );
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (trackingQuery.isLoading) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
          </Pressable>
          <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START }}>
            #{shortId}
          </UIText>
        </View>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={kit.color.accent} />
          <UIText variant="body-sm" color="secondary" style={{ marginTop: 12 }}>
            {t("tracking.loading", "Loading live tracking…")}
          </UIText>
        </View>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (trackingQuery.isError && !snapshot) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
          </Pressable>
          <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START }}>
            #{shortId}
          </UIText>
        </View>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={kit.color.inkFaint} />
          <UIText variant="body-sm" color="secondary" style={{ marginTop: 12, textAlign: "center" }}>
            {t("tracking.loadError", "Could not load tracking information.")}
          </UIText>
          <Pressable
            onPress={handleRefresh}
            style={s.retryBtn}
            accessibilityRole="button"
          >
            <UIText variant="body-sm" weight="bold" style={{ color: kit.color.accentDeep }}>
              {t("common.retry")}
            </UIText>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Animated.View entering={FadeIn.duration(240)} style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <UIText variant="eyebrow" color="tertiary" style={{ textAlign: TEXT_START }}>
            {t("tracking.screenTitle", "Live Tracking")}
          </UIText>
          <UIText variant="card-title" style={{ textAlign: TEXT_START }}>
            #{shortId}
          </UIText>
        </View>
        {statusMeta && (
          <Badge variant={statusMeta.variant} size="sm">
            {t(statusMeta.labelKey)}
          </Badge>
        )}
      </Animated.View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={trackingQuery.isRefetching}
            onRefresh={handleRefresh}
            tintColor={kit.color.accent}
            colors={[kit.color.accent]}
          />
        }
      >
        {/* ── Connection banner ─────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(0).duration(320)}
          style={[
            s.banner,
            hasLocation ? s.bannerLive : s.bannerWaiting,
          ]}
        >
          <Ionicons
            name={hasLocation ? "radio-outline" : "navigate-outline"}
            size={16}
            color={hasLocation ? kit.color.success : kit.color.accentDeep}
          />
          <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>
            {hasLocation
              ? t("tracking.liveActive", "Live location is updating.")
              : t("tracking.waitingForLocation", "Waiting for driver location…")}
          </UIText>
          {hasLocation && trackingQuery.isRefetching && (
            <ActivityIndicator size="small" color={kit.color.accent} />
          )}
        </Animated.View>

        {/* ── Driver location card ───────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(320)} style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconBox}>
              <Ionicons name="location-outline" size={15} color={kit.color.accentDeep} />
            </View>
            <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START }}>
              {t("tracking.driverLocation", "Driver Location")}
            </UIText>
            {hasLocation && (
              <Pressable
                onPress={openInMaps}
                style={s.mapsBtn}
                accessibilityRole="button"
                accessibilityLabel={t("tracking.openInMaps", "Open in Maps")}
              >
                <Ionicons name="map-outline" size={16} color={kit.color.accentDeep} />
                <UIText variant="caption" style={{ color: kit.color.accentDeep }}>
                  {t("tracking.openInMaps", "Maps")}
                </UIText>
              </Pressable>
            )}
          </View>

          <View style={s.cardBody}>
            {hasLocation && location ? (
              <>
                {/* Coordinate display */}
                <View style={s.coordRow}>
                  <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START }}>
                    {t("tracking.latitude", "Lat")}
                  </UIText>
                  <UIText variant="body-sm" weight="bold" style={{ textAlign: "right" }}>
                    {location.lat.toFixed(6)}
                  </UIText>
                </View>
                <View style={s.coordRow}>
                  <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START }}>
                    {t("tracking.longitude", "Lng")}
                  </UIText>
                  <UIText variant="body-sm" weight="bold" style={{ textAlign: "right" }}>
                    {location.lng.toFixed(6)}
                  </UIText>
                </View>

                {/* Age indicator */}
                <View style={s.ageRow}>
                  <Ionicons name="time-outline" size={13} color={kit.color.inkFaint} />
                  <UIText variant="caption" color="secondary">
                    {t("tracking.updatedAt", "Updated")} {formatCapturedAt(location.captured_at)}
                    {locationAge !== null && locationAge > 0
                      ? ` (${locationAge}${t("tracking.secondsAgo", "s ago")})`
                      : ""}
                  </UIText>
                </View>
              </>
            ) : (
              <View style={s.noLocationRow}>
                <Ionicons name="navigate-circle-outline" size={32} color={kit.color.inkFaint} />
                <UIText variant="body-sm" color="secondary" style={{ textAlign: "center", marginTop: 8 }}>
                  {t("tracking.noLocationYet", "Driver location will appear here once the delivery begins.")}
                </UIText>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Driver info card ───────────────────────────────────────────── */}
        {driver && (
          <Animated.View entering={FadeInDown.delay(120).duration(320)} style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardIconBox}>
                <Ionicons name="person-outline" size={15} color={kit.color.accentDeep} />
              </View>
              <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START }}>
                {t("tracking.yourDriver", "Your Driver")}
              </UIText>
            </View>
            <View style={s.cardBody}>
              <View style={s.coordRow}>
                <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START }}>
                  {t("driver.name", "Name")}
                </UIText>
                <UIText variant="body-sm" weight="bold" style={{ textAlign: TEXT_START }}>
                  {driver.first_name || "—"}
                </UIText>
              </View>
              {Boolean(driver.phone) && (
                <Pressable
                  onPress={() => {
                    const phone = driver.phone.replace(/\s/g, "");
                    void Linking.openURL(`tel:${phone}`);
                  }}
                  style={s.callRow}
                  accessibilityRole="button"
                  accessibilityLabel={t("driver.phone")}
                >
                  <Ionicons name="call-outline" size={16} color={kit.color.accentDeep} />
                  <UIText variant="body-sm" style={{ color: kit.color.accentDeep }}>
                    {driver.phone}
                  </UIText>
                </Pressable>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Delivery address ───────────────────────────────────────────── */}
        {order && (
          <Animated.View entering={FadeInDown.delay(180).duration(320)} style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.cardIconBox}>
                <Ionicons name="home-outline" size={15} color={kit.color.accentDeep} />
              </View>
              <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START }}>
                {t("orders.addressSection")}
              </UIText>
            </View>
            <View style={s.cardBody}>
              <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, lineHeight: 22 }}>
                {order.address.formatted ??
                  [order.address.street, order.address.city].filter(Boolean).join(", ") ??
                  "—"}
              </UIText>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },
  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom:     14,
    paddingTop:        10,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  centered: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingBottom:  80,
  },
  retryBtn: {
    marginTop:         16,
    paddingHorizontal: 20,
    paddingVertical:   12,
    borderRadius:      12,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  scroll: {
    paddingHorizontal: kit.inset.screen,
    paddingTop:        16,
    gap:               14,
  },

  // ── Banner ────────────────────────────────────────────────────────────
  banner: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    gap:            8,
    paddingVertical:   12,
    paddingHorizontal: 14,
    borderRadius:   kit.radius.lg,
    borderWidth:    1,
  },
  bannerLive: {
    backgroundColor: kit.color.successTint,
    borderColor:     kit.color.success,
  },
  bannerWaiting: {
    backgroundColor: kit.color.accentTint,
    borderColor:     kit.color.line,
  },

  // ── Card ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.card,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
  },
  cardHeader: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: theme.spacing.lg,
    paddingTop:        14,
    paddingBottom:     theme.spacing.sm,
  },
  cardIconBox: {
    width:           30,
    height:          30,
    borderRadius:    10,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  cardBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom:     theme.spacing.lg,
    paddingTop:        theme.spacing.xs,
    gap:               10,
  },

  // ── Rows inside cards ─────────────────────────────────────────────────
  coordRow: {
    flexDirection:   flexRow(IS_RTL),
    justifyContent:  "space-between",
    alignItems:      "center",
    paddingVertical: 4,
  },
  ageRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    gap:            5,
    marginTop:      4,
  },
  noLocationRow: {
    alignItems:  "center",
    paddingVertical: 20,
  },
  mapsBtn: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  callRow: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               8,
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
    marginTop:         4,
  },
});
