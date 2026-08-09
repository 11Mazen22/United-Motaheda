/**
 * OrderQueueCard — compact card for the pharmacist order queue list.
 * Shows: customer name, short order ID, age, item count, total, status chip.
 * Tapping navigates to the full order detail.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons }         from "@expo/vector-icons";
import { useTranslation }   from "react-i18next";
import { Text as UIText }   from "@pharmacy/ui-native";
import { kit }              from "@pharmacy/ui-native";
import { theme }            from "@pharmacy/design-tokens";
import { FORWARD_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice }      from "@/utils/format";
import { OrderStatusChip }  from "./OrderStatusChip";
import type { PharmacistOrder } from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface Props {
  order:   PharmacistOrder;
  onPress: () => void;
}

function formatAge(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function OrderQueueCard({ order, onPress }: Props) {
  const { t } = useTranslation();
  const isUrgent = order.ageMs > 30 * 60_000; // > 30 minutes

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.cardPressed, isUrgent && s.cardUrgent]}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id.slice(-8)} for ${order.customerName}`}
    >
      {/* Top row: status + age + chevron */}
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <OrderStatusChip status={order.status} size="sm" />
        <View style={[s.row, { gap: 6 }]}>
          {isUrgent && (
            <View style={s.urgentPill}>
              <Ionicons name="warning" size={11} color={kit.color.danger} />
              <UIText variant="eyebrow" style={{ color: kit.color.danger }}>
                {t("pharmacist.urgent")}
              </UIText>
            </View>
          )}
          <UIText variant="caption" color="secondary">{formatAge(order.ageMs)}</UIText>
          <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.inkFaint} />
        </View>
      </View>

      {/* Customer name + short ID */}
      <UIText
        variant="card-title"
        style={{ textAlign: TEXT_START, marginTop: 8 }}
        numberOfLines={1}
      >
        {order.customerName || "—"}
      </UIText>
      <UIText
        variant="body-sm"
        color="secondary"
        style={{ textAlign: TEXT_START, marginTop: 1 }}
        numberOfLines={1}
      >
        #{order.id.slice(-8).toUpperCase()} · {order.items.length} {t("pharmacist.items")}
      </UIText>

      {/* Footer: payment method + total */}
      <View style={[s.row, { justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: kit.color.line }]}>
        <View style={[s.row, { gap: 5 }]}>
          <Ionicons
            name={order.paymentMethod === "cod" ? "cash-outline" : "card-outline"}
            size={13}
            color={kit.color.inkFaint}
          />
          <UIText variant="caption" color="secondary">
            {order.paymentMethod?.toUpperCase() ?? "—"}
          </UIText>
        </View>
        <UIText style={s.total}>{formatPrice(order.total)}</UIText>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    padding:         16,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
  },
  cardPressed: {
    opacity:   0.87,
    transform: [{ scale: 0.99 }],
  },
  cardUrgent: {
    borderColor: kit.color.danger,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  urgentPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               3,
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.dangerTint,
  },
  total: {
    fontSize:   15,
    fontFamily: theme.fonts.black,
    color:      kit.color.accentDeep,
  },
});
