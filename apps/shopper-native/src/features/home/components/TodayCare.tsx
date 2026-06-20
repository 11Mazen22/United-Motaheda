/**
 * TodayCare — the anticipatory care dashboard (PRODUCT_BLUEPRINT §4.4).
 *
 * The V2 Home leads with *what needs the user today*, not commerce:
 *   • Now strip   — an order in progress (status ≠ delivered/cancelled) → track.
 *   • Needs-you   — prescriptions that are ready or need a refill, ranked.
 *   • All-clear   — a calm reassurance card when nothing is pending.
 *   • Guest       — renders nothing, so the commerce sections below lead instead.
 *
 * Data is real (useOrders + usePrescriptions); no new backend. Self-contained so
 * Home stays a thin orchestrator. Memoised; reduced-motion via PressableScale.
 */

import React, { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text as UIText } from "@/shared/ui";
import { PressableScale } from "@/shared/motion";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useAuth } from "@/features/auth";
import { useOrders } from "@/features/orders/hooks/useOrders";
import { mapOrderStatus, type OrderTone } from "@/features/orders/lib/statusMap";
import { usePrescriptions } from "@/features/prescriptions/hooks/usePrescriptions";
import { useTranslation } from "react-i18next";
import type { Order } from "@/stores/orders";
import type { Prescription } from "@/stores/prescriptionsStore";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const FWD        = IS_RTL ? "chevron-back" : "chevron-forward";


// ── tone → kit color (order status pill) ──
function toneColor(tone: OrderTone): { fg: string; bg: string } {
  switch (tone) {
    case "success": return { fg: kit.color.success, bg: kit.color.successTint };
    case "warning": return { fg: kit.color.warn,    bg: kit.color.warnTint };
    case "error":   return { fg: kit.color.danger,  bg: kit.color.dangerTint };
    case "info":
    case "brand":   return { fg: kit.color.accentDeep, bg: kit.color.accentTint };
    default:        return { fg: kit.color.inkSoft, bg: kit.color.well };
  }
}

// Ranking: ready first (actionable now), then expiring (act soon).
const RX_RANK: Record<string, number> = { ready: 0, expiring: 1 };
const ACTIVE_ORDER = (o: Order) => o.status !== "delivered" && o.status !== "cancelled";

export const TodayCare = memo(function TodayCare(): React.ReactElement | null {
  const { user } = useAuth();
  const router   = useRouter();
  const { t }    = useTranslation();
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
    () => router.push("/(tabs)/meds" as Parameters<typeof router.push>[0]),
    [router],
  );

  // Guest → commerce leads; render nothing.
  if (!user) return null;

  const hasContent = Boolean(activeOrder) || needsYou.length > 0;

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <UIText style={s.title}>{t("home.todayTitle")}</UIText>
        {needsYou.length > 0 && (
          <PressableScale onPress={openMeds} scaleTo={0.96} hitSlop={8} accessibilityRole="button" style={s.viewAll}>
            <UIText style={s.viewAllText}>{t("home.todayViewAll")}</UIText>
            <Ionicons name={FWD} size={13} color={kit.color.accentDeep} />
          </PressableScale>
        )}
      </View>

      {activeOrder && <OrderNowCard order={activeOrder} t={t} onPress={openOrder} />}

      {needsYou.map((rx) => (
        <RxNeedCard key={rx.id} rx={rx} onPress={openRx} />
      ))}

      {!hasContent && <AllGood />}
    </View>
  );
});

// ── Active order (Now strip) ──
const OrderNowCard = memo(function OrderNowCard({
  order, t, onPress,
}: {
  order:   Order;
  t:       ReturnType<typeof useTranslation>["t"];
  onPress: (id: string) => void;
}) {
  const view = mapOrderStatus(order.status, t);
  const c    = toneColor(view.tone);
  const handle = useCallback(() => onPress(order.id), [order.id, onPress]);
  return (
    <PressableScale
      onPress={handle}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${t("home.todayOnTheWay")} — ${view.label}`}
      style={s.card}>
      <View style={[s.iconTile, { backgroundColor: c.bg }]}>
        <Ionicons name={view.icon} size={22} color={c.fg} />
      </View>
      <View style={s.cardBody}>
        <UIText numberOfLines={1} style={s.cardTitle}>{t("home.todayOnTheWay")}</UIText>
        <View style={s.metaRow}>
          <View style={[s.pill, { backgroundColor: c.bg }]}>
            <UIText style={[s.pillText, { color: c.fg }]}>{view.label}</UIText>
          </View>
          <UIText numberOfLines={1} style={s.metaText}>
            {t("home.todayItems", { count: order.items.length })} · {order.total} {IS_RTL ? "ج.م" : "EGP"}
          </UIText>
        </View>
      </View>
      <View style={s.cta}>
        <UIText style={s.ctaText}>{t("home.todayTrack")}</UIText>
        <Ionicons name={FWD} size={14} color={kit.color.accentDeep} />
      </View>
    </PressableScale>
  );
});

// ── Needs-you prescription card ──
const RxNeedCard = memo(function RxNeedCard({
  rx, onPress,
}: {
  rx:      Prescription;
  onPress: (id: string) => void;
}) {
  const { t }  = useTranslation();
  const ready  = rx.status === "ready";
  const fg     = ready ? kit.color.success : kit.color.warn;
  const bg     = ready ? kit.color.successTint : kit.color.warnTint;
  const handle = useCallback(() => onPress(rx.id), [rx.id, onPress]);
  return (
    <PressableScale
      onPress={handle}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`${rx.name} — ${ready ? t("home.todayReady") : t("home.todayNeedsRefill")}`}
      style={s.card}>
      <View style={[s.iconTile, { backgroundColor: bg }]}>
        <Ionicons name={ready ? "checkmark-circle" : "medkit"} size={22} color={fg} />
      </View>
      <View style={s.cardBody}>
        <UIText numberOfLines={1} style={s.cardTitle}>{rx.name}</UIText>
        <View style={s.metaRow}>
          <View style={[s.pill, { backgroundColor: bg }]}>
            <UIText style={[s.pillText, { color: fg }]}>{ready ? t("home.todayReady") : t("home.todayNeedsRefill")}</UIText>
          </View>
          <UIText numberOfLines={1} style={s.metaText}>{rx.dose}</UIText>
        </View>
      </View>
      <View style={s.cta}>
        <UIText style={s.ctaText}>{ready ? t("home.todayView") : t("home.todayRefill")}</UIText>
        <Ionicons name={FWD} size={14} color={kit.color.accentDeep} />
      </View>
    </PressableScale>
  );
});

// ── Calm all-clear state (authed, nothing pending) ──
const AllGood = memo(function AllGood() {
  const { t } = useTranslation();
  return (
    <View style={[s.card, s.allGood]}>
      <View style={[s.iconTile, { backgroundColor: kit.color.accentTint }]}>
        <Ionicons name="shield-checkmark" size={22} color={kit.color.accentDeep} />
      </View>
      <View style={s.cardBody}>
        <UIText numberOfLines={1} style={s.cardTitle}>{t("home.todayAllGood")}</UIText>
        <UIText numberOfLines={2} style={s.allGoodSub}>{t("home.todayAllGoodSub")}</UIText>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingTop:        kit.sp(4),
    gap:               kit.sp(2),
  },
  header: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    marginBottom:   kit.sp(0.5),
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           kit.type.title.fontSize,
    lineHeight:         kit.type.title.lineHeight,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  viewAll: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 2 },
  viewAllText: {
    fontFamily: theme.fonts.bold, fontSize: 12, color: kit.color.accentDeep,
    includeFontPadding: false,
  },
  card: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    gap:             kit.sp(3),
    padding:         kit.sp(3),
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.card,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  allGood: { ...kit.shadow.raised, opacity: 0.96 },
  iconTile: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  cardTitle: {
    fontFamily: theme.fonts.bold, fontSize: kit.type.heading.fontSize,
    lineHeight: kit.type.heading.lineHeight, color: kit.color.ink,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  metaRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: kit.radius.pill },
  pillText: { fontFamily: theme.fonts.bold, fontSize: 10, lineHeight: 14, includeFontPadding: false },
  metaText: {
    flex: 1, fontFamily: theme.fonts.regular, fontSize: 12, lineHeight: 16,
    color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false,
  },
  cta: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 1 },
  ctaText: { fontFamily: theme.fonts.bold, fontSize: 12, color: kit.color.accentDeep, includeFontPadding: false },
  allGoodSub: {
    fontFamily: theme.fonts.regular, fontSize: 12, lineHeight: 17,
    color: kit.color.inkFaint, textAlign: TEXT_START, includeFontPadding: false,
  },
});
