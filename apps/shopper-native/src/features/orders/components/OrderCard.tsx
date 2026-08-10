/**
 * OrderCard — premium logistics / tracking card (ground-up visual rewrite).
 *
 * Design changes:
 *   • Removed colored status bar at top → cleaner status badge at top-right
 *   • Added TrackingTimeline: horizontal 4-step stepper with icon dots,
 *     emerald-green filled circles for done steps, teal glow for current,
 *     gray hollow for future. Connected by thin progress lines.
 *   • Massive clean whitespace (paddingVertical 18, gap 14)
 *   • Soft shadow: elevation 2, shadowOpacity 0.05 — no visual noise
 *   • No border — pure white card on off-white bg speaks for itself
 */

import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart, valueTextAlign, FORWARD_CHEVRON } from "@/utils/layout";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { Badge } from "@/components/ui/Badge";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { formatPrice } from "@/utils/format";
import type { Order, OrderStatus } from "@/stores/orders";
import { listS } from "./orders.styles";

// ─── Status metadata (unchanged — used by Badge and dot colors) ───────────────

export const STATUS_META: Record<
  OrderStatus,
  {
    labelKey: string;
    variant:  "success" | "warning" | "brand" | "error" | "neutral";
    icon:     React.ComponentProps<typeof Ionicons>["name"];
    dot:      string;
  }
> = {
  pending:           { labelKey: "orders.pending",           variant: "warning", icon: "time-outline",             dot: kit.color.warn          },
  pending_payment:   { labelKey: "orders.pendingPayment",    variant: "warning", icon: "card-outline",             dot: kit.color.warn          },
  confirmed:         { labelKey: "orders.pending",           variant: "warning", icon: "checkmark-circle-outline", dot: kit.color.warn          },
  verification:      { labelKey: "orders.processing",        variant: "brand",   icon: "shield-checkmark-outline", dot: kit.color.accent       },
  payment_pending:   { labelKey: "orders.pendingPayment",    variant: "warning", icon: "card-outline",             dot: kit.color.warn          },
  payment_approved:  { labelKey: "orders.processing",        variant: "brand",   icon: "checkmark-circle-outline", dot: kit.color.success      },
  processing:        { labelKey: "orders.processing",        variant: "brand",   icon: "refresh-outline",          dot: kit.color.accent        },
  preparing:         { labelKey: "orders.processing",        variant: "brand",   icon: "refresh-outline",          dot: kit.color.accent        },
  ready:             { labelKey: "orders.shipped",           variant: "brand",   icon: "cube-outline",             dot: kit.color.accent        },
  shipped:           { labelKey: "orders.shipped",           variant: "brand",   icon: "car-outline",              dot: kit.color.accent        },
  picked_up:         { labelKey: "orders.shipped",           variant: "brand",   icon: "car-outline",              dot: kit.color.accent        },
  driver_assigned:   { labelKey: "orders.shipped",           variant: "brand",   icon: "car-outline",              dot: kit.color.accent        },
  driver_accepted:   { labelKey: "orders.shipped",           variant: "brand",   icon: "car-outline",              dot: kit.color.accent        },
  out_for_delivery:  { labelKey: "orders.shipped",           variant: "brand",   icon: "car-outline",              dot: kit.color.accent        },
  delivered:         { labelKey: "orders.delivered",         variant: "success", icon: "checkmark-circle-outline", dot: kit.color.success       },
  cancelled:         { labelKey: "orders.cancelled",         variant: "error",   icon: "close-circle-outline",     dot: kit.color.danger        },
  archived:          { labelKey: "orders.delivered",         variant: "neutral", icon: "archive-outline",          dot: kit.color.inkFaint     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDate(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleDateString(language === "en" ? "en-US" : "ar-EG", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return "";
  }
}

export function paymentDot(status: string): string | null {
  switch (status) {
    case "pending_verification": return kit.color.warn;
    case "verified":
    case "paid":                 return kit.color.success;
    case "failed":               return kit.color.danger;
    default:                     return null;
  }
}

// ─── TrackingTimeline ─────────────────────────────────────────────────────────
// 4-step horizontal stepper. RTL: pending on RIGHT, delivered on LEFT.
// Step dots contain contextual icons; no text labels (icons are self-describing).

type StepDef = {
  status: OrderStatus;
  icon:   React.ComponentProps<typeof Ionicons>["name"];
  match:  OrderStatus[];
};

const TIMELINE_STEPS: StepDef[] = [
  { status: "pending",    icon: "time-outline",             match: ["pending", "pending_payment", "confirmed"] },
  { status: "processing", icon: "refresh-outline",          match: ["processing", "preparing"]                 },
  { status: "shipped",    icon: "car-outline",              match: ["shipped", "ready", "picked_up", "driver_assigned", "driver_accepted", "out_for_delivery"] },
  { status: "delivered",  icon: "checkmark-circle-outline", match: ["delivered", "archived"]                   },
];

const EMERALD = kit.color.success;

const TrackingTimeline = memo(function TrackingTimeline({
  status,
}: { status: OrderStatus }) {
  // Cancelled orders: status badge in header already communicates this.
  // No stepper needed — returning null avoids empty space.
  if (status === "cancelled") return null;

  // Find which step this status maps to (0-3)
  const currentIdx = TIMELINE_STEPS.findIndex((s) => s.match.includes(status));
  const safeIdx    = currentIdx === -1 ? 0 : currentIdx;

  return (
    <View style={tl.container}>
      {/* Progress track rendered as background */}
      <View style={tl.row}>
        {TIMELINE_STEPS.map((step, i) => {
          const isDone    = i < safeIdx;
          const isCurrent = i === safeIdx;
          const isLast    = i === TIMELINE_STEPS.length - 1;

          return (
            <React.Fragment key={step.status}>
              {/* Step dot — icon inside */}
              <View
                style={[
                  tl.dot,
                  isDone    && tl.dotDone,
                  isCurrent && tl.dotCurrent,
                  !isDone && !isCurrent && tl.dotFuture,
                ]}>
                <Ionicons
                  name={step.icon}
                  size={isCurrent ? 13 : 11}
                  color={isDone || isCurrent ? kit.color.onInk : kit.color.inkFaint}
                />
              </View>

              {/* Connecting line (omit after last dot) */}
              {!isLast && (
                <View
                  style={[
                    tl.line,
                    i < safeIdx ? tl.lineActive : tl.lineGray,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
});

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

export function SkeletonCard(): React.ReactElement {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={listS.card}>
      <View style={listS.skeletonRow}>
        <View style={[listS.skeletonRect, { width: 36, height: 36, borderRadius: 18 }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[listS.skeletonRect, { width: "35%", height: 9 }]} />
          <View style={[listS.skeletonRect, { width: "55%", height: 14 }]} />
          <View style={[listS.skeletonRect, { width: "40%", height: 9  }]} />
        </View>
        <View style={[listS.skeletonRect, { width: 72, height: 24, borderRadius: 20 }]} />
      </View>
      <View style={listS.skeletonItems}>
        <View style={[listS.skeletonRect, { width: 56, height: 56, borderRadius: 14 }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[listS.skeletonRect, { width: "65%", height: 12 }]} />
          <View style={[listS.skeletonRect, { width: "40%", height: 10 }]} />
        </View>
      </View>
      <View style={listS.skeletonFooter}>
        <View style={[listS.skeletonRect, { width: 70, height: 10, borderRadius: 4 }]} />
        <View style={[listS.skeletonRect, { width: 90, height: 18, borderRadius: 6 }]} />
      </View>
    </Animated.View>
  );
}

// ─── OrderCard ────────────────────────────────────────────────────────────────

export const OrderCard = memo(function OrderCard({
  order, onPress,
}: { order: Order; onPress: (id: string) => void }): React.ReactElement {
  const { t }        = useTranslation();
  const { language } = useAppLanguage();
  const meta         = STATUS_META[order.status] ?? STATUS_META.pending;
  const firstItem    = order.items[0];
  const extraCount   = order.items.length - 1;
  const shortId      = order.id.slice(-8).toUpperCase();

  const scale    = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress    = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress(order.id);
  }, [onPress, order.id]);
  const handlePressIn  = useCallback(() => {
    scale.value = withSpring(0.978, { damping: 20, stiffness: 400 });
  }, [scale]);
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1.0, { damping: 18, stiffness: 380 });
  }, [scale]);

  return (
    <Animated.View style={cardAnim}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[listS.card, { borderStartWidth: 3, borderStartColor: meta.dot }]}>

        {/* ── TOP: Order reference + date + status badge ─── */}
        <View style={oc.headerRow}>
          {/* Left cluster — icon + ID + date (RTL: appears on RIGHT) */}
          <View style={oc.headerLeft}>
            <View style={[oc.statusCircle, { backgroundColor: `${meta.dot}1A` }]}>
              <Ionicons name={meta.icon} size={16} color={meta.dot} />
            </View>
            <View style={{ gap: 2 }}>
              <UIText style={oc.orderRef}>
                {t("orders.orderLabel")} #{shortId}
              </UIText>
              <UIText style={oc.orderDate}>
                {formatDate(order.createdAt, language)}
              </UIText>
            </View>
          </View>

          {/* Right side — status badge (RTL: appears on LEFT) */}
          <Badge variant={meta.variant} size="sm">
            {t(meta.labelKey)}
          </Badge>
        </View>

        {/* ── TRACKING TIMELINE ─────────────────────────── */}
        <TrackingTimeline status={order.status} />

        {/* ── ITEM ROW ───────────────────────────────────── */}
        <View style={oc.itemRow}>
          <View style={oc.thumb}>
            {firstItem?.imageUrl ? (
              <Image
                source={{ uri: firstItem.imageUrl }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
                transition={150}
              />
            ) : (
              <View style={oc.thumbFallback}>
                <Ionicons name="medkit-outline" size={20} color={kit.color.inkFaint} />
              </View>
            )}
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <UIText
              variant="body-sm"
              weight="bold"
              style={{ textAlign: textAlignStart(isRtl()) }}
              numberOfLines={2}>
              {firstItem?.name ?? t("orders.noItems")}
            </UIText>
            {extraCount > 0 && (
              <UIText
                variant="caption"
                color="muted"
                style={{ textAlign: textAlignStart(isRtl()) }}>
                {t("orders.moreItems", { count: extraCount })}
              </UIText>
            )}
          </View>
          <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.inkFaint} />
        </View>

        {/* ── FOOTER: Total price ────────────────────────── */}
        <View style={oc.footer}>
          <UIText variant="caption" color="tertiary">{t("orders.total")}</UIText>
          <UIText style={oc.totalText}>{formatPrice(order.total)}</UIText>
        </View>

      </Pressable>
    </Animated.View>
  );
});

// ─── OrderCard internal styles ────────────────────────────────────────────────

const oc = StyleSheet.create({
  headerRow: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           10,
  },
  // Circular status icon bubble
  statusCircle: {
    width:          40,
    height:         40,
    borderRadius:   99,
    alignItems:     "center",
    justifyContent: "center",
  },
  orderRef: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    color:              kit.color.ink,
    textAlign:          textAlignStart(isRtl()),
    letterSpacing:      -0.2,
    includeFontPadding: false,
    lineHeight:         20,
    // The `#XXXXXXXX` suffix is code-shaped; the label is i18n.
    // Composed in JSX as "label #ID" — keep the row aligned-start.
  },
  orderDate: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    color:              kit.color.inkFaint,
    textAlign:          textAlignStart(isRtl()),
    includeFontPadding: false,
    lineHeight:         16,
  },
  // Item row — product thumbnail + name
  itemRow: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             12,
    backgroundColor: kit.color.well,
    borderRadius:    14,
    padding:         12,
  },
  thumb: {
    width:           60,
    height:          60,
    borderRadius:    12,
    overflow:        "hidden",
    backgroundColor: kit.color.surface,
    flexShrink:      0,
  },
  thumbFallback: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
  },
  // Footer — total label + price
  footer: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    paddingTop:     12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  totalText: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    // Total value — LTR-locked so "199.00 EGP" reads canonically in either lang
    textAlign:          valueTextAlign,
    includeFontPadding: false,
    lineHeight:         22,
  },
});

// ─── TrackingTimeline styles ──────────────────────────────────────────────────

const tl = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  // RTL row — step[0] (pending) on RIGHT, step[3] (delivered) on LEFT
  row: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
  },

  // ── Step dot ──────────────────────────────────────────────────────────────
  dot: {
    width:          24,
    height:         24,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         1,
  },
  // Completed step — solid emerald green fill
  dotDone: {
    backgroundColor: EMERALD,
  },
  // Active/current step — teal fill + green glow shadow
  dotCurrent: {
    width:          28,
    height:         28,
    borderRadius:   14,
    backgroundColor: kit.color.accent,
    shadowColor:     EMERALD,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.55,
    shadowRadius:    7,
    elevation:       4,
  },
  // Future step — hollow circle (border only, transparent fill)
  dotFuture: {
    backgroundColor: "transparent",
    borderWidth:     1.5,
    borderColor:     kit.color.lineStrong,
  },

  // ── Connecting line ────────────────────────────────────────────────────────
  line: {
    flex:         1,
    height:       2,
    borderRadius: 1,
  },
  lineActive: { backgroundColor: EMERALD },
  lineGray:   { backgroundColor: kit.color.lineStrong },

  // (cancelled state returns null — no banner needed, status badge handles it)
});
