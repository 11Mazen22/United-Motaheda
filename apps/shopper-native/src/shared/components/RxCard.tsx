/**
 * RxCard — prescription summary card. VIP 2026.
 *
 * Two variants:
 *   "active" — hero card (Home above-the-fold): 4px top identity stripe,
 *              52×52 icon tile, drug name + dose, status pill, divider,
 *              next-refill row + full-width refill CTA.
 *   "list"   — compact row (Prescriptions list): 3px start status border,
 *              44×44 icon tile, drug name + dose/doctor + date, refill btn.
 *
 * Status → colour mapping (Clinical Calm, no gradient):
 *   ready    → success (green)
 *   active   → accentDeep (teal)
 *   expiring → warn (amber)
 *   expired  → inkFaint (grey)
 *
 * Performance:
 *   React.memo with custom comparator — ignores onPress/onRefill churn.
 */

import React, { memo, useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { Button } from "@pharmacy/ui-native";
import { Text } from "@pharmacy/ui-native";
import type { Prescription, RxStatus } from "@/stores/prescriptionsStore";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

export type { Prescription, RxStatus };

export interface RxCardProps {
  prescription: Prescription;
  variant?:     "active" | "list";
  onRefill?:    (rx: Prescription) => void;
  onPress?:     (rx: Prescription) => void;
}

// ─── Status tokens ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<RxStatus, string> = {
  ready:    kit.color.success,
  active:   kit.color.accentDeep,
  expiring: kit.color.warn,
  expired:  kit.color.inkFaint,
};
const STATUS_TINT: Record<RxStatus, string> = {
  ready:    kit.color.successTint,
  active:   kit.color.accentTint,
  expiring: kit.color.warnTint,
  expired:  kit.color.well,
};

function statusLabel(rx: Prescription, t: TFunction): string {
  switch (rx.status) {
    case "ready":    return t("rx.statusReady");
    case "active":   return rx.refills > 0 ? t("rx.statusRefills", { count: rx.refills }) : t("rx.statusActive");
    case "expiring": return t("rx.statusExpiring");
    case "expired":  return t("rx.statusExpired");
  }
}

/** Staff review workflow badge — only rendered when not yet approved.
 *  Kept visually distinct (icon + tiny pill) from the medical-lifecycle
 *  status pill above so the two concepts never blur together. */
function ReviewBadge({ reviewStatus, t }: { reviewStatus: Prescription["reviewStatus"]; t: TFunction }): React.ReactElement | null {
  if (!reviewStatus || reviewStatus === "approved") return null;
  const isRejected = reviewStatus === "rejected";
  const color = isRejected ? kit.color.danger : kit.color.warn;
  const tint  = isRejected ? kit.color.dangerTint : kit.color.warnTint;
  return (
    <View style={[rb.badge, { backgroundColor: tint, borderColor: color + "33" }]}>
      <Ionicons name={isRejected ? "close-circle" : "time-outline"} size={10} color={color} />
      <Text weight="bold" style={[rb.text, { color }]} numberOfLines={1}>
        {isRejected ? t("rx.reviewRejected") : t("rx.reviewPending")}
      </Text>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export const RxCard = memo(
  function RxCard({
    prescription: rx,
    variant = "list",
    onRefill,
    onPress,
  }: RxCardProps): React.ReactElement {
    const { t }       = useTranslation();
    const isExpired   = rx.status === "expired";
    const color       = STATUS_COLOR[rx.status];
    const tint        = STATUS_TINT[rx.status];
    const label       = statusLabel(rx, t);
    const refillLabel = t("rx.refillLabel");

    const handlePress  = useCallback(() => onPress?.(rx),  [onPress, rx]);
    const handleRefill = useCallback(() => onRefill?.(rx), [onRefill, rx]);

    // Refill urgency — "ready" and "expiring" get primary (ink) button
    const refillVariant = (rx.status === "ready" || rx.status === "expiring") && !isExpired
      ? "primary"
      : "secondary";

    if (variant === "active") {
      return (
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${rx.name} — ${label}`}
          style={s.activeCardTouchable}>
          {({ pressed }) => (
            <View style={[s.activeCard, pressed && s.activeCardPressed]}>

              {/* 4px identity stripe */}
              <View style={[s.stripe, { backgroundColor: color }]} />

              <View style={s.activeBody}>
                {/* Top: icon tile + name + status pill */}
                <View style={[s.activeTopRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={[s.activeTile, { backgroundColor: tint }]}>
                    <Ionicons name="medkit" size={22} color={color} />
                  </View>
                  <View style={s.flex1}>
                    <Text
                      variant="body"
                      weight="bold"
                      numberOfLines={1}
                      style={[s.activeName, { textAlign: TEXT_START }]}>
                      {rx.name}
                    </Text>
                    <Text
                      variant="caption"
                      numberOfLines={1}
                      style={[s.doseText, { textAlign: TEXT_START }]}>
                      {rx.dose}
                    </Text>
                    <ReviewBadge reviewStatus={rx.reviewStatus} t={t} />
                  </View>
                  {/* Inline status pill */}
                  <View style={[s.statusPill, { backgroundColor: tint }]}>
                    <View style={[s.statusDot, { backgroundColor: color }]} />
                    <Text style={[s.statusPillText, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      {label}
                    </Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={s.activeDivider} />

                {/* Bottom: next refill date + CTA */}
                <View style={[s.activeMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <View>
                    <Text
                      variant="eyebrow"
                      style={[s.nextRefillEyebrow, { textAlign: TEXT_START }]}>
                      {t("rx.nextRefill")}
                    </Text>
                    <Text
                      variant="body-sm"
                      weight="bold"
                      style={[s.nextRefillValue, { textAlign: TEXT_START }]}>
                      {rx.nextRefill}
                    </Text>
                  </View>
                  <Button
                    variant={refillVariant}
                    size="sm"
                    disabled={isExpired}
                    label={refillLabel}
                    onPress={handleRefill}
                  />
                </View>
              </View>
            </View>
          )}
        </Pressable>
      );
    }

    // ── List variant ─────────────────────────────────────────────────────────
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={`${rx.name} — ${label}`}
        style={s.listCardOuter}>
        {({ pressed }) => (
          <View
            style={[
              s.listCard,
              { flexDirection: flexRow(IS_RTL), borderStartColor: color },
              pressed && s.listCardPressed,
            ]}>

            {/* Status icon tile */}
            <View style={[s.listTile, { backgroundColor: tint }]}>
              <Ionicons name="medkit-outline" size={18} color={color} />
            </View>

            {/* Text block */}
            <View style={s.listContent}>
              <Text
                variant="body"
                weight="bold"
                numberOfLines={1}
                style={{ textAlign: TEXT_START, color: isExpired ? kit.color.inkFaint : kit.color.ink }}>
                {rx.name}
              </Text>
              <Text
                variant="caption"
                numberOfLines={1}
                style={{ textAlign: TEXT_START, color: kit.color.inkSoft, marginTop: 2 }}>
                {rx.dose} · {rx.doctor}
              </Text>
              <Text
                style={[s.listDate, { textAlign: TEXT_START }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}>
                {rx.nextRefill}
              </Text>
              <ReviewBadge reviewStatus={rx.reviewStatus} t={t} />
            </View>

            {/* Trailing refill button */}
            <Button
              size="sm"
              variant={refillVariant}
              disabled={isExpired}
              label={refillLabel}
              onPress={handleRefill}
            />
          </View>
        )}
      </Pressable>
    );
  },
  (prev, next) =>
    prev.prescription === next.prescription &&
    prev.variant      === next.variant,
);

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex1: { flex: 1 },

  // ── Active variant ─────────────────────────────────────────────────────────
  activeCardTouchable: {
    borderRadius: kit.radius.lg,
  },
  activeCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  activeCardPressed: {
    opacity: 0.95,
  },
  stripe: {
    height: 4,
    width:  "100%",
  },
  activeBody: {
    padding: 16,
    gap:     0,
  },
  activeTopRow: {
    alignItems: "center",
    gap:        12,
  },
  activeTile: {
    width:          52,
    height:         52,
    borderRadius:   kit.radius.control,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  activeName: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    lineHeight:         22,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  doseText: {
    color:              kit.color.inkSoft,
    marginTop:          2,
    includeFontPadding: false,
  },
  statusPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      kit.radius.pill,
    flexShrink:        0,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  statusDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    includeFontPadding: false,
  },
  activeDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.line,
    marginVertical:  14,
  },
  activeMetaRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  nextRefillEyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    letterSpacing:      0.5,
    includeFontPadding: false,
  },
  nextRefillValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.ink,
    marginTop:          2,
    includeFontPadding: false,
  },

  // ── List variant ───────────────────────────────────────────────────────────
  // Outer Pressable: bare container only (no gap/flexDirection — a function-
  // style Pressable + gap combo corrupts layout on this app's RN/Fabric setup).
  listCardOuter: {
    borderRadius: kit.radius.lg,
    overflow:     "hidden",
    ...kit.shadow.raised,
  },
  // Inner View: all row layout (gap/flexDirection/padding) lives here instead.
  listCard: {
    alignItems:        "center",
    gap:               12,
    paddingVertical:   14,
    paddingHorizontal: 16,
    paddingEnd:        12,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    borderStartWidth:  3,
    // borderStartColor set dynamically above
  },
  listCardPressed: {
    opacity: 0.92,
  },
  listTile: {
    width:          44,
    height:         44,
    borderRadius:   kit.radius.control,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  listContent: {
    flex:     1,
    minWidth: 0,
  },
  listDate: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    color:              kit.color.inkFaint,
    marginTop:          3,
    includeFontPadding: false,
  },
});

// ── Review-status badge ─────────────────────────────────────────────────────
const rb = StyleSheet.create({
  badge: {
    flexDirection:     flexRow(IS_RTL),
    alignSelf:         "flex-start",
    alignItems:        "center",
    gap:               4,
    marginTop:         4,
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
    borderWidth:       1,
  },
  text: {
    fontSize:           9,
    lineHeight:         12,
    includeFontPadding: false,
  },
});
