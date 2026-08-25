import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText, kit, useTheme } from "@pharmacy/ui-native";
import { FORWARD_CHEVRON, flexRow, isRtl } from "@/utils/layout";
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
  const { theme } = useTheme();
  const isUrgent = (order.ageMs ?? 0) > 30 * 60_000;

  const borderStartColor = isUrgent ? theme.colors.status.warning : theme.colors.brand.primary;

  const styles = useMemo(() => StyleSheet.create({
    card: {
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderWidth: 1,
      alignItems: "center",
      gap: 12,
      ...theme.shadows[1],
    },
    cardPressed: {
      opacity: 0.85,
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
      marginHorizontal: 4,
    },
    total: {
      fontSize: 14,
      fontFamily: kit.font.bold,
      color: theme.colors.text.primary,
    },
  }), [theme]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        { borderStartColor, borderStartWidth: 4, flexDirection: flexRow(IS_RTL), backgroundColor: pressed ? theme.colors.canvas.surfaceMuted : theme.colors.canvas.surface, borderColor: theme.colors.border.default }
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
          <View style={[styles.dot, { backgroundColor: theme.colors.text.muted }]} />
          <View style={styles.row}>
            {isUrgent && <Ionicons name="warning" size={12} color={theme.colors.status.warning} style={{ marginEnd: 2 }} />}
            <UIText variant="caption" color={isUrgent ? "warn" : "secondary"}>{formatAge(order.ageMs ?? 0)}</UIText>
          </View>
        </View>
      </View>

      <View style={styles.colCenter}>
        <OrderStatusChip status={order.status} size="sm" />
      </View>

      <View style={styles.colRight}>
        <UIText style={styles.total}>{formatPrice(order.total)}</UIText>
        <Ionicons name={FORWARD_CHEVRON} size={16} color={theme.colors.text.muted} style={{ marginTop: 2 }} />
      </View>
    </Pressable>
  );
}
