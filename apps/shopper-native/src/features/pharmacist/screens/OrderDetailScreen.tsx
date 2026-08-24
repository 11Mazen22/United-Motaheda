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




import { Screen, Text as UIText, kit } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";


import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { formatPrice }            from "@/utils/format";

import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";



import { usePharmacistOrder }    from "../hooks/usePharmacistQueries";

import { usePharmacistMutations} from "../hooks/usePharmacistMutations";

import { PharmacistScreenHeader} from "../components/PharmacistScreenHeader";

import { OrderStatusChip }       from "../components/OrderStatusChip";

import { PharmacistActionDock }  from "../components/PharmacistActionDock";

import type { PharmacistOrder, PharmacistTransitionTarget } from "../api/types";



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



function getPharmacistActions(

  status: PharmacistOrder["status"],

): PharmacistTransitionTarget[] {

  switch (status) {

    case "pending":          return ["verification", "cancelled"];

    case "confirmed":        return ["preparing", "cancelled"];

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



export function PharmacistOrderDetailScreen(): React.ReactElement {

  const { t } = useTranslation();

  const { id } = useLocalSearchParams<{ id: string }>();

  const { theme } = useTheme();

  



  const orderQuery = usePharmacistOrder(id);

  const mutations  = usePharmacistMutations();



  const order   = orderQuery.data;

  const actions = useMemo(

    () => (order ? getPharmacistActions(order.status) : []),

    [order],

  );



  const handleAdvance = useCallback(

    async (target: string) => {

      if (!id) return;
      if (!id || !target) return;
      try {

         await mutations.advance.mutateAsync({ orderId: id, nextStatus: target as unknown as never });

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

      <Screen edgeTop background={theme.colors.canvas.background}>

        <PharmacistScreenHeader title={`#${(id ?? "").slice(-8).toUpperCase()}`} />

        <View style={s.centered}>

          <ActivityIndicator size="large" color={theme.colors.brand.primary} />

        </View>

      </Screen>

    );

  }



  if (!order) {

    return (

      <Screen edgeTop background={theme.colors.canvas.background}>

        <PharmacistScreenHeader title={t("pharmacist.orderNotFound")} />

        <View style={s.centered}>

          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.text.muted} />

          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>

            {t("pharmacist.orderNotFound")}

          </UIText>

        </View>

      </Screen>

    );

  }



  const dockActions = actions.map((action) => ({

    key: action,

    label: actionLabel(action, t),

    variant: action === "cancelled" ? "ghost" as const : "primary" as const,

  }));



  return (

    <Screen edgeTop background={theme.colors.canvas.background} edgeBottom>

      <PharmacistScreenHeader title={t("pharmacist.orderDetails")} />



      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Top: Order number + timestamp + status */}

        <View style={[s.topCard, { backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>

          <View style={[s.row, { justifyContent: "space-between" }]}>

            <View>

              <UIText variant="body">#{order.id.slice(-8).toUpperCase()}</UIText>

              <UIText variant="caption" color="secondary" style={{ marginTop: 4 }}>

                {new Date(order.createdAt || Date.now()).toLocaleString()}

              </UIText>

            </View>

            <OrderStatusChip status={order.status} size="md" />

          </View>

        </View>



        {/* Customer section */}

        <View style={[s.section, { backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default, borderBottomColor: theme.colors.border.default }]}>

          <UIText variant="eyebrow" color="secondary" style={{ marginBottom: 8, textAlign: TEXT_START }}>

            {t("pharmacist.sectionCustomer")}

          </UIText>

          <View style={[s.row, { justifyContent: "space-between" }]}>

            <View>

              <UIText variant="body" weight="bold">{order.customerName}</UIText>

              <UIText variant="body-sm" color="secondary">{order.customerAddress}</UIText>

            </View>

            <Pressable onPress={() => Linking.openURL(`tel:${order.customerPhone}`)} style={[s.phoneBtn, { backgroundColor: theme.colors.brand.primaryLight }]}>

              <Ionicons name="call" size={16} color={theme.colors.brand.primary} />

              <UIText variant="body-sm" style={{ color: theme.colors.brand.primary }}>{order.customerPhone}</UIText>

            </Pressable>

          </View>

        </View>



        {/* Items list */}

        <View style={[s.section, { backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default, borderBottomColor: theme.colors.border.default }]}>

          <UIText variant="eyebrow" color="secondary" style={{ marginBottom: 8, textAlign: TEXT_START }}>

            {t("pharmacist.sectionMedicines")}

          </UIText>

          <View style={s.table}>

            {order.items.map((item, index) => (

              <View key={item.productId} style={[s.tableRow, index === 0 && { borderTopWidth: 0 }, { borderTopColor: theme.colors.border.default }]}>

                {item.imageUrl ? (

                  <ExpoImage source={{ uri: item.imageUrl }} style={s.itemImg} contentFit="contain" />

                ) : (

                  <View style={[s.itemImg, s.itemImgPlaceholder, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>

                    <Ionicons name="medkit" size={16} color={theme.colors.text.muted} />

                  </View>

                )}

                <View style={{ flex: 1, paddingHorizontal: 8 }}>

                  <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>

                    {item.name || item.code || item.productId}

                  </UIText>

                </View>

                <UIText variant="body-sm" style={{ width: 40, textAlign: "center" }}>{item.quantity}</UIText>

                <UIText variant="body-sm" weight="bold" style={{ width: 70, textAlign: "right" }}>

                  {formatPrice(item.lineTotal)}

                </UIText>

              </View>

            ))}

          </View>

        </View>



        {/* Pricing summary */}

        <View style={[s.summaryBox, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>

          <View style={s.summaryRow}>

            <UIText variant="body-sm" color="secondary">{t("pharmacist.subtotal")}</UIText>

            <UIText variant="body-sm">{formatPrice(order.subtotal)}</UIText>

          </View>

          {order.discountTotal > 0 && (

            <View style={s.summaryRow}>

              <UIText variant="body-sm" color="secondary">{t("pharmacist.discount")}</UIText>

              <UIText variant="body-sm" color="danger">-{formatPrice(order.discountTotal)}</UIText>

            </View>

          )}

          <View style={s.summaryRow}>

            <UIText variant="body-sm" color="secondary">{t("pharmacist.shipping")}</UIText>

            <UIText variant="body-sm">{formatPrice(order.shippingFee)}</UIText>

          </View>

          <View style={[s.summaryRow, s.summaryTotal, { borderTopColor: theme.colors.border.default }]}>

            <UIText variant="body" weight="bold">{t("pharmacist.total")}</UIText>

            <UIText variant="body" style={{ color: theme.colors.brand.primary }}>{formatPrice(order.total)}</UIText>

          </View>

        </View>

      </ScrollView>



      {/* Action dock — safe-area aware */}

      <PharmacistActionDock

        actions={dockActions}

        loading={mutations.advance.isPending}

        onAction={handleAdvance}

      />

    </Screen>

  );

}



const s = StyleSheet.create({

  centered: { alignItems: "center", justifyContent: "center", flex: 1 },

  scroll: { paddingBottom: 100 },

  topCard: {

    padding: kit.inset.screen,

    borderBottomWidth: 1,

  },

  row: {

    flexDirection: flexRow(IS_RTL),

    alignItems: "center",

  },

  section: {

    padding: kit.inset.screen,

    marginTop: 8,

    borderTopWidth: 1,

    borderBottomWidth: 1,

  },

  phoneBtn: {

    flexDirection: flexRow(IS_RTL),

    alignItems: "center",

    gap: 4,

    paddingHorizontal: 12,

    paddingVertical: 6,

    borderRadius: 9999,

  },

  table: {

    marginTop: 8,

  },

  tableRow: {

    flexDirection: flexRow(IS_RTL),

    alignItems: "center",

    paddingVertical: 12,

    borderTopWidth: StyleSheet.hairlineWidth,

  },

  itemImg: {

    width: 40,

    height: 40,

    borderRadius: 8,

  },

  itemImgPlaceholder: {

    alignItems: "center",

    justifyContent: "center",

  },

  summaryBox: {

    margin: kit.inset.screen,

    padding: kit.inset.card,

    borderRadius: 8,

    borderWidth: 1,

  },

  summaryRow: {

    flexDirection: flexRow(IS_RTL),

    justifyContent: "space-between",

    paddingVertical: 4,

  },

  summaryTotal: {

    borderTopWidth: 1,

    marginTop: 8,

    paddingTop: 12,

  },

});
