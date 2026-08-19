import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { FORWARD_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { OrderStatusChip } from "./OrderStatusChip";
import type { PharmacistOrder } from "../api/types";

const IS_RTL = isRtl();

interface Props {
  order: PharmacistOrder;
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
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        { borderStartColor, borderStartWidth: 4, flexDirection: flexRow(IS_RTL) }
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id.slice(-8)} for ${order.customerName}`}
    >
      <View style={styles.colMain}>
        <View style={styles.row}>
          <UIText variant="body" weight="bold">#{order.id.slice(-8).toUpperCase()}</UIText>
          <UIText variant="body-sm" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {order.customerName || "—"}
          </UIText>
        </View>
        <View style={[styles.row, { marginTop: 6 }]}>
          <UIText variant="caption" color="muted">{order.items.length} {t("pharmacist.items", "منتجات")}</UIText>
          <View style={styles.dot} />
          <View style={styles.row}>
            {isUrgent && <Ionicons name="warning" size={12} color={kit.color.warn} style={{ marginEnd: 2 }} />}
            <UIText variant="caption" color={isUrgent ? "warn" : "secondary"}>{formatAge(order.ageMs)}</UIText>
          </View>
        </View>
      </View>

      <View style={styles.colCenter}>
        <OrderStatusChip status={order.status} size="sm" />
      </View>

      <View style={styles.colRight}>
        <UIText style={styles.total}>{formatPrice(order.total)}</UIText>
        <Ionicons name={FORWARD_CHEVRON} size={16} color={kit.color.inkFaint} style={{ marginTop: 2 }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: kit.color.line,
    alignItems: "center",
    gap: 12,
    ...kit.shadow.card,
  },
  cardPressed: {
    backgroundColor: kit.color.well,
  },
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 6,
  },
  colMain: {
    flex: 1,
    alignItems: "flex-start",
  },
  colCenter: {
    alignItems: "flex-end",
  },
  colRight: {
    alignItems: "flex-end",
    minWidth: 60,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: kit.color.inkFaint,
    marginHorizontal: 4,
  },
  total: {
    fontSize: 14,
    fontFamily: kit.font.bold,
    color: kit.color.ink,
  },
});
