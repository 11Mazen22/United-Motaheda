import React from "react";
import { View, StyleSheet } from "react-native";
import { Text, useTheme, kit } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { isRtl, flexRow } from "@/utils/layout";

export type OrderStatus = "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled" | "rx_pending" | "rx_approved" | "rx_rejected";

export interface StatusBadgeProps {
  status: OrderStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<OrderStatus, { color: string; icon: React.ComponentProps<typeof Ionicons>["name"]; label: string }> = {
  pending: { color: kit.color.warn, icon: "time-outline", label: "Pending" },
  confirmed: { color: kit.color.accent, icon: "checkmark-circle-outline", label: "Confirmed" },
  preparing: { color: kit.color.accent, icon: "cube-outline", label: "Preparing" },
  out_for_delivery: { color: kit.color.accent, icon: "bicycle-outline", label: "Out for Delivery" },
  delivered: { color: kit.color.success, icon: "home-outline", label: "Delivered" },
  cancelled: { color: kit.color.danger, icon: "close-circle-outline", label: "Cancelled" },
  rx_pending: { color: kit.color.warn, icon: "document-text-outline", label: "Rx Pending" },
  rx_approved: { color: kit.color.success, icon: "shield-checkmark-outline", label: "Rx Approved" },
  rx_rejected: { color: kit.color.danger, icon: "alert-circle-outline", label: "Rx Rejected" },
};

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const rtl = isRtl();
  const config = STATUS_CONFIG[status];
  const paddingVertical = size === "sm" ? 4 : 6;
  const paddingHorizontal = size === "sm" ? 8 : 12;
  const iconSize = size === "sm" ? 14 : 16;
  const textVariant = size === "sm" ? "caption" : "label";

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${config.label}`}
      style={[
        s.badge,
        { 
          flexDirection: flexRow(rtl),
          backgroundColor: `${config.color}15`,
          paddingVertical,
          paddingHorizontal,
        }
      ]}
    >
      <Ionicons name={config.icon} size={iconSize} color={config.color} />
      <Text variant={textVariant} style={{ color: config.color, marginLeft: rtl ? 0 : 4, marginRight: rtl ? 4 : 0 }}>
        {config.label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    alignItems: "center",
    borderRadius: kit.radius.pill,
  }
});
