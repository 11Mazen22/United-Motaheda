import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { Text as UIText, useTheme, PressableScale } from "@pharmacy/ui-native";
import { FORWARD_CHEVRON, flexRow, isRtl } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { findBranchById } from "@/features/delivery/branches/data";
import { OrderStatusChip } from "./OrderStatusChip";
import { getOrderAttentionReason } from "../domain/orderAttention";
import { getPrimaryAction, primaryActionLabelKey } from "../domain/orderActions";
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

/**
 * Order queue card — identity, operational state, delivery context, and one
 * contextual next action, in that order of visual weight. Rebuilt (not just
 * restyled) so a pharmacist can read what an order needs without decoding
 * status text: an attention reason gets its own colored strip + label, a
 * linked prescription gets its own row, and the trailing button always
 * names the ONE most relevant next step instead of a bare chevron.
 */
export function OrderQueueCard({ order, onPress }: Props) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { language } = useAppLanguage();
  const isUrgent = (order.ageMs ?? 0) > 30 * 60_000;
  const attention = getOrderAttentionReason(order);
  const branch = order.branchId ? findBranchById(order.branchId) : null;
  const branchName = branch ? (language === "ar" ? branch.nameAr : branch.nameEn) : null;
  const primaryAction = getPrimaryAction(order);

  const accentColor = attention === "prescription_rejected" ? theme.colors.status.error
    : attention ? theme.colors.status.warning
    : isUrgent ? theme.colors.status.warning
    : theme.colors.brand.primary;

  // accentColor above is for the card's left border only -- status.* is
  // tuned for icon/border use (~3:1), not text-on-tint. The action pill
  // renders that color as text on its own ~9% tint, which needs the pair
  // this design system actually built for that (statusSoft.*, verified
  // against packages/design-tokens/semantic.ts).
  const accentSoft = attention === "prescription_rejected" ? theme.colors.statusSoft.error
    : attention ? theme.colors.statusSoft.warning
    : isUrgent ? theme.colors.statusSoft.warning
    : { bg: theme.colors.brand.primaryLight, text: theme.colors.brand.primaryDark };

  const styles = useMemo(() => StyleSheet.create({
    card: {
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      gap: 10,
      ...theme.shadows[1],
    },
    row: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 6,
    },
    identityRow: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      justifyContent: "space-between",
    },
    metaRow: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
    },
    attentionStrip: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
    },
    footerRow: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    actionPill: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 9999,
    },
  }), [theme]);

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.card,
        { borderStartColor: accentColor, borderStartWidth: 4, backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t("pharmacist.orderCardLabel", { id: order.id.slice(-8), customer: order.customerName })}
    >
      {/* Identity */}
      <View style={styles.identityRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.row}>
            <UIText variant="body" weight="bold">#{order.id.slice(-8).toUpperCase()}</UIText>
            <UIText variant="body-sm" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
              {order.customerName || "—"}
            </UIText>
          </View>
          <View style={[styles.metaRow, { marginTop: 4 }]}>
            {isUrgent && <Ionicons name="warning" size={12} color={theme.colors.status.warning} />}
            <UIText variant="caption" color={isUrgent ? "warn" : "muted"}>{formatAge(order.ageMs ?? 0)}</UIText>
            <View style={[styles.dot, { backgroundColor: theme.colors.text.muted }]} />
            <UIText variant="caption" color="muted">{order.items.length} {t("pharmacist.items", "منتجات")}</UIText>
            {branchName ? (
              <>
                <View style={[styles.dot, { backgroundColor: theme.colors.text.muted }]} />
                <UIText variant="caption" color="muted" numberOfLines={1}>{branchName}</UIText>
              </>
            ) : null}
          </View>
        </View>
        <OrderStatusChip status={order.status} size="sm" />
      </View>

      {/* Operational state — attention strip takes priority over everything else */}
      {attention && (
        <View style={[styles.attentionStrip, { backgroundColor: attention === "prescription_rejected" ? theme.colors.statusSoft.error.bg : theme.colors.statusSoft.warning.bg }]}>
          <Ionicons
            name={attention === "prescription_rejected" ? "close-circle" : "document-text"}
            size={13}
            color={attention === "prescription_rejected" ? theme.colors.statusSoft.error.text : theme.colors.statusSoft.warning.text}
          />
          <UIText variant="caption" weight="bold" style={{ color: attention === "prescription_rejected" ? theme.colors.statusSoft.error.text : theme.colors.statusSoft.warning.text }}>
            {t(attention === "prescription_rejected" ? "pharmacist.attentionPrescriptionRejected" : "pharmacist.attentionPrescriptionPending")}
          </UIText>
        </View>
      )}

      {/* Footer: price + contextual next action */}
      <View style={styles.footerRow}>
        <UIText variant="body" weight="bold">{formatPrice(order.total)}</UIText>
        <View style={[styles.actionPill, { backgroundColor: accentSoft.bg }]}>
          <UIText variant="caption" weight="bold" style={{ color: accentSoft.text }}>
            {t(primaryActionLabelKey(primaryAction))}
          </UIText>
          <Ionicons name={FORWARD_CHEVRON} size={12} color={accentSoft.text} />
        </View>
      </View>
    </PressableScale>
  );
}
