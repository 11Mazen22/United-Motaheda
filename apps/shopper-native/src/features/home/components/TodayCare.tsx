/**
 * TodayCare — the anticipatory care dashboard: Home leads with *what needs
 * the user today*, not commerce.
 *   • Now strip   — an order in progress (status ≠ delivered/cancelled) → track.
 *   • Needs-you   — prescriptions that are ready or need a refill, ranked.
 *   • All-clear   — a calm reassurance card when nothing is pending.
 *   • Guest       — renders nothing, so the commerce sections below lead instead.
 *
 * Data is real (useOrders + usePrescriptions); no new backend. Self-contained so
 * Home stays a thin orchestrator. Theme-driven (useTheme()) for light/dark.
 */

import React, { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { PressableScale } from "@/shared/motion";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
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

  return (
    <View style={[s.wrap, { paddingHorizontal: pagePad }]}>
      <View style={s.header}>
        <UIText variant="h4" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{t("home.todayTitle")}</UIText>
        {needsYou.length > 0 && (
          <PressableScale onPress={openMeds} scaleTo={0.96} hitSlop={8} accessibilityRole="button" style={s.viewAll}>
            <UIText variant="caption" style={{ color: theme.colors.brand.primary }}>{t("home.todayViewAll")}</UIText>
            <Ionicons name={FWD} size={13} color={theme.colors.brand.primary} />
          </PressableScale>
        )}
      </View>

      {activeOrder && <OrderNowCard order={activeOrder} t={t} onPress={openOrder} theme={theme} />}

      {needsYou.map((rx) => (
        <RxNeedCard key={rx.id} rx={rx} onPress={openRx} theme={theme} />
      ))}

      {!hasContent && <AllGood theme={theme} />}
    </View>
  );
});

// ── Active order (Now strip) ──
const OrderNowCard = memo(function OrderNowCard({
  order, t, onPress, theme,
}: {
  order: Order;
  t: ReturnType<typeof useTranslation>["t"];
  onPress: (id: string) => void;
  theme: NativeTheme;
}) {
  const view = mapOrderStatus(order.status, t);
  const c = toneColor(theme, view.tone);
  const handle = useCallback(() => onPress(order.id), [order.id, onPress]);
  return (
    <PressableScale
      onPress={handle}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${t("home.todayOnTheWay")} — ${view.label}`}
      style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[1]]}>
      <View style={[s.iconTile, { backgroundColor: c.bg }]}>
        <Ionicons name={view.icon} size={22} color={c.fg} />
      </View>
      <View style={s.cardBody}>
        <UIText variant="card-title" numberOfLines={1} style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{t("home.todayOnTheWay")}</UIText>
        <View style={s.metaRow}>
          <View style={[s.pill, { backgroundColor: c.bg }]}>
            <UIText style={[styles.pillText, { color: c.fg }]}>{view.label}</UIText>
          </View>
          <UIText variant="caption" numberOfLines={1} style={{ flex: 1, color: theme.colors.text.muted, textAlign: TEXT_START }}>
            {t("home.todayItems", { count: order.items.length })} · {order.total} {t("common.currency")}
          </UIText>
        </View>
      </View>
      <View style={s.cta}>
        <UIText variant="caption" style={{ color: theme.colors.brand.primary }}>{t("home.todayTrack")}</UIText>
        <Ionicons name={FWD} size={14} color={theme.colors.brand.primary} />
      </View>
    </PressableScale>
  );
});

// ── Needs-you prescription card ──
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
      style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[1]]}>
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
        <UIText variant="caption" style={{ color: theme.colors.brand.primary }}>{ready ? t("home.todayView") : t("home.todayRefill")}</UIText>
        <Ionicons name={FWD} size={14} color={theme.colors.brand.primary} />
      </View>
    </PressableScale>
  );
});

// ── Calm all-clear state (authed, nothing pending) ──
const AllGood = memo(function AllGood({ theme }: { theme: NativeTheme }) {
  const { t } = useTranslation();
  return (
    <View style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default, opacity: 0.96 }, theme.shadows[1]]}>
      <View style={[s.iconTile, { backgroundColor: theme.colors.brand.primaryLight }]}>
        <Ionicons name="shield-checkmark" size={22} color={theme.colors.brand.primary} />
      </View>
      <View style={s.cardBody}>
        <UIText variant="card-title" numberOfLines={1} style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{t("home.todayAllGood")}</UIText>
        <UIText variant="caption" numberOfLines={2} style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>{t("home.todayAllGoodSub")}</UIText>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: { paddingTop: 16, gap: 8 },
  header: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  viewAll: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 2 },
  card: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  iconTile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  metaRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  cta: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 1 },
});

const styles = StyleSheet.create({
  pillText: { fontSize: 10, lineHeight: 14, fontWeight: "700" },
});
