/**
 * OrderStatusChip — coloured pill for pharmacist order statuses.
 *
 * Maps every PharmacistOrderStatus to a semantic colour + icon + label key.
 */

import React from "react";

import { StyleSheet, View } from "react-native";

import { Ionicons }         from "@expo/vector-icons";

import { useTranslation }   from "react-i18next";

import { Text as UIText }   from "@pharmacy/ui-native";

import { kit }              from "@pharmacy/ui-native";

import { useDarkColors }    from "@/hooks/useDarkColors";

import { flexRow, isRtl }   from "@/utils/layout";

import type { PharmacistOrderStatus } from "../api/types";



const IS_RTL = isRtl();



interface ChipMeta {

  labelKey: string;

  color:    string;

  bg:       string;

  icon:     React.ComponentProps<typeof Ionicons>["name"];

}



const STATUS_MAP: Record<PharmacistOrderStatus, (c: ReturnType<typeof useDarkColors>) => ChipMeta> = {

  pending:         ({ c }) => ({ labelKey: "pharmacist.statusPending",        color: c.warn,       bg: c.warnTint,    icon: "time-outline"              }),

  confirmed:       ({ c }) => ({ labelKey: "pharmacist.statusConfirmed",      color: c.accentDeep, bg: c.accentTint,  icon: "checkmark-circle-outline"  }),

  verification:    ({ c }) => ({ labelKey: "pharmacist.statusVerification",   color: c.accent,     bg: c.accentTint,  icon: "shield-checkmark-outline"  }),

  payment_pending: ({ c }) => ({ labelKey: "pharmacist.statusPaymentPending", color: c.accentDeep, bg: c.accentTint,  icon: "card-outline"              }),

  payment_approved:({ c }) => ({ labelKey: "pharmacist.statusPaymentApproved",color: c.success,    bg: c.successTint, icon: "checkmark-circle-outline"  }),

  preparing:       ({ c }) => ({ labelKey: "pharmacist.statusPreparing",      color: c.accentDeep, bg: c.accentTint,  icon: "construct-outline"         }),

  ready:           ({ c }) => ({ labelKey: "pharmacist.statusReady",          color: c.accentDeep, bg: c.accentTint,  icon: "cube-outline"              }),

  driver_assigned: ({ c }) => ({ labelKey: "pharmacist.statusDriverAssigned", color: c.inkSoft,    bg: c.well,        icon: "car-outline"               }),

  driver_accepted: ({ c }) => ({ labelKey: "pharmacist.statusDriverAccepted", color: c.inkSoft,    bg: c.well,        icon: "car-sport-outline"         }),

  out_for_delivery:({ c }) => ({ labelKey: "pharmacist.statusOutForDelivery", color: c.accent,     bg: c.accentTint,  icon: "navigate-outline"          }),

  delivered:       ({ c }) => ({ labelKey: "pharmacist.statusDelivered",      color: c.success,    bg: c.successTint, icon: "checkmark-done-outline"    }),

  cancelled:       ({ c }) => ({ labelKey: "pharmacist.statusCancelled",      color: c.danger,     bg: c.dangerTint,  icon: "close-circle-outline"      }),

  archived:        ({ c }) => ({ labelKey: "pharmacist.statusArchived",       color: c.inkFaint,   bg: c.well,        icon: "archive-outline"           }),

};



interface Props {

  status: PharmacistOrderStatus;

  size?:  "sm" | "md";

}



export function OrderStatusChip({ status, size = "md" }: Props) {

  const { t }  = useTranslation();

  const { c }  = useDarkColors();

  const meta   = STATUS_MAP[status]?.(c) ?? STATUS_MAP.pending({ c });

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
