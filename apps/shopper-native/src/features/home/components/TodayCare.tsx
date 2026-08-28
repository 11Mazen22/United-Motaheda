/**
 * TodayCare — the anticipatory care dashboard: Home leads with *what needs
 * the user today*, not commerce.
 *   • Now strip   — an order in progress (status ≠ delivered/cancelled) →
 *                    a full gradient hero card (matching the brand-teal
 *                    treatment DriverManifest uses for its own "live now"
 *                    moment) with a real progress dots row, not just a
 *                    status pill — this is the single most time-critical
 *                    thing on Home and it was reading as just another
 *                    plain white list row.
 *   • Needs-you   — prescriptions that are ready or need a refill, ranked,
 *                    each with a colored accent bar so urgency reads at a
 *                    glance without having to parse the pill text.
 *   • All-clear   — a calm reassurance card with a soft brand-tinted glow,
 *                    not a bare icon.
 *   • Guest       — renders nothing, so the commerce sections below lead.
 *
 * Data is real (useOrders + usePrescriptions); no new backend. Self-contained
 * so Home stays a thin orchestrator. Theme-driven (useTheme()) for light/dark.
 */

import React, { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { PressableScale } from "@/shared/motion";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { useAuth } from "@/features/auth";
import { useOrders } from "@/features/orders/hooks/useOrders";
import { mapOrderStatus, type OrderTone } from "@/features/orders/lib/statusMap";
import { usePrescriptions } from "@/features/prescriptions/hooks/usePrescriptions";
import { useTranslation } from "react-i18next";
import { useScreenLayout } from "@/utils/responsive";
import type { Order } from "@/stores/orders";
import type { Prescription } from "@/stores/prescriptionsStore";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const FWD = IS_RTL ? "chevron-back" : "chevron-forward";

// Coarse 4-stage progress the hero card visualizes as dots — mirrors the
// same stage grouping OrderCard's own TrackingTimeline uses, just condensed
// to a glanceable row instead of a full stepper (this card's job is "how far
// along is it", not a full timeline — tapping through gets the detail view).
const PROGRESS_STAGE: Record<string, number> = {
  pending: 0, pending_payment: 0, confirmed: 0,
  processing: 1, preparing: 1, payment_approved: 1,
  ready: 2, shipped: 2, picked_up: 2, driver_assigned: 2, driver_accepted: 2, out_for_delivery: 2,
  delivered: 3,
};

function toneColor(theme: NativeTheme, tone: OrderTone): { fg: string; bg: string } {
  switch (tone) {
    case "success": return { fg: theme.colors.status.success, bg: `${theme.colors.status.success}1A` };
    case "warning": return { fg: theme.colors.status.warning, bg: `${theme.colors.status.warning}1A` };
    case "error": return { fg: theme.colors.status.error, bg: `${theme.colors.status.error}1A` };
    case "info":
    case "brand": return { fg: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight };
    default: return { fg: theme.colors.text.secondary, bg: theme.colors.canvas.surfaceMuted };
  }
}

// Ranking: ready first (actionable now), then expiring (act soon).
const RX_RANK: Record<string, number> = { ready: 0, expiring: 1 };
const ACTIVE_ORDER = (o: Order) => o.status !== "delivered" && o.status !== "cancelled";

export const TodayCare = memo(function TodayCare(): React.ReactElement | null {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  const { theme } = useTheme();
  const prescriptions = usePrescriptions();
  const { data: orders } = useOrders(user?.id);

  const activeOrder = useMemo<Order | undefined>(
    () => (orders ?? []).find(ACTIVE_ORDER),
    [orders],
  );

  const needsYou = useMemo<Prescription[]>(
    () =>
      prescriptions
        .filter((p) => p.status === "ready" || p.status === "expiring")
        .sort((a, b) => (RX_RANK[a.status] ?? 9) - (RX_RANK[b.status] ?? 9))
        .slice(0, 3),
    [prescriptions],
  );

  const openOrder = useCallback(
    (id: string) => router.push({ pathname: "/order/[id]", params: { id } }),
    [router],
  );
  const openRx = useCallback(
    (id: string) => router.push({ pathname: "/prescriptions/[id]", params: { id } }),
    [router],
  );
  const openMeds = useCallback(
    () => router.push("/(customer)/(tabs)/meds" as Parameters<typeof router.push>[0]),
    [router],
  );

  // Guest → commerce leads; render nothing.
  if (!user) return null;

  const hasContent = Boolean(activeOrder) || needsYou.length > 0;
  const firstName = (user.name ?? "").split(" ")[0].trim() || null;

  return (
    <View style={[s.wrap, { paddingHorizontal: pagePad }]}>
      <View style={s.header}>
        <View>
          <UIText variant="caption" style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>
            {firstName ? t("home.todayGreeting", { name: firstName, defaultValue: `مرحباً ${firstName}` }) : t("home.todayTitle")}
          </UIText>
          <UIText variant="h4" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, marginTop: 2 }}>{t("home.todayTitle")}</UIText>
        </View>
        {needsYou.length > 0 && (
          <PressableScale onPress={openMeds} scaleTo={0.96} hitSlop={8} accessibilityRole="button" style={[s.viewAll, { backgroundColor: theme.colors.brand.primaryLight }]}>
            <UIText variant="caption" weight="bold" style={{ color: theme.colors.brand.primary }}>{t("home.todayViewAll")}</UIText>
            <Ionicons name={FWD} size={13} color={theme.colors.brand.primary} />
          </PressableScale>
        )}
      </View>

      {activeOrder && (
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <OrderNowCard order={activeOrder} t={t} onPress={openOrder} theme={theme} />
        </Animated.View>
      )}

      {needsYou.map((rx, i) => (
        <Animated.View key={rx.id} entering={FadeInDown.duration(400).delay(80 * (i + 1)).springify()}>
          <RxNeedCard rx={rx} onPress={openRx} theme={theme} />
        </Animated.View>
      ))}

      {!hasContent && (
        <Animated.View entering={FadeInDown.duration(400).springify()}>
          <AllGood theme={theme} />
        </Animated.View>
      )}
    </View>
  );
});

// ── Active order (Now strip) — full gradient hero, not a plain list row ──
const OrderNowCard = memo(function OrderNowCard({
  order, t, onPress, theme,
}: {
  order: Order;
  t: ReturnType<typeof useTranslation>["t"];
  onPress: (id: string) => void;
  theme: NativeTheme;
}) {
  const { i18n } = useTranslation();
  const view = mapOrderStatus(order.status, t);
  const stage = PROGRESS_STAGE[order.status] ?? 0;
  const handle = useCallback(() => onPress(order.id), [order.id, onPress]);
  return (
    <PressableScale
      onPress={handle}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${t("home.todayOnTheWay")} — ${view.label}`}
    >
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[hero.card, theme.shadows[3]]}
      >
        <View style={[hero.topRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={hero.iconTile}>
            <Ionicons name={view.icon} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <UIText variant="eyebrow" style={{ color: "rgba(255,255,255,0.75)", textAlign: TEXT_START }}>{t("home.todayOnTheWay")}</UIText>
            <UIText variant="card-title" numberOfLines={1} style={{ color: "#fff", textAlign: TEXT_START, marginTop: 2 }}>{view.label}</UIText>
          </View>
          <View style={hero.ctaChip}>
            <UIText variant="caption" weight="bold" style={{ color: "#fff" }}>{t("home.todayTrack")}</UIText>
            <Ionicons name={FWD} size={12} color="#fff" />
          </View>
        </View>

        <View style={[hero.progressRow, { flexDirection: flexRow(IS_RTL) }]}>
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <View style={[hero.dot, i <= stage ? hero.dotDone : hero.dotFuture]} />
              {i < 3 && <View style={[hero.dotLine, i < stage ? hero.dotLineDone : hero.dotLineFuture]} />}
            </React.Fragment>
          ))}
        </View>

        <View style={[hero.footRow, { flexDirection: flexRow(IS_RTL) }]}>
          <UIText variant="caption" style={{ color: "rgba(255,255,255,0.8)" }}>
            {t("home.todayItems", { count: order.items.length })}
          </UIText>
          <UIText variant="body" weight="black" style={{ color: "#fff", writingDirection: "ltr" }}>
            {formatPrice(order.total, i18n.language === "en" ? "en" : "ar")}
          </UIText>
        </View>
      </LinearGradient>
    </PressableScale>
  );
});

// ── Needs-you prescription card — accent bar reads urgency at a glance ──
const RxNeedCard = memo(function RxNeedCard({
  rx, onPress, theme,
}: {
  rx: Prescription;
  onPress: (id: string) => void;
  theme: NativeTheme;
}) {
  const { t } = useTranslation();
  const ready = rx.status === "ready";
  const fg = ready ? theme.colors.status.success : theme.colors.status.warning;
  const bg = ready ? `${theme.colors.status.success}1A` : `${theme.colors.status.warning}1A`;
  const handle = useCallback(() => onPress(rx.id), [rx.id, onPress]);
  return (
    <PressableScale
      onPress={handle}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${rx.name} — ${ready ? t("home.todayReady") : t("home.todayNeedsRefill")}`}
      style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderStartWidth: 3, borderStartColor: fg }, theme.shadows[1]]}>
      <View style={[s.iconTile, { backgroundColor: bg }]}>
        <Ionicons name={ready ? "checkmark-circle" : "medkit"} size={22} color={fg} />
      </View>
      <View style={s.cardBody}>
        <UIText variant="card-title" numberOfLines={1} style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{rx.name}</UIText>
        <View style={s.metaRow}>
          <View style={[s.pill, { backgroundColor: bg }]}>
            <UIText style={[styles.pillText, { color: fg }]}>{ready ? t("home.todayReady") : t("home.todayNeedsRefill")}</UIText>
          </View>
          <UIText variant="caption" numberOfLines={1} style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>{rx.dose}</UIText>
        </View>
      </View>
      <View style={s.cta}>
        <UIText variant="caption" weight="bold" style={{ color: theme.colors.brand.primary }}>{ready ? t("home.todayView") : t("home.todayRefill")}</UIText>
        <Ionicons name={FWD} size={14} color={theme.colors.brand.primary} />
      </View>
    </PressableScale>
  );
});

// ── Calm all-clear state — soft glow instead of a bare icon ──
const AllGood = memo(function AllGood({ theme }: { theme: NativeTheme }) {
  const { t } = useTranslation();
  return (
    <View style={[s.card, s.allGoodCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[1]]}>
      <View style={[s.allGoodGlow, { backgroundColor: theme.colors.brand.primaryLight }]} />
      <View style={[s.iconTile, s.allGoodTile, { backgroundColor: theme.colors.brand.primaryLight }]}>
        <Ionicons name="shield-checkmark" size={24} color={theme.colors.brand.primary} />
      </View>
      <View style={s.cardBody}>
        <UIText variant="card-title" numberOfLines={1} style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{t("home.todayAllGood")}</UIText>
        <UIText variant="caption" numberOfLines={2} style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>{t("home.todayAllGoodSub")}</UIText>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { paddingTop: 20, gap: 10 },
  header: { flexDirection: flexRow(IS_RTL), alignItems: "flex-end", justifyContent: "space-between", marginBottom: 4 },
  viewAll: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 2, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999 },
  card: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },
  allGoodCard: { overflow: "hidden" },
  allGoodGlow: { position: "absolute", width: 140, height: 140, borderRadius: 70, top: -50, end: -40, opacity: 0.5 },
  allGoodTile: { width: 48, height: 48, borderRadius: 16 },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  metaRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  cta: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 1 },
});

const hero = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, gap: 14, overflow: "hidden" },
  topRow: { alignItems: "center", gap: 12 },
  iconTile: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  ctaChip: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.16)" },
  progressRow: { alignItems: "center" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotDone: { backgroundColor: "#fff" },
  dotFuture: { backgroundColor: "rgba(255,255,255,0.3)" },
  dotLine: { flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1 },
  dotLineDone: { backgroundColor: "#fff" },
  dotLineFuture: { backgroundColor: "rgba(255,255,255,0.25)" },
  footRow: { alignItems: "center", justifyContent: "space-between" },
});

const styles = StyleSheet.create({
  pillText: { fontSize: 10, lineHeight: 14, fontWeight: "700" },
});
