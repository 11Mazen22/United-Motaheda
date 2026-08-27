/**
 * OrderStatusChip — coloured pill for pharmacist order statuses.
 *
 * Maps every PharmacistOrderStatus to a semantic colour + icon + label key.
 */

import React, { useMemo } from "react";

import { StyleSheet, View } from "react-native";

import { Ionicons }         from "@expo/vector-icons";

import { useTranslation }   from "react-i18next";

import { Text as UIText, useTheme }   from "@pharmacy/ui-native";


import { flexRow, isRtl }   from "@/utils/layout";

import type { PharmacistOrderStatus } from "../api/types";



const IS_RTL = isRtl();



interface ChipMeta {

  labelKey: string;

  color:    string;

  bg:       string;

  icon:     React.ComponentProps<typeof Ionicons>["name"];

}



interface Props {

  status: PharmacistOrderStatus;

  size?:  "sm" | "md";

}



export function OrderStatusChip({ status, size = "md" }: Props) {

  const { t }  = useTranslation();

  const { theme } = useTheme();

  const STATUS_MAP: Record<PharmacistOrderStatus, () => ChipMeta> = useMemo(() => ({

    pending:         () => ({ labelKey: "pharmacist.statusPending",        color: theme.colors.status.warning,       bg: `${theme.colors.status.warning}1A`,    icon: "time-outline"              }),

    verification:    () => ({ labelKey: "pharmacist.statusVerification",   color: theme.colors.brand.primary,     bg: theme.colors.brand.primaryLight,  icon: "shield-checkmark-outline"  }),

    payment_pending: () => ({ labelKey: "pharmacist.statusPaymentPending", color: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight,  icon: "card-outline"              }),

    payment_approved:() => ({ labelKey: "pharmacist.statusPaymentApproved",color: theme.colors.status.success,    bg: `${theme.colors.status.success}1A`, icon: "checkmark-circle-outline"  }),

    preparing:       () => ({ labelKey: "pharmacist.statusPreparing",      color: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight,  icon: "construct-outline"         }),

    ready:           () => ({ labelKey: "pharmacist.statusReady",          color: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight,  icon: "cube-outline"              }),

    driver_assigned: () => ({ labelKey: "pharmacist.statusDriverAssigned", color: theme.colors.text.secondary,    bg: theme.colors.canvas.surfaceMuted,        icon: "car-outline"               }),

    driver_accepted: () => ({ labelKey: "pharmacist.statusDriverAccepted", color: theme.colors.text.secondary,    bg: theme.colors.canvas.surfaceMuted,        icon: "car-sport-outline"         }),

    out_for_delivery:() => ({ labelKey: "pharmacist.statusOutForDelivery", color: theme.colors.brand.primary,     bg: theme.colors.brand.primaryLight,  icon: "navigate-outline"          }),

    delivered:       () => ({ labelKey: "pharmacist.statusDelivered",      color: theme.colors.status.success,    bg: `${theme.colors.status.success}1A`, icon: "checkmark-done-outline"    }),

    cancelled:       () => ({ labelKey: "pharmacist.statusCancelled",      color: theme.colors.status.error,     bg: `${theme.colors.status.error}1A`,  icon: "close-circle-outline"      }),

    archived:        () => ({ labelKey: "pharmacist.statusArchived",       color: theme.colors.text.muted,   bg: theme.colors.canvas.surfaceMuted,        icon: "archive-outline"           }),

  }), [theme]);

  const meta   = STATUS_MAP[status]?.() ?? STATUS_MAP.pending();

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

    borderRadius:      9999,

  },

  chipSm: {

    paddingHorizontal: 8,

    paddingVertical:   3,

  },

});
