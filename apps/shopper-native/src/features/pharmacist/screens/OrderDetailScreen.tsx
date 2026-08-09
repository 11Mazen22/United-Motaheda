/**
 * PharmacistOrderDetailScreen — full order detail for the pharmacist.
 *
 * Shows:
 *   - Customer info
 *   - Medicine list with quantities + prices
 *   - Payment section (method, status, proof image)
 *   - Order notes
 *   - Status timeline
 *   - Action panel: advance to next legal status + cancel
 *
 * All transitions go through the transition_order() RPC via
 * usePharmacistMutations.advance — no direct DB writes.
 */

import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Image as ExpoImage }   from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { Ionicons }             from "@expo/vector-icons";
import { useTranslation }       from "react-i18next";

import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { Button, kit }            from "@pharmacy/ui-native";
import { theme }                  from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice }            from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

import { usePharmacistOrder }    from "../hooks/usePharmacistQueries";
import { usePharmacistMutations} from "../hooks/usePharmacistMutations";
import { PharmacistScreenHeader} from "../components/PharmacistScreenHeader";
import { OrderStatusChip }       from "../components/OrderStatusChip";
import type { PharmacistOrder, PharmacistTransitionTarget } from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Legal next status(es) a pharmacist can advance to from a given status. */
function getPharmacistActions(
  status: PharmacistOrder["status"],
): PharmacistTransitionTarget[] {
  switch (status) {
    case "pending":          return ["verification", "cancelled"];
    case "verification":     return ["payment_pending", "payment_approved", "cancelled"];
    case "payment_pending":  return ["payment_approved", "cancelled"];
    case "payment_approved": return ["preparing", "cancelled"];
    case "preparing":        return ["ready", "cancelled"];
    default:                 return [];
  }
}

function actionLabel(target: PharmacistTransitionTarget, t: (k: string) => string): string {
  switch (target) {
    case "verification":    return t("pharmacist.actionVerify");
    case "payment_pending": return t("pharmacist.actionRequestPayment");
    case "payment_approved":return t("pharmacist.actionApprovePayment");
    case "preparing":       return t("pharmacist.actionStartPreparing");
    case "ready":           return t("pharmacist.actionMarkReady");
    case "cancelled":       return t("pharmacist.actionCancel");
    default:                return target;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={[sr.infoRow, { flexDirection: flexRow(IS_RTL) }]}>
      <UIText variant="body-sm" color="secondary" style={{ flex: 1, textAlign: TEXT_START }}>
        {label}
      </UIText>
      <UIText variant="body-sm" style={{ textAlign: TEXT_START, maxWidth: "55%" }} numberOfLines={3}>
        {value}
      </UIText>
    </View>
  );
}

function Section({
  title, icon, children,
}: { title: string; icon: React.ComponentProps<typeof Ionicons>["name"]; children: React.ReactNode }) {
  return (
    <View style={sr.section}>
      <View style={[sr.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={sr.sectionIcon}>
          <Ionicons name={icon} size={14} color={kit.color.accentDeep} />
        </View>
        <UIText variant="card-title" style={{ textAlign: TEXT_START }}>
          {title}
        </UIText>
      </View>
      <View style={sr.sectionBody}>{children}</View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function PharmacistOrderDetailScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const orderQuery = usePharmacistOrder(id);
  const mutations  = usePharmacistMutations();

  const order   = orderQuery.data;
  const actions = useMemo(
    () => (order ? getPharmacistActions(order.status) : []),
    [order?.status],
  );

  const handleAdvance = useCallback(
    async (target: PharmacistTransitionTarget) => {
      if (!id) return;
      try {
        await mutations.advance.mutateAsync({ orderId: id, nextStatus: target });
        if (target === "cancelled") {
          showSuccessSheet(t("pharmacist.cancelledTitle"), t("pharmacist.cancelledBody"));
        } else {
          showSuccessSheet(t("pharmacist.advancedTitle"), t("pharmacist.advancedBody"));
        }
      } catch (e) {
        showErrorSheet(
          t("pharmacist.actionFailedTitle"),
          e instanceof Error ? e.message : t("pharmacist.actionFailedBody"),
        );
      }
    },
    [id, mutations.advance, t],
  );

  if (orderQuery.isLoading) {
    return (
      <Screen edgeTop background={kit.color.canvas}>
        <PharmacistScreenHeader title={`#${(id ?? "").slice(-8).toUpperCase()}`} />
        <View style={sr.centered}>
          <ActivityIndicator size="large" color={kit.color.accent} />
        </View>
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen edgeTop background={kit.color.canvas}>
        <PharmacistScreenHeader title={t("pharmacist.orderNotFound")} />
        <View style={sr.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={kit.color.inkFaint} />
          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
            {t("pharmacist.orderNotFound")}
          </UIText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader
        title={`#${order.id.slice(-8).toUpperCase()}`}
        subtitle={order.customerName}
        trailing={<OrderStatusChip status={order.status} size="sm" />}
      />

      <ScrollView
        contentContainerStyle={sr.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Customer */}
        <Section title={t("pharmacist.sectionCustomer")} icon="person-outline">
          <InfoRow label={t("pharmacist.name")}  value={order.customerName}  />
          <InfoRow label={t("pharmacist.phone")} value={order.customerPhone} />
          {order.customerAddress ? (
            <InfoRow label={t("pharmacist.address")} value={order.customerAddress} />
          ) : null}
          {order.note ? (
            <InfoRow label={t("pharmacist.note")} value={order.note} />
          ) : null}
        </Section>

        {/* Medicines */}
        <Section title={t("pharmacist.sectionMedicines")} icon="medkit-outline">
          {order.items.map((item) => (
            <View key={item.productId} style={[sr.itemRow, { flexDirection: flexRow(IS_RTL) }]}>
              {item.imageUrl ? (
                <ExpoImage
                  source={{ uri: item.imageUrl }}
                  style={sr.itemImg}
                  contentFit="contain"
                />
              ) : (
                <View style={[sr.itemImg, sr.itemImgPlaceholder]}>
                  <Ionicons name="medkit-outline" size={16} color={kit.color.inkFaint} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>
                  {item.name || item.code || item.productId}
                </UIText>
                {item.code ? (
                  <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
                    {item.code}
                  </UIText>
                ) : null}
              </View>
              <View style={sr.itemMeta}>
                <UIText variant="caption" color="secondary">×{item.quantity}</UIText>
                <UIText variant="body-sm" weight="bold" style={{ color: kit.color.accentDeep }}>
                  {formatPrice(item.lineTotal)}
                </UIText>
              </View>
            </View>
          ))}
          {/* Totals */}
          <View style={sr.divider} />
          <InfoRow label={t("pharmacist.subtotal")}  value={formatPrice(order.subtotal)} />
          {order.discountTotal > 0 && (
            <InfoRow label={t("pharmacist.discount")} value={`-${formatPrice(order.discountTotal)}`} />
          )}
          <InfoRow label={t("pharmacist.shipping")}  value={formatPrice(order.shippingFee)} />
          <View style={[sr.totalRow, { flexDirection: flexRow(IS_RTL) }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.total")}</UIText>
            <UIText style={sr.totalValue}>{formatPrice(order.total)}</UIText>
          </View>
        </Section>

        {/* Payment */}
        <Section title={t("pharmacist.sectionPayment")} icon="card-outline">
          <InfoRow label={t("pharmacist.paymentMethod")} value={order.paymentMethod?.toUpperCase() ?? "—"} />
          <InfoRow label={t("pharmacist.paymentStatus")} value={order.paymentStatus} />
          {order.transferNumber ? (
            <InfoRow label={t("pharmacist.transferNumber")} value={order.transferNumber} />
          ) : null}
          {order.paymentProofUrl ? (
            <Pressable
              onPress={() => void Linking.openURL(order.paymentProofUrl!)}
              style={sr.proofBtn}
            >
              <ExpoImage
                source={{ uri: order.paymentProofUrl }}
                style={sr.proofImg}
                contentFit="cover"
              />
              <View style={sr.proofOverlay}>
                <Ionicons name="open-outline" size={18} color="#fff" />
                <UIText variant="caption" style={{ color: "#fff" }}>
                  {t("pharmacist.viewProof")}
                </UIText>
              </View>
            </Pressable>
          ) : null}
        </Section>

        {/* Actions */}
        {actions.length > 0 && (
          <Section title={t("pharmacist.sectionActions")} icon="checkmark-circle-outline">
            {actions.map((target) => (
              <Button
                key={target}
                label={actionLabel(target, t)}
                variant={target === "cancelled" ? "ghost" : "primary"}
                full
                loading={mutations.advance.isPending}
                onPress={() => void handleAdvance(target)}
                style={{ marginBottom: 10 }}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

const sr = StyleSheet.create({
  scroll:  { paddingBottom: 60 },
  centered:{ alignItems: "center", justifyContent: "center", flex: 1 },
  section: {
    marginHorizontal: kit.inset.screen,
    marginTop:        16,
    backgroundColor:  kit.color.surface,
    borderRadius:     kit.radius.xl,
    borderWidth:      1,
    borderColor:      kit.color.line,
    ...kit.shadow.card,
  },
  sectionHeader: {
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: kit.inset.card,
    paddingTop:        14,
    paddingBottom:     10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  sectionIcon: {
    width:           28,
    height:          28,
    borderRadius:    9,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
  },
  sectionBody: {
    padding: kit.inset.card,
    gap:     8,
  },
  infoRow: {
    alignItems:  "flex-start",
    gap:         12,
    paddingVertical: 4,
  },
  itemRow: {
    alignItems:  "center",
    gap:         12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  itemImg: {
    width:        44,
    height:       44,
    borderRadius: 10,
    overflow:     "hidden",
  },
  itemImgPlaceholder: {
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
  },
  itemMeta: {
    alignItems:  "flex-end",
    gap:         3,
  },
  divider: {
    height:          1,
    backgroundColor: kit.color.line,
    marginVertical:  6,
  },
  totalRow: {
    justifyContent: "space-between",
    alignItems:     "center",
    paddingTop:     8,
  },
  totalValue: {
    fontSize:   17,
    fontFamily: theme.fonts.black,
    color:      kit.color.accentDeep,
  },
  proofBtn: {
    borderRadius:    12,
    overflow:        "hidden",
    marginTop:       8,
    position:        "relative",
  },
  proofImg: {
    width:  "100%",
    height: 180,
  },
  proofOverlay: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    backgroundColor:"rgba(0,0,0,0.45)",
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingVertical:8,
  },
});
