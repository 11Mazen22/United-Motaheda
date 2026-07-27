/**
 * Checkout — thin orchestrator.
 *
 * All state/logic lives in useCheckoutFlow.
 * All UI lives in src/features/checkout/components/.
 *
 * This file is responsible only for:
 *   - Wiring the hook to sub-components
 *   - Handling navigation (router) and scroll (scrollRef)
 *   - Scroll-to-top side-effect on step change
 *
 * Hardening (Part 1):
 *   - CheckoutErrorFallback: cart-preserving boundary fallback (shows item
 *     count, retry, go-back) replaces the generic white-screen recovery.
 *   - submitInProgressRef: synchronous duplicate-submission guard that fires
 *     BEFORE the async setState for `submitting`, closing the race window
 *     where rapid double-taps could enqueue two submissions while the first
 *     state update is still pending.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { ErrorBoundary } from "@/shared/components";
import { Text as UIText } from "@/shared/ui";
import { CheckoutErrorFallback } from "@/features/checkout/components/CheckoutErrorFallback";

import { kit, Button as KitButton } from "@/shared/kit";
import { isManualWalletPayment } from "@/features/checkout";
import { BACK_CHEVRON, FORWARD_CHEVRON, textAlignStart, isRtl } from "@/utils/layout";
import { PhoneVerifyModal } from "@/features/auth";

const TEXT_START = textAlignStart(isRtl());

import { useCheckoutFlow } from "@/features/checkout/hooks/useCheckoutFlow";
import { AuthGateModal }    from "@/features/checkout/components/AuthGateModal";
import { EmptyCartScreen }  from "@/features/checkout/components/EmptyCartScreen";
import { SuccessScreen }    from "@/features/checkout/components/SuccessScreen";
import { DetailsStep }      from "@/features/checkout/components/DetailsStep";
import { ReviewStep }       from "@/features/checkout/components/ReviewStep";
import { StepPill, StepLine } from "@/features/checkout/components/StepIndicator";
import {
  headerStyles  as hs,
  stepBarStyles as sb,
  ctaStyles     as cs,
  freeBannerStyles as fb,
} from "@/features/checkout/components/checkout.styles";
import { FREE_DELIVERY_THRESHOLD } from "@/features/delivery";
import { formatPrice } from "@/utils/format";

import type { DimensionValue } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

// ─── Public export — wrapped in an error boundary so render failures in any
//     sub-component recover at the screen level.
//
//     The fallback prop provides a cart-preserving recovery UI that:
//       1. Shows the number of items still held in the Zustand cart store
//       2. Offers "retry" (boundary reset) and "go back" (navigate away)
//       3. Never white-screens — imports zero kit/theme dependencies
export default function CheckoutScreenBoundary() {
  const router = useRouter();

  useEffect(() => {
    if (__DEV__) {
      console.log("[CheckoutScreenBoundary] Mounted");
    }
  }, []);

  return (
    <ErrorBoundary
      surface="checkout"
      fallback={(reset, error) => (
        <CheckoutErrorFallback
          error={error}
          onReset={reset}
          onGoBack={() => router.back()}
        />
      )}
    >
      <CheckoutScreen />
    </ErrorBoundary>
  );
}

function CheckoutScreen() {
  const { t }    = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [footerHeight, setFooterHeight] = useState(140);

  const flow = useCheckoutFlow();

  useEffect(() => {
    if (__DEV__) {
      console.log("[CheckoutScreen] Mounted, step:", flow.step, "itemCount:", flow.items.length);
    }
  }, [flow.step, flow.items.length]);


  // ── Scroll to top whenever the step changes ───────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [flow.step]);

  // ── goToReview: hook validates, we scroll on failure ─────────────────
  const handleGoToReview = useCallback(async () => {
    const valid = await flow.goToReview();
    if (!valid) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [flow.goToReview]);

  // ── Reason the confirm button is disabled on Review step ─────────────
  const blockingReason = useMemo(() => {
    if (flow.step !== "review") return null;
    if (!flow.deliveryQuote.isDeliverable) {
      return flow.deliveryQuote.outOfServiceMessage ?? t("checkout.notDeliverable");
    }
    if (isManualWalletPayment(flow.paymentMethod)) {
      const noRef     = !flow.transferNumber.trim();
      const noReceipt = !flow.receiptUri;
      if (noRef && noReceipt) return t("checkout.missingManualPayment");
      if (noRef)              return t("checkout.missingTransferNumber");
      if (noReceipt)          return t("checkout.missingReceipt");
    }
    return null;
  }, [
    flow.step,
    flow.deliveryQuote.isDeliverable,
    flow.deliveryQuote.outOfServiceMessage,
    flow.paymentMethod,
    flow.transferNumber,
    flow.receiptUri,
    t,
  ]);

  // ── Empty cart guard ──────────────────────────────────────────────────
  if (flow.items.length === 0 && flow.step !== "success") {
    return (
      <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>
        <EmptyCartScreen
          onBrowse={() => router.replace("/(tabs)/products")}
          insets={insets}
        />
      </View>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────
  if (flow.step === "success") {
    return (
      <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>
        <SuccessScreen
          orderId={flow.placedOrderId ?? ""}
          total={flow.pricing.total}
          insets={insets}
          onContinue={() => router.replace("/(tabs)")}
          onViewOrders={() => router.push("/orders")}
        />
      </View>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────
  // keyboardVerticalOffset accounts for the fixed header height + safe-area
  // so inputs scroll into view above the keyboard, not behind the sticky CTA.
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: kit.color.canvas }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 56 : 0}>
      <StatusBar style="dark" />

      {/* Auth gate — intercepts unauthenticated order attempts */}
      <AuthGateModal
        visible={flow.showAuthGate}
        onSignIn={() => {
          flow.setShowAuthGate(false);
          router.push("/(auth)/login");
        }}
        onDismiss={() => flow.setShowAuthGate(false)}
      />

      {/* Header */}
      <View style={[hs.root, { paddingTop: insets.top + 10 }]}>
        <Pressable style={hs.backTouchable} onPress={() => router.back()} hitSlop={8}>
          {({ pressed }) => (
            <View style={[hs.backBtn, pressed && hs.backBtnPressed]}>
              <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
            </View>
          )}
        </Pressable>
        <View style={{ flex: 1 }}>
          <UIText variant="card-title" align={TEXT_START}>
            {t("checkout.title")}
          </UIText>
          <UIText variant="eyebrow" color="tertiary" align={TEXT_START}>
            {flow.step === "details"
              ? t("checkout.titleStep1")
              : t("checkout.titleStep2")}
          </UIText>
        </View>
        <View style={hs.badge}>
          <Ionicons name="shield-checkmark" size={12} color={kit.color.success} />
          <UIText variant="eyebrow" style={{ color: kit.color.success }}>
            {t("checkout.secure")}
          </UIText>
        </View>
      </View>

      {/* Step bar */}
      <View style={sb.root}>
        <StepPill
          index={1}
          label={t("checkout.stepDelivery")}
          active={flow.step === "details"}
          done={flow.step === "review"}
        />
        <StepLine done={flow.step === "review"} />
        <StepPill
          index={2}
          label={t("checkout.stepReview")}
          active={flow.step === "review"}
          done={false}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: footerHeight + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Free-delivery progress banner */}
        {!flow.deliveryQuote.isFree && flow.pricing.subtotal > 0 && (
          <Animated.View entering={FadeInDown.duration(320)} style={fb.root}>
            <View style={fb.head}>
              <View style={fb.iconBox}>
                <Ionicons name="gift-outline" size={14} color={kit.color.warn} />
              </View>
              <View style={{ flex: 1 }}>
                <UIText variant="eyebrow" style={{ color: kit.color.warn }}>
                  {t("cart.freeDelivery")}
                </UIText>
                <UIText variant="body-sm" align={TEXT_START} style={fb.title}>
                  {t("checkout.freeBannerTitle", {
                    amount: formatPrice(flow.deliveryQuote.amountToFreeDelivery),
                  })}
                </UIText>
              </View>
            </View>
            <View style={fb.barTrack}>
              <View
                style={[
                  fb.barFill,
                  {
                    width: `${Math.min(
                      100,
                      (flow.pricing.subtotal / FREE_DELIVERY_THRESHOLD) * 100,
                    )}%` as DimensionValue,
                  },
                ]}
              />
            </View>
          </Animated.View>
        )}

        {flow.step === "details" ? (
          <DetailsStep
            control={flow.form.control}
            errors={flow.form.formState.errors}
            selectedBranchId={flow.selectedBranchId}
            onSelectBranch={(b) => flow.setSelectedBranchId(b.id)}
            deliveryBranch={flow.deliveryQuote.branch}
            outOfServiceMessage={flow.deliveryQuote.outOfServiceMessage}
            user={flow.user}
            savedProfilePhone={flow.savedProfilePhone}
            useAccountProfile={flow.useAccountProfile}
            onToggleAccountProfile={flow.setUseAccountProfile}
            defaultAddress={flow.defaultAddress}
            useSavedAddress={flow.useSavedAddress}
            onToggleSavedAddress={flow.setUseSavedAddress}
            paymentMethod={flow.paymentMethod}
            onPaymentChange={flow.onPaymentChange}
            subtotal={flow.pricing.subtotal}
            onSignIn={() => router.push("/(auth)/login")}
          />
        ) : (
          <ReviewStep
            values={flow.form.getValues()}
            paymentMethod={flow.paymentMethod}
            requestPos={flow.requestPos}
            couponCode={flow.couponCode}
            onCouponCodeChange={flow.setCouponCode}
            onApplyCoupon={flow.handleApplyCoupon}
            onRemoveCoupon={flow.handleRemoveCoupon}
            couponApplied={flow.couponApplied}
            couponError={flow.couponError}
            couponValidating={flow.couponValidating}
            couponDiscountAmount={flow.couponDiscountAmount}
            appliedCouponCode={flow.appliedCouponCode}
            promoApplied={flow.promoApplied}
            pricing={flow.pricing}
            deliveryQuote={flow.deliveryQuote}
            submitError={flow.submitError}
            transferNumber={flow.transferNumber}
            onTransferNumberChange={flow.setTransferNumber}
            receiptUri={flow.receiptUri}
            onPickReceipt={flow.handlePickReceipt}
            manualPaymentError={flow.manualPaymentError}
            uploadingReceipt={flow.uploadingReceipt}
            onEditAddress={flow.backToDetails}
            onEditPayment={flow.backToDetails}
            onPaymentChange={flow.onPaymentChange}
            onTogglePos={flow.onTogglePos}
            control={flow.form.control}
          />
        )}
      </ScrollView>

      {/* Sticky CTA bar — handle + value-clustered totals + primary action */}
      <View
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
        style={[cs.root, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <View style={cs.handle} />
        <View style={cs.totals}>
          <View style={cs.priceCluster}>
            <UIText variant="eyebrow" color="tertiary" align={TEXT_START}>
              {t("checkout.dueTotal")}
            </UIText>
            <UIText variant="sheet-title" align={TEXT_START} style={cs.totalValue}>
              {formatPrice(flow.pricing.total)}
            </UIText>
          </View>
          <View style={cs.countBadge}>
            <Ionicons name="bag-handle" size={12} color={kit.color.accentDeep} />
            <UIText variant="eyebrow" style={{ color: kit.color.accentDeep }}>
              {t("checkout.itemsCount", { count: flow.itemCount })}
            </UIText>
          </View>
        </View>

        {blockingReason && (
          <Animated.View entering={FadeInDown.duration(200)} style={cs.blockBanner}>
            <Ionicons name="warning-outline" size={14} color={kit.color.warn} />
            <UIText style={cs.blockBannerText}>{blockingReason}</UIText>
          </Animated.View>
        )}

        <KitButton
          label={flow.step === "details" ? t("checkout.continueBtn") : t("checkout.confirmBtn")}
          icon={flow.step === "details" ? FORWARD_CHEVRON : "checkmark"}
          iconEnd
          size="lg"
          full
          loading={flow.submitting || flow.uploadingReceipt}
          disabled={
            flow.pricing.subtotal === 0 ||
            !flow.deliveryQuote.isDeliverable ||
            (flow.step === "review" &&
              isManualWalletPayment(flow.paymentMethod) &&
              (!flow.transferNumber.trim() || !flow.receiptUri))
          }
          onPress={
            flow.step === "details"
              ? handleGoToReview
              : flow.form.handleSubmit(flow.onSubmit)
          }
        />
      </View>

      {/* Phone verification modal */}
      <PhoneVerifyModal
        visible={flow.otpPending !== null}
        initialPhone={flow.otpPending?.phone ?? ""}
        onVerified={flow.handleOtpVerified}
        onCancel={flow.handleOtpCancel}
      />
    </KeyboardAvoidingView>
  );
}
