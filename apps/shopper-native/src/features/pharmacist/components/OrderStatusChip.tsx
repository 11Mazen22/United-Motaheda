/**
 * OrderStatusChip — coloured pill for pharmacist order statuses.
 * Maps every PharmacistOrderStatus to a semantic colour + icon + label key.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons }         from "@expo/vector-icons";
import { useTranslation }   from "react-i18next";
import { Text as UIText }   from "@pharmacy/ui-native";
import { kit }              from "@pharmacy/ui-native";
import { flexRow, isRtl }   from "@/utils/layout";
import type { PharmacistOrderStatus } from "../api/types";

const IS_RTL = isRtl();

interface ChipMeta {
  labelKey: string;
  color:    string;
  bg:       string;
  icon:     React.ComponentProps<typeof Ionicons>["name"];
}

const STATUS_MAP: Record<PharmacistOrderStatus, ChipMeta> = {
  pending:         { labelKey: "pharmacist.statusPending",        color: kit.color.warn,       bg: kit.color.warnTint,    icon: "time-outline"              },
  confirmed:       { labelKey: "pharmacist.statusConfirmed",      color: kit.color.accentDeep, bg: "#EFF6FF",             icon: "checkmark-circle-outline"  },
  verification:    { labelKey: "pharmacist.statusVerification",   color: "#7C3AED",             bg: "#F5F3FF",             icon: "shield-checkmark-outline"  },
  payment_pending: { labelKey: "pharmacist.statusPaymentPending", color: "#B45309",             bg: "#FFFBEB",             icon: "card-outline"              },
  payment_approved:{ labelKey: "pharmacist.statusPaymentApproved",color: kit.color.success,    bg: kit.color.successTint, icon: "checkmark-circle-outline"  },
  preparing:       { labelKey: "pharmacist.statusPreparing",      color: kit.color.accentDeep, bg: kit.color.accentTint,  icon: "construct-outline"         },
  ready:           { labelKey: "pharmacist.statusReady",          color: kit.color.accentDeep, bg: kit.color.accentTint,  icon: "cube-outline"              },
  driver_assigned: { labelKey: "pharmacist.statusDriverAssigned", color: kit.color.inkSoft,    bg: kit.color.well,        icon: "car-outline"               },
  driver_accepted: { labelKey: "pharmacist.statusDriverAccepted", color: kit.color.inkSoft,    bg: kit.color.well,        icon: "car-sport-outline"         },
  out_for_delivery:{ labelKey: "pharmacist.statusOutForDelivery", color: "#1D4ED8",             bg: "#EFF6FF",             icon: "navigate-outline"          },
  delivered:       { labelKey: "pharmacist.statusDelivered",      color: kit.color.success,    bg: kit.color.successTint, icon: "checkmark-done-outline"    },
  cancelled:       { labelKey: "pharmacist.statusCancelled",      color: kit.color.danger,     bg: kit.color.dangerTint,  icon: "close-circle-outline"      },
  archived:        { labelKey: "pharmacist.statusArchived",       color: kit.color.inkFaint,   bg: kit.color.well,        icon: "archive-outline"           },
};

interface Props {
  status: PharmacistOrderStatus;
  size?:  "sm" | "md";
}

export function OrderStatusChip({ status, size = "md" }: Props) {
  const { t }  = useTranslation();
  const meta   = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const small  = size === "sm";

  return (
    <View style={[
      s.chip,
      { backgroundColor: meta.bg },
      small && s.chipSm,
    ]} accessible accessibilityRole="text" accessibilityLabel={t(meta.labelKey)}>
      <Ionicons
        name={meta.icon}
        size={small ? 11 : 13}
        color={meta.color}
      />
      <UIText
        variant={small ? "eyebrow" : "caption"}
        style={{ color: meta.color }}
      >
        {t(meta.labelKey)}
      </UIText>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      kit.radius.pill,
  },
  chipSm: {
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
});
