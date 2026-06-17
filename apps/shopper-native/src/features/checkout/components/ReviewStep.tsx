import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Controller, type Control } from "react-hook-form";

import { Input } from "@/components/ui/Input";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { ManualPaymentPanel } from "@/features/payment";
import { BranchCard, type useDeliveryContext } from "@/features/delivery";
import { isManualWalletPayment } from "@/features/checkout";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { type CheckoutFormSchema } from "../schema";
import { type CheckoutPaymentMethod, PAYMENT_METHOD_CONFIGS } from "../constants";
import { type CheckoutPricing } from "../types";
import { SectionCard } from "./SectionCard";
import { SummaryRow } from "./SummaryRow";
import { summaryStyles, errorStyles } from "./checkout.styles";

interface ReviewStepProps {
  values:               CheckoutFormSchema;
  paymentMethod:        CheckoutPaymentMethod;
  requestPos:           boolean;
  promoApplied:         boolean;
  promoError:           string | null;
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
  onApplyPromo:         () => void;
  control:              Control<CheckoutFormSchema>;
}

export const ReviewStep = React.memo(function ReviewStep({
  values,
  paymentMethod,
  requestPos,
  promoApplied,
  promoError,
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
  onApplyPromo,
  control,
}: ReviewStepProps) {
  const { t, i18n } = useTranslation();
  const sep = i18n.language.startsWith("en") ? ", " : "ØŒ ";

  const methods = PAYMENT_METHOD_CONFIGS.map((cfg) => ({
    ...cfg,
    title:       t(cfg.titleKey),
    description: t(cfg.descKey),
  }));

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
          <View style={s.etaPillInline}>
            <Ionicons name="time-outline" size={12} color={kit.color.accent} />
            <UIText style={s.etaPillText}>
              {t("checkout.etaText", {
                min: deliveryQuote.eta.min,
                max: deliveryQuote.eta.max,
              })}
            </UIText>
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
        {methods.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => onPaymentChange(m.id)}
            style={[
              s.payOption,
              paymentMethod === m.id && {
                borderColor:     m.color,
                borderWidth:     2,
                backgroundColor: m.bg + "30",
              },
            ]}>
            <View
              style={[
                s.payRadio,
                paymentMethod === m.id && { borderColor: m.color },
              ]}>
              {paymentMethod === m.id && (
                <View style={[s.payRadioDot, { backgroundColor: m.color }]} />
              )}
            </View>
            <View style={[s.payIcon, { backgroundColor: m.bg }]}>
              <Ionicons name={m.icon} size={18} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <UIText style={s.payTitle}>{m.title}</UIText>
              <UIText style={s.paySub}>{m.description}</UIText>
            </View>
          </Pressable>
        ))}

        {paymentMethod === "cod" && (
          <Pressable
            onPress={onTogglePos}
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
          <View style={[s.payIcon, { backgroundColor: kit.color.well }]}>
            <Ionicons name="link-outline" size={16} color={kit.color.inkFaint} />
          </View>
          <View style={{ flex: 1 }}>
            <UIText style={[s.payTitle, { color: kit.color.inkFaint }]}>
              {t("checkout.paymentLink")}
            </UIText>
            <UIText style={s.paySub}>{t("checkout.methodComingSoon")}</UIText>
          </View>
        </View>
      </SectionCard>

      {/* Promo */}
      <SectionCard title={t("checkout.promoSection")} icon="pricetag-outline" delay={170}>
        <Controller
          control={control}
          name="promoCode"
          render={({ field }) => (
            <View style={s.promoRow}>
              <View style={{ flex: 1 }}>
                <Input
                  value={field.value ?? ""}
                  onChangeText={field.onChange}
                  placeholder={t("checkout.promoPlaceholder")}
                  editable={!promoApplied}
                  error={promoError ?? undefined}
                />
              </View>
              <Pressable
                onPress={onApplyPromo}
                disabled={promoApplied}
                style={[s.promoBtn, promoApplied && s.promoBtnApplied]}>
                <UIText style={[s.promoBtnText, promoApplied && s.promoBtnTextApplied]}>
                  {promoApplied
                    ? t("checkout.promoApplied")
                    : t("checkout.promoApply")}
                </UIText>
              </Pressable>
            </View>
          )}
        />
        {promoApplied && (
          <View style={s.promoSuccess}>
            <Ionicons name="gift" size={13} color={kit.color.success} />
            <UIText style={s.promoSuccessText}>{t("checkout.promoSuccess")}</UIText>
          </View>
        )}
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
            value={`âˆ’${formatPrice(pricing.discount)}`}
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

  // ETA pill inline (branch card)
  etaPillInline: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    alignSelf:         "flex-end",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
    marginTop:         8,
  },
  etaPillText: {
    fontSize:   10,
    fontFamily: theme.fonts.bold,
    color:      kit.color.accentDeep,
  },

  // Payment options (compact radio list)
  payOption: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    gap:            10,
    padding:        12,
    borderRadius:   14,
    backgroundColor: "#fff",
    borderWidth:    1.5,
    borderColor:    kit.color.line,
  },
  payRadio: {
    width:          18,
    height:         18,
    borderRadius:   9,
    borderWidth:    2,
    borderColor:    kit.color.inkFaint,
    alignItems:     "center",
    justifyContent: "center",
  },
  payRadioDot: { width: 8, height: 8, borderRadius: 4 },
  payIcon: {
    width:          36,
    height:         36,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  payTitle: {
    fontSize:   12,
    fontFamily: theme.fonts.bold,
    color:      kit.color.ink,
    textAlign:  textAlignStart(isRtl()),
  },
  paySub: {
    fontSize:   10,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(isRtl()),
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
