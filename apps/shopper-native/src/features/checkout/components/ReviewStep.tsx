import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { ManualPaymentPanel } from "@/features/payment";
import { BranchCard, type useDeliveryContext } from "@/features/delivery";
import { isManualWalletPayment } from "@/features/checkout";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { type CheckoutFormSchema } from "../schema";
import { type CheckoutPaymentMethod } from "../constants";
import { type CheckoutPricing } from "../types";
import { SectionCard } from "./SectionCard";
import { SummaryRow } from "./SummaryRow";
import { PaymentOptionsList } from "./PaymentOptionsList";
import { CouponInput } from "./CouponInput";
import { summaryStyles, errorStyles } from "./checkout.styles";

const IS_RTL = isRtl();

interface ReviewStepProps {
  values:               CheckoutFormSchema;
  paymentMethod:        CheckoutPaymentMethod;
  requestPos:           boolean;
  couponCode:           string;
  onCouponCodeChange:   (v: string) => void;
  onApplyCoupon:        () => Promise<void>;
  onRemoveCoupon:       () => void;
  couponApplied:        boolean;
  couponError:          string | null;
  couponValidating:     boolean;
  couponDiscountAmount: number;
  appliedCouponCode:    string;
  pricing:              CheckoutPricing;
  deliveryQuote:        ReturnType<typeof useDeliveryContext>;
  submitError:          string | null;
  transferNumber:       string;
  onTransferNumberChange:(v: string) => void;
  receiptUri:           string | null;
  onPickReceipt:        () => void;
  manualPaymentError:   string | null;
  uploadingReceipt:     boolean;
  onEditAddress:        () => void;
  onEditPayment:        () => void;
  onPaymentChange:      (m: CheckoutPaymentMethod) => void;
  onTogglePos:          () => void;
}

export const ReviewStep = React.memo(function ReviewStep({
  values,
  paymentMethod,
  requestPos,
  couponCode,
  onCouponCodeChange,
  onApplyCoupon,
  onRemoveCoupon,
  couponApplied,
  couponError,
  couponValidating,
  couponDiscountAmount,
  appliedCouponCode,
  pricing,
  deliveryQuote,
  submitError,
  transferNumber,
  onTransferNumberChange,
  receiptUri,
  onPickReceipt,
  manualPaymentError,
  uploadingReceipt,
  onEditAddress,
  onEditPayment,
  onPaymentChange,
  onTogglePos,
}: ReviewStepProps) {
  const { t, i18n } = useTranslation();
  const sep = i18n.language.startsWith("en") ? ", " : "، ";

  return (
    <Animated.View entering={FadeIn.duration(220)}>
      {/* Branch card */}
      {deliveryQuote.branch && (
        <SectionCard
          title={t("checkout.branchSection")}
          icon="storefront-outline"
          delay={20}
          action={{ label: t("checkout.changeBranch"), onPress: onEditAddress }}>
          <BranchCard
            branch={deliveryQuote.branch}
            distanceKm={deliveryQuote.distanceKm ?? undefined}
            compact
          />

          {/* ── Estimated delivery timeline card ───────────────────────── */}
          <View style={s.etaCard}>
            <View style={[s.etaRow, { flexDirection: flexRow(IS_RTL) }]}>
              {/* Prep step */}
              <View style={s.etaStep}>
                <View style={[s.etaIcon, s.etaIconPrep]}>
                  <Ionicons name="construct-outline" size={13} color={kit.color.accentDeep} />
                </View>
                <UIText style={s.etaStepLabel}>{t("checkout.etaPrep", "تجهيز")}</UIText>
                <UIText style={s.etaStepValue}>{t("checkout.etaPrepTime", "10–20 د")}</UIText>
              </View>

              <View style={s.etaConnector} />

              {/* Dispatch step */}
              <View style={s.etaStep}>
                <View style={[s.etaIcon, s.etaIconDispatch]}>
                  <Ionicons name="car-outline" size={13} color="#1D4ED8" />
                </View>
                <UIText style={s.etaStepLabel}>{t("checkout.etaDispatch", "توصيل")}</UIText>
                <UIText style={s.etaStepValue}>
                  {t("checkout.etaText", {
                    min: deliveryQuote.eta.min,
                    max: deliveryQuote.eta.max,
                  })}
                </UIText>
              </View>

              <View style={s.etaConnector} />

              {/* Delivery step */}
              <View style={s.etaStep}>
                <View style={[s.etaIcon, s.etaIconDone]}>
                  <Ionicons name="home-outline" size={13} color={kit.color.success} />
                </View>
                <UIText style={s.etaStepLabel}>{t("checkout.etaArrival", "وصول")}</UIText>
                <UIText style={s.etaStepValue}>
                  {t("checkout.etaTotal", {
                    min: 10 + (deliveryQuote.eta.min ?? 30),
                    max: 20 + (deliveryQuote.eta.max ?? 60),
                  })}
                </UIText>
              </View>
            </View>

            {/* Free / standard delivery indicator */}
            <View style={[s.etaFooter, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons
                name={deliveryQuote.isFree ? "gift-outline" : "bicycle-outline"}
                size={12}
                color={deliveryQuote.isFree ? kit.color.success : kit.color.inkSoft}
              />
              <UIText style={[
                s.etaFooterText,
                deliveryQuote.isFree && s.etaFooterFree,
              ]}>
                {deliveryQuote.isFree
                  ? t("checkout.freeDelivery", "توصيل مجاني")
                  : t("checkout.standardDelivery", { cost: formatPrice(deliveryQuote.cost) })}
              </UIText>
              {deliveryQuote.distanceKm !== null && (
                <UIText style={s.etaFooterDist}>
                  {deliveryQuote.distanceKm.toFixed(1)} {t("common.km", "كم")}
                </UIText>
              )}
            </View>
          </View>
        </SectionCard>
      )}

      {/* Address review */}
      <SectionCard
        title={t("checkout.addressSection")}
        icon="location-outline"
        delay={50}
        action={{ label: t("checkout.editAddress"), onPress: onEditAddress }}>
        <UIText style={s.reviewLine}>{values.fullName}</UIText>
        <UIText style={s.reviewSub}>{values.phone}</UIText>
        <View style={s.reviewDivider} />
        <UIText style={s.reviewLine}>
          {[
            values.streetName,
            values.buildingNumber && t("orders.building", { n: values.buildingNumber }),
            values.floor && t("orders.floor", { n: values.floor }),
            values.apartmentNumber && t("orders.apt", { n: values.apartmentNumber }),
            values.city,
          ]
            .filter(Boolean)
            .join(sep)}
        </UIText>
        {values.note ? <UIText style={s.reviewSub}>{values.note}</UIText> : null}
      </SectionCard>

      {/* Payment review */}
      <SectionCard
        title={t("checkout.paymentSection")}
        icon="card-outline"
        delay={110}
        action={{ label: t("checkout.editPayment"), onPress: onEditPayment }}>
        <PaymentOptionsList selected={paymentMethod} onChange={onPaymentChange} />

        {paymentMethod === "cod" && (
          <Pressable
            onPress={onTogglePos}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: requestPos }}
            accessibilityLabel={t("checkout.posRequest")}
            style={[s.posToggle, requestPos && s.posToggleActive]}>
            <View style={[s.posCheck, requestPos && s.posCheckActive]}>
              {requestPos && <Ionicons name="checkmark" size={11} color="#fff" />}
            </View>
            <UIText style={s.posLabel}>{t("checkout.posRequest")}</UIText>
          </Pressable>
        )}

        {isManualWalletPayment(paymentMethod) && (
          <View style={{ marginTop: 12 }}>
            <ManualPaymentPanel
              transferNumber={transferNumber}
              onTransferNumberChange={onTransferNumberChange}
              receiptUri={receiptUri}
              onPickReceipt={onPickReceipt}
              uploading={uploadingReceipt}
              error={manualPaymentError}
            />
          </View>
        )}

        {/* Coming-soon placeholder */}
        <View style={s.comingSoon}>
          <View style={[s.comingSoonIcon, { backgroundColor: kit.color.well }]}>
            <Ionicons name="link-outline" size={16} color={kit.color.inkFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <UIText style={[s.comingSoonTitle, { color: kit.color.inkFaint }]}>
              {t("checkout.paymentLink")}
            </UIText>
            <UIText style={s.comingSoonSub}>{t("checkout.methodComingSoon")}</UIText>
          </View>
        </View>
      </SectionCard>

      {/* Coupon */}
      <SectionCard title={t("checkout.promoSection")} icon="pricetag-outline" delay={170}>
        <CouponInput
          value={couponCode}
          onChangeText={onCouponCodeChange}
          onApply={onApplyCoupon}
          onRemove={onRemoveCoupon}
          loading={couponValidating}
          applied={couponApplied}
          discountAmount={couponDiscountAmount}
          error={couponError}
          appliedCode={appliedCouponCode}
        />
      </SectionCard>

      {/* Pricing summary */}
      <SectionCard title={t("checkout.summarySection")} icon="receipt-outline" delay={230}>
        <SummaryRow
          label={t("checkout.subtotalRow", { count: pricing.itemCount })}
          value={formatPrice(pricing.subtotal)}
        />
        <SummaryRow
          label={t("checkout.deliveryRow")}
          value={
            deliveryQuote.isFree
              ? t("common.free")
              : formatPrice(deliveryQuote.cost)
          }
          valueColor={deliveryQuote.isFree ? kit.color.success : undefined}
        />
        {pricing.discount > 0 && (
          <SummaryRow
            label={t("checkout.discountRow")}
            value={`-${formatPrice(pricing.discount)}`}
            valueColor={kit.color.success}
          />
        )}
        <View style={summaryStyles.divider} />
        <View style={summaryStyles.totalRow}>
          <UIText style={summaryStyles.totalLabel}>{t("checkout.totalRow")}</UIText>
          <UIText style={summaryStyles.totalValue}>{formatPrice(pricing.total)}</UIText>
        </View>
        <View style={summaryStyles.etaPill}>
          <Ionicons name="time-outline" size={12} color={kit.color.accent} />
          <UIText style={summaryStyles.etaText}>
            {t("checkout.etaText", {
              min: deliveryQuote.eta.min,
              max: deliveryQuote.eta.max,
            })}
          </UIText>
        </View>
      </SectionCard>

      {submitError && (
        <Animated.View entering={FadeIn.duration(200)} style={errorStyles.box}>
          <Ionicons name="alert-circle" size={16} color={kit.color.danger} />
          <UIText style={errorStyles.text}>{submitError}</UIText>
        </Animated.View>
      )}
    </Animated.View>
  );
});

const s = StyleSheet.create({
  // Address review
  reviewLine: {
    fontSize:   13,
    fontFamily: theme.fonts.bold,
    color:      kit.color.ink,
    textAlign:  textAlignStart(isRtl()),
    lineHeight: 20,
  },
  reviewSub: {
    fontSize:   11,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(isRtl()),
  },
  reviewDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.well,
    marginVertical:  6,
  },

  // ── ETA delivery timeline card ──────────────────────────────────────
  etaCard: {
    marginTop:         10,
    backgroundColor:   kit.color.canvas,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    padding:           12,
    gap:               10,
  },
  etaRow: {
    alignItems: "center",
    gap:        6,
  },
  etaStep: {
    flex:       1,
    alignItems: "center",
    gap:        4,
  },
  etaIcon: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  etaIconPrep:     { backgroundColor: kit.color.accentTint },
  etaIconDispatch: { backgroundColor: "#EFF6FF" },
  etaIconDone:     { backgroundColor: kit.color.successTint },
  etaStepLabel: {
    fontSize:   9,
    fontFamily: theme.fonts.bold,
    color:      kit.color.inkSoft,
    textAlign:  "center",
  },
  etaStepValue: {
    fontSize:   10,
    fontFamily: theme.fonts.black,
    color:      kit.color.ink,
    textAlign:  "center",
  },
  etaConnector: {
    flex:            0.3,
    height:          1.5,
    backgroundColor: kit.color.line,
  },
  etaFooter: {
    alignItems:  "center",
    gap:         6,
    paddingTop:  8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  etaFooterText: {
    flex:       1,
    fontSize:   10,
    fontFamily: theme.fonts.bold,
    color:      kit.color.inkSoft,
  },
  etaFooterFree: {
    color: kit.color.success,
  },
  etaFooterDist: {
    fontSize:   10,
    fontFamily: theme.fonts.semibold,
    color:      kit.color.inkFaint,
  },

  // POS toggle
  posToggle: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    gap:            10,
    padding:        12,
    marginTop:      4,
    borderRadius:   12,
    backgroundColor: kit.color.well,
    borderWidth:    1,
    borderColor:    kit.color.line,
  },
  posToggleActive: {
    backgroundColor: kit.color.accentTint,
    borderColor:     kit.color.accent,
  },
  posCheck: {
    width:          18,
    height:         18,
    borderRadius:   5,
    borderWidth:    1.5,
    borderColor:    kit.color.inkFaint,
    alignItems:     "center",
    justifyContent: "center",
  },
  posCheckActive: {
    backgroundColor: kit.color.accent,
    borderColor:     kit.color.accent,
  },
  posLabel: {
    flex:       1,
    fontSize:   12,
    fontFamily: theme.fonts.bold,
    color:      kit.color.inkSoft,
    textAlign:  textAlignStart(isRtl()),
  },

  // Coming-soon payment placeholder
  comingSoonIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  comingSoonTitle: {
    fontSize:   12,
    fontFamily: theme.fonts.bold,
    textAlign:  textAlignStart(isRtl()),
  },
  comingSoonSub: {
    fontSize:   10,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(isRtl()),
  },
  comingSoon: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    gap:            10,
    padding:        12,
    borderRadius:   14,
    borderWidth:    1.5,
    borderStyle:    "dashed",
    borderColor:    kit.color.lineStrong,
    opacity:        0.5,
  },

  // Promo
  promoRow: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "flex-end",
    gap:           8,
  },
  promoBtn: {
    paddingHorizontal: 14,
    paddingVertical:   11,
    borderRadius:      12,
    backgroundColor:   kit.color.accent,
    minWidth:          80,
    alignItems:        "center",
    justifyContent:    "center",
  },
  promoBtnApplied: { backgroundColor: kit.color.lineStrong },
  promoBtnText:    { fontSize: 12, fontFamily: theme.fonts.black, color: "#fff" },
  promoBtnTextApplied: { color: kit.color.inkFaint },
  promoSuccess: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.successTint,
    paddingHorizontal: 10,
    paddingVertical:   7,
    borderRadius:      8,
  },
  promoSuccessText: {
    fontSize:   11,
    fontFamily: theme.fonts.bold,
    color:      kit.color.success,
  },
});
