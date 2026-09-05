/**
 * Checkout — functional-tier screen (A3): clarity and confidence over
 * spectacle. Calm, trustworthy step progression; the only moment of real
 * visual emphasis is the final "Place Order" commit action.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Modal, View, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, SlideOutDown, Layout } from "react-native-reanimated";

import { Text, Button, useTheme } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { useAuth } from "@/features/auth";

import { usePremiumCheckout } from "@/features/checkout/hooks/usePremiumCheckout";
import { isManualWalletPayment, isPromoCodeEligible } from "@/features/checkout";
import { getPaymentMethodConfigs } from "@/features/checkout/constants";
import { ManualPaymentPanel } from "@/features/payment";
import { useCartStore } from "@/stores/cart";
import { AuthGateModal } from "@/features/checkout/components/AuthGateModal";
import { AddressFormDrawer } from "@/features/addresses/components/AddressFormDrawer";
import { useAddressStore } from "@/features/addresses/store";
import type { AddressFormData } from "@/features/addresses/types";
import { useDeliveryQuote } from "@/features/delivery/useDeliveryQuote";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function StepAccordion({
  step,
  title,
  isActive,
  isCompleted,
  onEdit,
  children,
  summary,
}: {
  step: number;
  title: string;
  isActive: boolean;
  isCompleted: boolean;
  onEdit: () => void;
  children: React.ReactNode;
  summary?: string;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <Animated.View layout={Layout.duration(220)} style={[styles.accordionCard, theme.shadows[1], { backgroundColor: theme.colors.canvas.surface, borderColor: isActive ? theme.colors.brand.primary : theme.colors.border.default }]}>
      <Pressable onPress={() => isCompleted && !isActive && onEdit()} style={[styles.accordionHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[styles.stepBadge, { backgroundColor: isActive ? theme.colors.brand.primary : (isCompleted ? theme.colors.status.success : theme.colors.canvas.background) }]}>
          {isCompleted && !isActive ? (
             <Ionicons name="checkmark" size={14} color={theme.colors.text.inverse} />
          ) : (
             <Text variant="caption" weight="bold" style={{ color: isActive ? theme.colors.text.inverse : theme.colors.text.secondary }}>{step}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12 }}>
          <Text variant="h5" style={{ color: isActive ? theme.colors.brand.primary : theme.colors.text.primary, textAlign: TEXT_START }}>{title}</Text>
          {isCompleted && !isActive && summary && (
             <Text variant="body" style={{ color: theme.colors.text.secondary, marginTop: 2, textAlign: TEXT_START }}>
               {summary}
             </Text>
          )}
        </View>
        {isCompleted && !isActive && (
          <Text variant="body" weight="bold" style={{ color: theme.colors.brand.primary }}>{t("common.edit", "Edit")}</Text>
        )}
      </Pressable>

      {isActive && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.accordionBody, { borderTopColor: theme.colors.border.default }]}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

const PROGRESS_STEPS = [1, 2, 3, 4] as const;

function ProgressRail({ activeStep }: { activeStep: 1 | 2 | 3 | 4 }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.railWrap, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
      {PROGRESS_STEPS.map((step, i) => {
        const isDone = step < activeStep;
        const isCurrent = step === activeStep;
        const fillColor = isDone || isCurrent ? theme.colors.brand.primary : theme.colors.border.default;
        return (
          <React.Fragment key={step}>
            <Animated.View
              layout={Layout.springify().damping(20)}
              style={[
                styles.railNode,
                {
                  backgroundColor: isDone ? theme.colors.brand.primary : theme.colors.canvas.surface,
                  borderColor: fillColor,
                  ...(isCurrent ? theme.shadows[1] : null),
                },
              ]}
            >
              {isDone ? (
                <Ionicons name="checkmark" size={11} color={theme.colors.text.inverse} />
              ) : (
                <View style={[styles.railDot, { backgroundColor: isCurrent ? theme.colors.brand.primary : theme.colors.text.disabled }]} />
              )}
            </Animated.View>
            {i < PROGRESS_STEPS.length - 1 && (
              <View style={[styles.railLine, { backgroundColor: step < activeStep ? theme.colors.brand.primary : theme.colors.border.default }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function LocationDetailsModal({
  address,
  quote,
  visible,
  onClose,
  insetsBottom = 0,
}: {
  address: { street: string; building?: string; apartment?: string; city: string; lat?: number; lng?: number };
  quote: ReturnType<typeof useDeliveryQuote>;
  visible: boolean;
  onClose: () => void;
  insetsBottom?: number;
}) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();

  if (!address) return null;
  const branch = quote.branch;
  const branchName = branch ? (i18n.language === "en" ? branch.nameEn : branch.nameAr) : null;
  const branchHours = branch ? (i18n.language === "en" ? branch.hoursEn : branch.hoursAr) : null;

  // Plain RN <Modal> instead of the @gorhom/bottom-sheet-backed <BottomSheet>
  // — that one's present()/dismiss() ref calls and state all fired
  // correctly (confirmed live via logcat: every step of the visible=true
  // chain ran through cleanly) but the sheet itself never actually painted
  // on screen, with no error anywhere. Rather than debug a third-party
  // gesture library's internals blind, this uses the same Modal + Animated
  // slide-in shell already proven working for ThemePickerSheet/
  // AddressFormDrawer in this app.
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.locModalOverlay}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={SlideInDown.springify().damping(24).stiffness(260).mass(0.7)}
          exiting={SlideOutDown.springify().damping(26).stiffness(280).mass(0.7)}
          style={[styles.locModalSheet, { backgroundColor: theme.colors.canvas.surface, paddingBottom: Math.max(insetsBottom, 20) }]}
        >
      <View style={[styles.modalHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <Text variant="h4" style={{ color: theme.colors.text.primary }}>{t("checkout.locationDetails", "Location Details")}</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.close", "Close")}>
          <Ionicons name="close-circle" size={28} color={theme.colors.text.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 0 }}>
        <Text variant="h6" style={{ color: theme.colors.text.primary, marginBottom: 12, textAlign: TEXT_START }}>
          {t("checkout.yourAddress", "Your Delivery Address")}
        </Text>

        <View style={[styles.branchMetaBox, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
          <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomColor: theme.colors.border.default }]}>
            <Ionicons name="home-outline" size={20} color={theme.colors.text.secondary} />
            <Text variant="body" style={{ color: theme.colors.text.primary, flex: 1, paddingHorizontal: 8, textAlign: TEXT_START }}>
              {address.street}, {address.building && `Bldg ${address.building}, `}{address.apartment && `Apt ${address.apartment}, `}{address.city}
            </Text>
          </View>
          <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomWidth: 0 }]}>
            <Ionicons name="navigate-outline" size={20} color={theme.colors.text.secondary} />
            <Text variant="body" style={{ color: theme.colors.text.primary, flex: 1, paddingHorizontal: 8, textAlign: TEXT_START }}>
              {address.lat && address.lng ? t("checkout.gpsVerified", "GPS Coordinates Verified") : t("checkout.gpsMissing", "Approximate Area (No GPS)")}
            </Text>
          </View>
        </View>

        <Text variant="h6" style={{ color: theme.colors.text.primary, marginTop: 24, marginBottom: 12, textAlign: TEXT_START }}>
          {t("checkout.processingBranch", "Assigned Branch & Zone")}
        </Text>

        <View style={[styles.branchMetaBox, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
          <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomColor: theme.colors.border.default }]}>
            <Ionicons name="flash-outline" size={20} color={quote.isDeliverable ? theme.colors.status.success : theme.colors.status.error} />
            <Text variant="body" weight="bold" style={{ color: quote.isDeliverable ? theme.colors.status.success : theme.colors.status.error, flex: 1, paddingHorizontal: 8, textAlign: TEXT_START }}>
              {quote.isDeliverable ? t("checkout.zoneEligible", "Inside Delivery Zone") : t("checkout.zoneIneligible", "Outside Delivery Zone")}
            </Text>
          </View>
          {branch && (
            <>
              <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomColor: theme.colors.border.default }]}>
                <Ionicons name="storefront-outline" size={20} color={theme.colors.text.secondary} />
                <Text variant="body" style={{ color: theme.colors.text.primary, flex: 1, paddingHorizontal: 8, textAlign: TEXT_START }}>{branchName}</Text>
              </View>
              <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomColor: theme.colors.border.default }]}>
                <Ionicons name="time-outline" size={20} color={theme.colors.text.secondary} />
                <Text variant="body" style={{ color: theme.colors.text.primary, flex: 1, paddingHorizontal: 8, textAlign: TEXT_START }}>{branchHours}</Text>
              </View>
              {quote.distanceKm !== null && (
                <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomWidth: 0 }]}>
                  <Ionicons name="map-outline" size={20} color={theme.colors.text.secondary} />
                  <Text variant="body" style={{ color: theme.colors.text.primary, flex: 1, paddingHorizontal: 8, textAlign: TEXT_START }}>
                    {t("checkout.distanceAway", { distance: quote.distanceKm.toFixed(1), defaultValue: `${quote.distanceKm.toFixed(1)} km away` })}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <Button label={t("common.close", "Close")} variant="secondary" onPress={onClose} style={{ marginTop: 24 }} />
      </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PromoCodeField({
  promoCode,
  onApply,
  discount,
}: {
  promoCode: string;
  onApply: (code: string) => void;
  discount: number;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [draft, setDraft] = useState(promoCode);
  const applied = promoCode.trim().length > 0;
  const isValid = applied && discount > 0;
  const isInvalid = applied && discount === 0 && !isPromoCodeEligible(promoCode);

  const handleApply = useCallback(() => {
    Haptics.selectionAsync();
    onApply(draft.trim());
  }, [draft, onApply]);

  const handleClear = useCallback(() => {
    setDraft("");
    onApply("");
  }, [onApply]);

  return (
    <View style={[styles.promoCard, { borderColor: isValid ? theme.colors.status.success : theme.colors.border.default, backgroundColor: theme.colors.canvas.surface }]}>
      <View style={[styles.promoRow, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[styles.promoIconWell, { backgroundColor: isValid ? `${theme.colors.status.success}1A` : theme.colors.canvas.surfaceMuted }]}>
          <Ionicons name="pricetag-outline" size={18} color={isValid ? theme.colors.status.success : theme.colors.text.secondary} />
        </View>
        <TextInput
          value={draft}
          onChangeText={(v) => setDraft(v.toUpperCase())}
          placeholder={t("checkout.promoPlaceholder", "Enter discount code")}
          placeholderTextColor={theme.colors.text.muted}
          autoCapitalize="characters"
          editable={!isValid}
          style={[styles.promoInput, { color: theme.colors.text.primary, textAlign: TEXT_START }]}
        />
        {isValid ? (
          <View style={[styles.promoAppliedPill, { backgroundColor: `${theme.colors.status.success}1A` }]}>
            <Text variant="caption" weight="bold" style={{ color: theme.colors.status.success }}>
              {t("checkout.promoApplied", "Applied ✓")}
            </Text>
            <Pressable onPress={handleClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.remove", "Remove")}>
              <Ionicons name="close-circle" size={16} color={theme.colors.status.success} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handleApply}
            disabled={draft.trim().length === 0}
            hitSlop={10}
            style={[styles.promoApplyBtn, { backgroundColor: draft.trim().length === 0 ? theme.colors.canvas.surfaceMuted : theme.colors.brand.primary }]}
            accessibilityRole="button"
            accessibilityLabel={t("checkout.promoApply", "Apply")}
          >
            <Text variant="caption" weight="bold" style={{ color: draft.trim().length === 0 ? theme.colors.text.muted : "#fff" }}>
              {t("checkout.promoApply", "Apply")}
            </Text>
          </Pressable>
        )}
      </View>
      {isValid && (
        <Text variant="caption" weight="bold" style={{ color: theme.colors.status.success, marginTop: 8, textAlign: TEXT_START }}>
          {t("checkout.promoSuccess", "10% discount activated")}
        </Text>
      )}
      {isInvalid && (
        <Text variant="caption" weight="bold" style={{ color: theme.colors.status.error, marginTop: 8, textAlign: TEXT_START }}>
          {t("checkout.promoInvalid", "Invalid discount code")}
        </Text>
      )}
    </View>
  );
}

export default function CheckoutScreen() {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const lang = i18n.language === "en" ? "en" as const : "ar" as const;

  const {
    status,
    addresses,
    selectedAddress,
    setSelectedAddressId,
    paymentMethod,
    setPaymentMethod,
    requestPosMachine,
    setRequestPosMachine,
    transferNumber,
    setTransferNumber,
    receiptUri,
    handlePickReceipt,
    manualPaymentError,
    uploadingReceipt,
    submit,
    pricing,
    errorMsg,
    placedOrderId,
    placedOrderSummary,
    needsPrescription,
    rxRequiredItems,
    approvedPrescriptions,
    selectedPrescriptionIds,
    setSelectedPrescriptionIds,
    promoCode,
    setPromoCode,
  } = usePremiumCheckout();

  const setShippingFee = useCartStore(s => s.setShippingFee);
  const addAddress = useAddressStore(s => s.add);
  const paymentMethodConfigs = useMemo(() => getPaymentMethodConfigs(theme), [theme]);
  const { pagePad } = useScreenLayout();

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const [locationDetailsModal, setLocationDetailsModal] = useState<boolean>(false);

  const handleAddressSubmit = useCallback(async (form: AddressFormData) => {
    if (!user?.id) return;
    await addAddress(user.id, form);
    setIsAddressDrawerOpen(false);
  }, [user?.id, addAddress]);

  const customerCoords = useMemo(
    () => (selectedAddress?.lat && selectedAddress?.lng ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : null),
    [selectedAddress?.lat, selectedAddress?.lng],
  );
  const deliveryAddress = useMemo(
    () => (selectedAddress ? { city: selectedAddress.city, streetName: selectedAddress.street } : undefined),
    [selectedAddress?.city, selectedAddress?.street],
  );
  const quote = useDeliveryQuote({
    subtotal: pricing.subtotal,
    customerCoords,
    address: deliveryAddress,
  });

  useEffect(() => {
    if (quote.cost !== undefined) {
      setShippingFee(quote.cost);
    }
  }, [quote.cost, setShippingFee]);

  // Auto-advances step 1 -> 2 the first time a freshly-selected address
  // resolves as deliverable — but only once per address. Without the ref
  // guard this re-fired every time activeStep was 1 for ANY reason,
  // including the user explicitly tapping "Edit" to go back and change the
  // address: activeStep hits 1, selectedAddress/quote are still the old
  // (deliverable) ones, so the effect immediately bounced back to step 2
  // before the user could touch anything.
  const autoAdvancedForAddressId = useRef<string | null>(null);
  useEffect(() => {
    if (
      status === "READY" &&
      selectedAddress &&
      quote.isDeliverable &&
      activeStep === 1 &&
      autoAdvancedForAddressId.current !== selectedAddress.id
    ) {
       autoAdvancedForAddressId.current = selectedAddress.id;
       setActiveStep(2);
    }
  }, [selectedAddress, quote.isDeliverable, status, activeStep]);

  if (status === "AUTH_REQUIRED") {
    return (
       <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
           <AuthGateModal
              visible={true}
              onSignIn={() => router.replace({ pathname: "/(auth)/login", params: { redirect: "/(customer)/checkout" } })}
              onDismiss={() => (router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)" as never))}
           />
       </View>
    );
  }

  if (status === "SUCCESS") {
    const summary = placedOrderSummary;
    const shortOrderRef = (summary?.orderId ?? placedOrderId ?? "").slice(-8).toUpperCase();
    const orderDate = summary?.createdAt ? new Date(summary.createdAt) : new Date();
    const locale = lang === "ar" ? "ar-EG" : "en-GB";

    return (
       <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
         <ScrollView
           contentContainerStyle={[styles.successScroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
           showsVerticalScrollIndicator={false}
         >
          <Animated.View entering={FadeIn.duration(400)} style={styles.successContent}>
             <View style={styles.successGlowWrap}>
                <View style={[styles.successGlow, { backgroundColor: `${theme.colors.status.success}22` }]} />
                <Animated.View entering={FadeIn.delay(150).duration(500).springify()} style={[styles.successIconCircle, { backgroundColor: `${theme.colors.status.success}1A` }]}>
                   <Ionicons name="checkmark-circle" size={96} color={theme.colors.status.success} />
                </Animated.View>
             </View>

             <Animated.View entering={FadeInDown.delay(280).duration(400)}>
                <Text variant="h1" style={{ color: theme.colors.text.primary, marginTop: 28, textAlign: "center" }}>
                   {t("checkout.orderPlaced", "Order Confirmed")}
                </Text>
                <Text variant="body" style={{ color: theme.colors.text.secondary, marginTop: 10, textAlign: "center", paddingHorizontal: 24, lineHeight: 22 }}>
                   {t("checkout.orderPlacedDesc", "Your order has been received and is being prepared by our pharmacists.")}
                </Text>
             </Animated.View>

             <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[styles.receiptCard, theme.shadows[2], { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>

                {/* Order ref + date */}
                <View style={[styles.receiptHeaderRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <View style={{ flex: 1 }}>
                      <Text variant="caption" style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>{t("checkout.orderNumber", "Order #")}</Text>
                      <Text variant="h5" weight="bold" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }} numberOfLines={1}>#{shortOrderRef}</Text>
                   </View>
                   <View style={{ alignItems: IS_RTL ? "flex-start" : "flex-end" }}>
                      <Text variant="caption" style={{ color: theme.colors.text.muted }}>{t("checkout.orderDate", "Date")}</Text>
                      <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary }} numberOfLines={1}>
                         {orderDate.toLocaleDateString(locale, { day: "numeric", month: "short" })} · {orderDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                   </View>
                </View>

                <View style={[styles.receiptDivider, { borderColor: theme.colors.border.default }]} />

                {/* Items */}
                <Text variant="caption" weight="bold" style={{ color: theme.colors.text.muted, textAlign: TEXT_START, marginBottom: 12, letterSpacing: 0.5, textTransform: "uppercase" }}>
                   {t("checkout.itemsHeader", "Order Items")}
                </Text>
                {(summary?.items ?? []).map((line, idx) => (
                  <View key={idx} style={[styles.receiptItemRow, { flexDirection: flexRow(IS_RTL) }]}>
                     <View style={{ flex: 1, minWidth: 0 }}>
                        <Text variant="body" numberOfLines={2} style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{line.name}</Text>
                        <Text variant="caption" style={{ color: theme.colors.text.muted, textAlign: TEXT_START, marginTop: 2 }}>
                           {line.quantity} × {formatPrice(line.unitPrice, lang)}
                        </Text>
                     </View>
                     <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, flexShrink: 0 }}>
                        {formatPrice(line.unitPrice * line.quantity, lang)}
                     </Text>
                  </View>
                ))}

                <View style={[styles.receiptDivider, { borderColor: theme.colors.border.default }]} />

                {/* Pricing breakdown */}
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.subtotal", "Subtotal")}</Text>
                   <Text variant="body" style={{ color: theme.colors.text.primary }}>{formatPrice(summary?.subtotal ?? 0, lang)}</Text>
                </View>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.deliveryFee", "Shipping")}</Text>
                   <Text variant="body" style={{ color: theme.colors.text.primary }}>{formatPrice(summary?.shipping ?? 0, lang)}</Text>
                </View>
                {(summary?.discount ?? 0) > 0 && (
                  <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                     <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.discount", "Discount")}</Text>
                     <Text variant="body" style={{ color: theme.colors.status.success }}>-{formatPrice(summary?.discount ?? 0, lang)}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL), borderBottomWidth: 0, marginTop: 4 }]}>
                   <Text variant="h6" weight="bold" style={{ color: theme.colors.text.primary }}>{t("checkout.totalPaid", "Total Amount")}</Text>
                   <Text variant="h5" weight="bold" style={{ color: theme.colors.brand.primary }}>{formatPrice(summary?.total ?? 0, lang)}</Text>
                </View>

                <View style={[styles.receiptDivider, { borderColor: theme.colors.border.default }]} />

                {/* Delivery + payment */}
                <View style={{ gap: 14 }}>
                   <View style={[styles.receiptMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
                      <Ionicons name="location-outline" size={18} color={theme.colors.text.muted} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                         <Text variant="caption" style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>{t("checkout.deliveryTo", "Delivery To")}</Text>
                         <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{summary?.addressFormatted}</Text>
                      </View>
                   </View>
                   <View style={[styles.receiptMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
                      <Ionicons name="card-outline" size={18} color={theme.colors.text.muted} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                         <Text variant="caption" style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>{t("payment.paymentMethod", "Payment Method")}</Text>
                         <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>{summary?.paymentLabel}</Text>
                      </View>
                   </View>
                </View>
             </Animated.View>

             <Animated.View entering={FadeInDown.delay(560).duration(400)} style={{ width: "100%", gap: 12, marginTop: 32 }}>
                <Button
                   label={t("checkout.trackOrder", "Track Order")}
                   onPress={() => {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                     router.replace(`/(customer)/(tabs)/orders` as never);
                   }}
                   tone="gradient"
                />
                <Button
                   label={t("checkout.continueShopping", "Continue Shopping")}
                   variant="secondary"
                   onPress={() => router.replace(`/(customer)/(tabs)/products`)}
                />
             </Animated.View>
          </Animated.View>
         </ScrollView>
       </View>
    );
  }

  const isBlocked = status === "LOADING" || status === "SUBMITTING";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>

        <View style={[styles.header, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default, paddingHorizontal: pagePad }]}>
           <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("common.back")}>
              <Ionicons name={BACK_CHEVRON} size={28} color={theme.colors.text.primary} />
           </Pressable>
           <Text variant="h3" style={{ color: theme.colors.text.primary }}>
              {t("checkout.title", "Checkout")}
           </Text>
           <View style={{ width: 28 }} />
        </View>

        <ProgressRail activeStep={activeStep} />

        <ScrollView contentContainerStyle={{ padding: pagePad, paddingBottom: 140, maxWidth: 720, width: "100%", alignSelf: "center" }} showsVerticalScrollIndicator={false}>

           <StepAccordion
             step={1}
             title={t("checkout.delivery", "Delivery Details")}
             isActive={activeStep === 1}
             isCompleted={!!selectedAddress && quote.isDeliverable}
             onEdit={() => setActiveStep(1)}
             summary={selectedAddress ? `${selectedAddress.street}, ${selectedAddress.city}` : undefined}
           >
             {addresses.length === 0 ? (
               <View style={styles.emptyAddress}>
                 <Ionicons name="map-outline" size={48} color={theme.colors.text.muted} />
                 <Text variant="body" style={{ color: theme.colors.text.secondary, marginVertical: 12 }}>
                    {t("checkout.noAddresses", "You have no saved addresses.")}
                 </Text>
                 <Button label={t("checkout.addNewAddress", "Add New Address")} onPress={() => setIsAddressDrawerOpen(true)} />
               </View>
             ) : (
               <View>
                 {addresses.map(addr => (
                   <Pressable
                      key={addr.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedAddressId(addr.id);
                      }}
                      style={[styles.addressCard, { borderColor: selectedAddress?.id === addr.id ? theme.colors.brand.primary : theme.colors.border.default, backgroundColor: selectedAddress?.id === addr.id ? theme.colors.brand.primaryLight : theme.colors.canvas.surface }]}
                   >
                      <View style={[styles.addressCardRow, { flexDirection: flexRow(IS_RTL) }]}>
                        <View style={[styles.radioOuter, { borderColor: selectedAddress?.id === addr.id ? theme.colors.brand.primary : theme.colors.text.muted }]}>
                           {selectedAddress?.id === addr.id && <View style={[styles.radioInner, { backgroundColor: theme.colors.brand.primary }]} />}
                        </View>
                        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12 }}>
                           <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>
                              {addr.label || t("address.labelHome", "Home")}
                           </Text>
                           <Text variant="caption" style={{ color: theme.colors.text.secondary, textAlign: TEXT_START, marginTop: 4 }}>
                              {addr.street}, {addr.building && `Bldg ${addr.building}`}, {addr.city}
                           </Text>
                        </View>
                      </View>
                   </Pressable>
                 ))}

                 <Pressable onPress={() => setIsAddressDrawerOpen(true)} style={[styles.addBtn, { flexDirection: flexRow(IS_RTL) }]}>
                    <Ionicons name="add" size={20} color={theme.colors.brand.primary} />
                    <Text variant="body" weight="bold" style={{ color: theme.colors.brand.primary, paddingHorizontal: 8 }}>
                       {t("checkout.addAddress", "Add another address")}
                    </Text>
                 </Pressable>

                 {selectedAddress && quote.isDeliverable && quote.branch && (
                   <Animated.View entering={FadeIn.delay(200)} style={[styles.smartZoneCard, { backgroundColor: theme.colors.canvas.background, borderColor: theme.colors.status.success }]}>
                      <View style={[styles.smartZoneHeader, { flexDirection: flexRow(IS_RTL) }]}>
                         <Ionicons name="checkmark-circle" size={16} color={theme.colors.status.success} />
                         <Text variant="caption" weight="bold" style={{ color: theme.colors.status.success, paddingHorizontal: 6, letterSpacing: 0.5 }}>
                            {t("checkout.inZone", "IN DELIVERY ZONE")}
                         </Text>
                      </View>
                      <View style={[styles.smartZoneBody, { flexDirection: flexRow(IS_RTL) }]}>
                         <View style={{ flex: 1, minWidth: 0 }}>
                            <Text variant="body" numberOfLines={1} style={{ color: theme.colors.text.secondary, textAlign: TEXT_START }}>
                               {t("checkout.assignedBranch", "Processing from:")} <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary }}>{i18n.language === "en" ? quote.branch.nameEn : quote.branch.nameAr}</Text>
                            </Text>
                         </View>
                         <Pressable onPress={() => setLocationDetailsModal(true)} hitSlop={8} style={{ flexShrink: 0 }}>
                            <Text variant="caption" weight="bold" numberOfLines={1} style={{ color: theme.colors.brand.primary }}>{t("checkout.viewDetails", "Location Details")}</Text>
                         </Pressable>
                      </View>
                   </Animated.View>
                 )}

                 {selectedAddress && !quote.isDeliverable && (
                    <Animated.View entering={FadeIn} style={[styles.warningBox, { backgroundColor: `${theme.colors.status.error}1A`, borderColor: theme.colors.status.error, flexDirection: flexRow(IS_RTL) }]}>
                       <Ionicons name="alert-circle" size={20} color={theme.colors.status.error} />
                       <View style={{ paddingHorizontal: 8, flex: 1 }}>
                         <Text variant="body" weight="bold" style={{ color: theme.colors.status.error, textAlign: TEXT_START }}>
                            {t("checkout.deliveryUnavailable", "Delivery Unavailable")}
                         </Text>
                         {quote.outOfServiceMessage && (
                           <Text variant="caption" style={{ color: theme.colors.status.error, textAlign: TEXT_START, marginTop: 2 }}>
                              {quote.outOfServiceMessage}
                           </Text>
                         )}
                       </View>
                    </Animated.View>
                 )}

                 <Button
                   label={t("common.continue", "Continue")}
                   onPress={() => quote.isDeliverable ? setActiveStep(2) : null}
                   disabled={!selectedAddress || !quote.isDeliverable}
                   style={{ marginTop: 16 }}
                 />
               </View>
             )}
           </StepAccordion>

           <StepAccordion
             step={2}
             title={t("checkout.deliveryMethod", "Delivery Method")}
             isActive={activeStep === 2}
             isCompleted={activeStep > 2}
             onEdit={() => setActiveStep(2)}
             summary={t("checkout.standardDelivery", "Standard Delivery")}
           >
             <View style={[styles.methodCard, { borderColor: theme.colors.brand.primary, backgroundColor: theme.colors.brand.primaryLight, flexDirection: flexRow(IS_RTL) }]}>
                <View style={[styles.methodIconWell, { backgroundColor: theme.colors.canvas.surface }]}>
                  <Ionicons name="bicycle" size={22} color={theme.colors.brand.primary} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                   <Text variant="body" weight="bold" style={{ color: theme.colors.brand.primary, textAlign: TEXT_START }}>{t("checkout.standardDelivery", "Standard Delivery")}</Text>
                   <Text variant="caption" style={{ color: theme.colors.brand.primary, textAlign: TEXT_START }}>
                      {quote.eta ? t("checkout.etaFormat", { min: quote.eta.min, max: quote.eta.max, defaultValue: `${quote.eta.min}-${quote.eta.max} minutes` }) : t("checkout.deliveryTime", "Within 60 minutes")}
                   </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                   <Text variant="body" weight="bold" style={{ color: theme.colors.brand.primary }}>
                      {quote.cost === 0 ? t("checkout.free", "Free") : `+${formatPrice(quote.cost, lang)}`}
                   </Text>
                   <Ionicons name="checkmark-circle" size={24} color={theme.colors.brand.primary} style={{ marginTop: 4 }} />
                </View>
             </View>
             <Button label={t("common.continue", "Continue")} onPress={() => setActiveStep(3)} style={{ marginTop: 16 }} />
           </StepAccordion>

           <StepAccordion
             step={3}
             title={t("checkout.payment", "Payment Method")}
             isActive={activeStep === 3}
             isCompleted={activeStep > 3}
             onEdit={() => setActiveStep(3)}
             summary={t(paymentMethodConfigs.find((m) => m.id === paymentMethod)?.titleKey ?? "checkout.methodCodTitle")}
           >
             {paymentMethodConfigs.map((config) => (
               <Pressable
                 key={config.id}
                 onPress={() => { Haptics.selectionAsync(); setPaymentMethod(config.id); }}
                 style={[styles.methodCard, { borderColor: paymentMethod === config.id ? config.color : theme.colors.border.default, backgroundColor: paymentMethod === config.id ? config.bg : theme.colors.canvas.surface, flexDirection: flexRow(IS_RTL) }]}
               >
                <View style={[styles.methodIconWell, { backgroundColor: paymentMethod === config.id ? theme.colors.canvas.surface : theme.colors.canvas.surfaceMuted }]}>
                  <Ionicons name={config.icon} size={22} color={paymentMethod === config.id ? config.color : theme.colors.text.secondary} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                   <Text variant="body" weight="bold" style={{ color: paymentMethod === config.id ? config.color : theme.colors.text.primary, textAlign: TEXT_START }}>{t(config.titleKey)}</Text>
                   <Text variant="caption" style={{ color: paymentMethod === config.id ? config.color : theme.colors.text.secondary, textAlign: TEXT_START }}>{t(config.descKey)}</Text>
                </View>
                {paymentMethod === config.id && <Ionicons name="checkmark-circle" size={24} color={config.color} />}
               </Pressable>
             ))}

             {paymentMethod === "cod" && (
               <Pressable
                 onPress={() => { Haptics.selectionAsync(); setRequestPosMachine(!requestPosMachine); }}
                 accessibilityRole="checkbox"
                 accessibilityState={{ checked: requestPosMachine }}
                 style={[styles.posCheckboxRow, { flexDirection: flexRow(IS_RTL) }]}
               >
                 <View style={[styles.posCheckbox, requestPosMachine && { backgroundColor: theme.colors.brand.primary, borderColor: theme.colors.brand.primary }]}>
                   {requestPosMachine && <Ionicons name="checkmark" size={13} color="#fff" />}
                 </View>
                 <Text variant="body-sm" weight="bold" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>
                   {t("checkout.requestPosMachine", "Request POS machine with courier")}
                 </Text>
               </Pressable>
             )}

             {isManualWalletPayment(paymentMethod) && (
               <View style={{ marginTop: 4, marginBottom: 8 }}>
                 <ManualPaymentPanel
                   transferNumber={transferNumber}
                   onTransferNumberChange={setTransferNumber}
                   receiptUri={receiptUri}
                   onPickReceipt={handlePickReceipt}
                   uploading={uploadingReceipt}
                   error={manualPaymentError}
                 />
               </View>
             )}

             <Button
               label={t("checkout.reviewOrder", "Review Order")}
               onPress={() => setActiveStep(4)}
               disabled={isManualWalletPayment(paymentMethod) && (!transferNumber.trim() || !receiptUri)}
               style={{ marginTop: 16 }}
             />
           </StepAccordion>

           <StepAccordion
             step={4}
             title={t("checkout.review", "Review & Confirm")}
             isActive={activeStep === 4}
             isCompleted={false}
             onEdit={() => {}}
           >
             {needsPrescription && (
               <View style={[styles.rxCard, { backgroundColor: theme.colors.status.warning + "14", borderColor: theme.colors.status.warning }]}>
                 <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 }}>
                   <Ionicons name="document-text-outline" size={18} color={theme.colors.status.warning} />
                   <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, flex: 1, textAlign: TEXT_START }}>
                     {t("checkout.prescriptionRequired", "This order needs a prescription")}
                   </Text>
                 </View>
                 <Text variant="caption" style={{ color: theme.colors.text.secondary, marginTop: 4, textAlign: TEXT_START }}>
                   {rxRequiredItems.map((i) => i.product.nameAr || i.product.nameEn || i.product.name).join("، ")}
                 </Text>

                 {approvedPrescriptions.length > 0 ? (
                   <>
                     <Text variant="caption" weight="bold" style={{ color: theme.colors.text.secondary, marginTop: 12, textAlign: TEXT_START }}>
                       {t("checkout.selectPrescription", "Select an approved prescription")}
                     </Text>
                     <View style={{ flexDirection: flexRow(IS_RTL), flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                       {approvedPrescriptions.map((rx) => {
                         const picked = selectedPrescriptionIds.includes(rx.id);
                         return (
                           <Pressable
                             key={rx.id}
                             onPress={() => {
                               Haptics.selectionAsync();
                               setSelectedPrescriptionIds(picked
                                 ? selectedPrescriptionIds.filter((id) => id !== rx.id)
                                 : [...selectedPrescriptionIds, rx.id]);
                             }}
                             style={[styles.rxChip, { borderColor: picked ? theme.colors.brand.primary : theme.colors.border.default, backgroundColor: picked ? theme.colors.brand.primaryLight : theme.colors.canvas.surface }]}
                           >
                             {picked && <Ionicons name="checkmark-circle" size={14} color={theme.colors.brand.primary} />}
                             <Text variant="caption" weight="bold" style={{ color: picked ? theme.colors.brand.primary : theme.colors.text.primary }}>{rx.name}</Text>
                           </Pressable>
                         );
                       })}
                     </View>
                   </>
                 ) : (
                   <Pressable
                     onPress={() => router.push("/(customer)/prescriptions/scan" as never)}
                     style={[styles.rxUploadBtn, { borderColor: theme.colors.brand.primary, flexDirection: flexRow(IS_RTL) }]}
                   >
                     <Ionicons name="camera-outline" size={16} color={theme.colors.brand.primary} />
                     <Text variant="body-sm" weight="bold" style={{ color: theme.colors.brand.primary }}>
                       {t("checkout.uploadPrescription", "Upload a prescription")}
                     </Text>
                   </Pressable>
                 )}
               </View>
             )}

             <PromoCodeField promoCode={promoCode} onApply={setPromoCode} discount={pricing.discount} />

             <View style={[styles.summaryCard, { backgroundColor: theme.colors.canvas.background, borderColor: theme.colors.border.default }]}>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.subtotal", "Subtotal")}</Text>
                   <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary }}>{formatPrice(pricing.subtotal, lang)}</Text>
                </View>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.deliveryFee", "Delivery Fee")}</Text>
                    <Text variant="body" weight="bold" style={{ color: pricing.shipping === 0 ? theme.colors.status.success : theme.colors.text.primary }}>{pricing.shipping === 0 ? t("checkout.free", "Free") : formatPrice(pricing.shipping, lang)}</Text>
                </View>
                {pricing.discount > 0 && (
                  <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                     <Text variant="body" style={{ color: theme.colors.status.success }}>{t("checkout.discount", "Discount")}</Text>
                     <Text variant="body" weight="bold" style={{ color: theme.colors.status.success }}>-{formatPrice(pricing.discount, lang)}</Text>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: theme.colors.border.default, flexDirection: flexRow(IS_RTL) }]}>
                   <Text variant="h4" style={{ color: theme.colors.text.primary }}>{t("checkout.total", "Final Total")}</Text>
                   <Text variant="h3" style={{ color: theme.colors.brand.primary }}>{formatPrice(pricing.total, lang)}</Text>
                </View>
             </View>
           </StepAccordion>

        </ScrollView>

        {activeStep === 4 && (
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.footerDock, theme.shadows[3], { backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default, paddingHorizontal: pagePad }]}>
             {errorMsg && (
                <View style={[styles.errorDock, { flexDirection: flexRow(IS_RTL), backgroundColor: `${theme.colors.status.error}1A` }]}>
                   <Ionicons name="warning" size={16} color={theme.colors.status.error} />
                   <Text variant="caption" weight="bold" style={{ color: theme.colors.status.error, marginStart: 6 }}>{errorMsg}</Text>
                </View>
             )}
             <Button
                label={t("checkout.placeOrder", "Place Order")}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  submit();
                }}
                loading={isBlocked}
                disabled={!quote.isDeliverable || (needsPrescription && selectedPrescriptionIds.length === 0)}
                size="lg"
                tone="gradient"
                fullWidth
             />
          </Animated.View>
        )}
      </View>

      {selectedAddress && (
        <LocationDetailsModal
           visible={locationDetailsModal}
           address={selectedAddress}
           quote={quote}
           onClose={() => setLocationDetailsModal(false)}
           insetsBottom={insets.bottom}
        />
      )}

      <AddressFormDrawer visible={isAddressDrawerOpen} onClose={() => setIsAddressDrawerOpen(false)} onSubmit={handleAddressSubmit} loading={false} insetsBottom={insets.bottom} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  locModalOverlay: { flex: 1, justifyContent: "flex-end" },
  locModalSheet: { maxHeight: "85%", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  header: { justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  backBtn: { padding: 4 },

  railWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 32, borderBottomWidth: 1 },
  railNode: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  railDot: { width: 6, height: 6, borderRadius: 3 },
  railLine: { flex: 1, height: 2, marginHorizontal: 4, borderRadius: 1 },

  accordionCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  accordionHeader: { padding: 16, alignItems: "center", justifyContent: "space-between" },
  stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  accordionBody: { padding: 16, paddingTop: 0, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12 },

  addressCard: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  addressCardRow: { padding: 16, alignItems: "center" },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  addBtn: { alignItems: "center", paddingVertical: 12, justifyContent: "center" },
  emptyAddress: { alignItems: "center", paddingVertical: 20 },

  smartZoneCard: { marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  smartZoneHeader: { alignItems: "center", marginBottom: 6 },
  smartZoneBody: { alignItems: "center", justifyContent: "space-between", gap: 12 },

  warningBox: { padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8, alignItems: "center" },

  methodCard: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: "center", marginBottom: 12 },
  methodIconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  posCheckboxRow: { alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8 },
  posCheckbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: "#94A3B8", alignItems: "center", justifyContent: "center" },

  promoCard: { borderRadius: 12, borderWidth: 1.5, padding: 14, marginBottom: 16 },
  promoRow: { alignItems: "center", gap: 10 },
  promoIconWell: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  promoInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 4 },
  promoApplyBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9999, flexShrink: 0 },
  promoAppliedPill: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999, flexShrink: 0 },

  rxCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  rxChip: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, borderWidth: 1 },
  rxUploadBtn: { alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  summaryRow: { justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  summaryTotal: { borderTopWidth: 1, marginTop: 8, paddingTop: 16 },

  footerDock: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  errorDock: { alignItems: "center", padding: 12, borderRadius: 8, marginBottom: 12 },

  successScroll: { flexGrow: 1, paddingHorizontal: 20, maxWidth: 560, width: "100%", alignSelf: "center" },
  successContent: { alignItems: "center" },
  successGlowWrap: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  successGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110 },
  successIconCircle: { width: 140, height: 140, borderRadius: 70, alignItems: "center", justifyContent: "center" },
  receiptCard: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, marginTop: 32 },
  receiptHeaderRow: { alignItems: "flex-start", justifyContent: "space-between" },
  receiptDivider: { borderBottomWidth: StyleSheet.hairlineWidth, marginVertical: 16 },
  receiptItemRow: { alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  receiptMetaRow: { alignItems: "flex-start", gap: 10 },

  modalHeader: { paddingBottom: 16, alignItems: "center", justifyContent: "space-between" },
  branchMetaBox: { borderRadius: 12, padding: 16 },
  branchMetaRow: { alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
