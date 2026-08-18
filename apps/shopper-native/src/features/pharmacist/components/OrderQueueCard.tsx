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
  
  const borderStartColor = isUrgent ? kit.color.warn : kit.color.accent;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.cardPressed, { borderStartColor, borderStartWidth: 4 }]}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id.slice(-8)} for ${order.customerName}`}
    >
      <View style={[s.row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
        <View style={s.colMain}>
          <View style={s.row}>
            <UIText variant="body" weight="bold">#{order.id.slice(-8).toUpperCase()}</UIText>
            <UIText variant="body-sm" color="secondary">{order.customerName || "—"}</UIText>
          </View>
          <View style={[s.row, { marginTop: 4, gap: 12 }]}>
            <UIText variant="caption" color="muted">{order.items.length} {t("pharmacist.items", "منتجات")}</UIText>
          </View>
        </View>

        <View style={s.colCenter}>
          <OrderStatusChip status={order.status} size="sm" />
          <View style={[s.row, { marginTop: 4, alignSelf: "flex-end" }]}>
            {isUrgent && <Ionicons name="warning" size={12} color={kit.color.warn} style={{ marginEnd: 4 }} />}
            <UIText variant="caption" color="secondary">{formatAge(order.ageMs)}</UIText>
          </View>
        </View>

        <View style={s.colRight}>
          <UIText style={s.total}>{formatPrice(order.total)}</UIText>
          <Ionicons name={FORWARD_CHEVRON} size={16} color={kit.color.inkFaint} style={{ marginTop: 4 }} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
  },
  cardPressed: {
    opacity:   0.8,
  },
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  colMain: {
    flex: 1,
    alignItems: "flex-start",
  },
  colCenter: {
    alignItems: "flex-end",
    marginHorizontal: 8,
  },
  colRight: {
    alignItems: "flex-end",
  },
  total: {
    fontSize:   14,
    fontFamily: theme.fonts.bold,
    color:      kit.color.ink,
  },
});
