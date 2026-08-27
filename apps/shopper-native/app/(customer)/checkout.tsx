/**
 * Checkout — functional-tier screen (A3): clarity and confidence over
 * spectacle. Calm, trustworthy step progression; the only moment of real
 * visual emphasis is the final "Place Order" commit action.
 */
import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInDown, Layout } from "react-native-reanimated";

import { Text, Button, BottomSheet, useTheme } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { useAuth } from "@/features/auth";

import { usePremiumCheckout } from "@/features/checkout/hooks/usePremiumCheckout";
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
    <Animated.View layout={Layout.springify().damping(20)} style={[styles.accordionCard, theme.shadows[1], { backgroundColor: theme.colors.canvas.surface, borderColor: isActive ? theme.colors.brand.primary : theme.colors.border.default }]}>
      <Pressable onPress={() => isCompleted && !isActive && onEdit()} style={[styles.accordionHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[styles.stepBadge, { backgroundColor: isActive ? theme.colors.brand.primary : (isCompleted ? theme.colors.status.success : theme.colors.canvas.background) }]}>
          {isCompleted && !isActive ? (
             <Ionicons name="checkmark" size={14} color={theme.colors.text.inverse} />
          ) : (
             <Text variant="caption" weight="bold" style={{ color: isActive ? theme.colors.text.inverse : theme.colors.text.secondary }}>{step}</Text>
          )}
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
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
}: {
  address: { street: string; building?: string; apartment?: string; city: string; lat?: number; lng?: number };
  quote: ReturnType<typeof useDeliveryQuote>;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();

  if (!address) return null;
  const branch = quote.branch;
  const branchName = branch ? (i18n.language === "en" ? branch.nameEn : branch.nameAr) : null;
  const branchHours = branch ? (i18n.language === "en" ? branch.hoursEn : branch.hoursAr) : null;

  return (
    <BottomSheet visible={visible} onDismiss={onClose} snapPoints={["65%", "90%"]}>
      <View style={[styles.modalHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <Text variant="h4" style={{ color: theme.colors.text.primary }}>{t("checkout.locationDetails", "Location Details")}</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.close", "Close")}>
          <Ionicons name="close-circle" size={28} color={theme.colors.text.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
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
    </BottomSheet>
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
    submit,
    pricing,
    errorMsg,
    placedOrderId,
    needsPrescription,
    rxRequiredItems,
    approvedPrescriptions,
    selectedPrescriptionIds,
    setSelectedPrescriptionIds,
  } = usePremiumCheckout();

  const setShippingFee = useCartStore(s => s.setShippingFee);
  const addAddress = useAddressStore(s => s.add);

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const [locationDetailsModal, setLocationDetailsModal] = useState<boolean>(false);

  const handleAddressSubmit = useCallback(async (form: AddressFormData) => {
    if (!user?.id) return;
    await addAddress(user.id, form);
    setIsAddressDrawerOpen(false);
  }, [user?.id, addAddress]);

  const quote = useDeliveryQuote({
    subtotal: pricing.subtotal,
    customerCoords: selectedAddress?.lat && selectedAddress?.lng ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : null,
    address: selectedAddress ? { city: selectedAddress.city, streetName: selectedAddress.street } : undefined,
  });

  useEffect(() => {
    if (quote.cost !== undefined) {
      setShippingFee(quote.cost);
    }
  }, [quote.cost, setShippingFee]);

  useEffect(() => {
    if (status === "READY" && selectedAddress && quote.isDeliverable && activeStep === 1) {
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
    return (
       <View style={[styles.container, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.successContent}>
             <View style={styles.successGlowWrap}>
                <View style={[styles.successGlow, { backgroundColor: `${theme.colors.status.success}22` }]} />
                <Animated.View entering={FadeIn.delay(150).duration(500)} style={[styles.successIconCircle, { backgroundColor: `${theme.colors.status.success}1A` }]}>
                   <Ionicons name="checkmark-circle" size={80} color={theme.colors.status.success} />
                </Animated.View>
             </View>

             <Animated.View entering={FadeInDown.delay(280).duration(400)}>
                <Text variant="h2" style={{ color: theme.colors.text.primary, marginTop: 24, textAlign: "center" }}>
                   {t("checkout.orderPlaced", "Order Confirmed")}
                </Text>
                <Text variant="body" style={{ color: theme.colors.text.secondary, marginTop: 8, textAlign: "center", paddingHorizontal: 20 }}>
                   {t("checkout.orderPlacedDesc", "Your order has been received and is being prepared by our pharmacists.")}
                </Text>
             </Animated.View>

             <Animated.View entering={FadeInDown.delay(400).duration(400)} style={[styles.successDetailsCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.orderNumber", "Order #")}</Text>
                   <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary }}>{placedOrderId}</Text>
                </View>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.totalPaid", "Total Amount")}</Text>
                   <Text variant="body" weight="bold" style={{ color: theme.colors.brand.primary }}>{formatPrice(pricing.total, lang)}</Text>
                </View>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL), borderBottomWidth: 0 }]}>
                   <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("checkout.deliveryTo", "Delivery To")}</Text>
                   <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, maxWidth: "60%", textAlign: TEXT_START }}>
                      {selectedAddress?.street}
                   </Text>
                </View>
             </Animated.View>

             <Animated.View entering={FadeInDown.delay(520).duration(400)} style={{ width: "100%", gap: 12, marginTop: 40 }}>
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
       </View>
    );
  }

  const isBlocked = status === "LOADING" || status === "SUBMITTING";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>

        <View style={[styles.header, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
           <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("common.back")}>
              <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={28} color={theme.colors.text.primary} />
           </Pressable>
           <Text variant="h3" style={{ color: theme.colors.text.primary }}>
              {t("checkout.title", "Checkout")}
           </Text>
           <View style={{ width: 28 }} />
        </View>

        <ProgressRail activeStep={activeStep} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>

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
                        <View style={{ flex: 1, paddingHorizontal: 12 }}>
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
                         <View style={{ flex: 1 }}>
                            <Text variant="body" style={{ color: theme.colors.text.secondary, textAlign: TEXT_START }}>
                               {t("checkout.assignedBranch", "Processing from:")} <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary }}>{i18n.language === "en" ? quote.branch.nameEn : quote.branch.nameAr}</Text>
                            </Text>
                         </View>
                         <Pressable onPress={() => setLocationDetailsModal(true)}>
                            <Text variant="caption" weight="bold" style={{ color: theme.colors.brand.primary }}>{t("checkout.viewDetails", "Location Details")}</Text>
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
             summary={paymentMethod === "cod" ? t("checkout.cod", "Cash on Delivery") : t("checkout.card", "Credit / Debit Card")}
           >
             <Pressable onPress={() => { Haptics.selectionAsync(); setPaymentMethod("cod"); }} style={[styles.methodCard, { borderColor: paymentMethod === "cod" ? theme.colors.brand.primary : theme.colors.border.default, backgroundColor: paymentMethod === "cod" ? theme.colors.brand.primaryLight : theme.colors.canvas.surface, flexDirection: flexRow(IS_RTL) }]}>
                <View style={[styles.methodIconWell, { backgroundColor: paymentMethod === "cod" ? theme.colors.canvas.surface : theme.colors.canvas.surfaceMuted }]}>
                  <Ionicons name="cash-outline" size={22} color={paymentMethod === "cod" ? theme.colors.brand.primary : theme.colors.text.secondary} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                   <Text variant="body" weight="bold" style={{ color: paymentMethod === "cod" ? theme.colors.brand.primary : theme.colors.text.primary, textAlign: TEXT_START }}>{t("checkout.cod", "Cash on Delivery")}</Text>
                   <Text variant="caption" style={{ color: paymentMethod === "cod" ? theme.colors.brand.primary : theme.colors.text.secondary, textAlign: TEXT_START }}>{t("checkout.payAtDoor", "Pay when you receive your order")}</Text>
                </View>
                {paymentMethod === "cod" && <Ionicons name="checkmark-circle" size={24} color={theme.colors.brand.primary} />}
             </Pressable>

              <Pressable onPress={() => { Haptics.selectionAsync(); setPaymentMethod("online"); }} style={[styles.methodCard, { borderColor: paymentMethod === "online" ? theme.colors.brand.primary : theme.colors.border.default, backgroundColor: paymentMethod === "online" ? theme.colors.brand.primaryLight : theme.colors.canvas.surface, flexDirection: flexRow(IS_RTL) }]}>
                 <View style={[styles.methodIconWell, { backgroundColor: paymentMethod === "online" ? theme.colors.canvas.surface : theme.colors.canvas.surfaceMuted }]}>
                   <Ionicons name="card-outline" size={22} color={paymentMethod === "online" ? theme.colors.brand.primary : theme.colors.text.secondary} />
                 </View>
                 <View style={{ flex: 1, paddingHorizontal: 16 }}>
                    <Text variant="body" weight="bold" style={{ color: paymentMethod === "online" ? theme.colors.brand.primary : theme.colors.text.primary, textAlign: TEXT_START }}>{t("checkout.card", "Credit / Debit Card")}</Text>
                    <Text variant="caption" style={{ color: paymentMethod === "online" ? theme.colors.brand.primary : theme.colors.text.secondary, textAlign: TEXT_START }}>{t("checkout.paySecurely", "Pay securely via Stripe")}</Text>
                 </View>
                 {paymentMethod === "online" && <Ionicons name="checkmark-circle" size={24} color={theme.colors.brand.primary} />}
              </Pressable>

             <Button label={t("checkout.reviewOrder", "Review Order")} onPress={() => setActiveStep(4)} style={{ marginTop: 16 }} />
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
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.footerDock, theme.shadows[3], { backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default }]}>
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
        />
      )}

      <AddressFormDrawer visible={isAddressDrawerOpen} onClose={() => setIsAddressDrawerOpen(false)} onSubmit={handleAddressSubmit} loading={false} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  smartZoneBody: { alignItems: "center", justifyContent: "space-between" },

  warningBox: { padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 8, alignItems: "center" },

  methodCard: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: "center", marginBottom: 12 },
  methodIconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  rxCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  rxChip: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, borderWidth: 1 },
  rxUploadBtn: { alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" },
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  summaryRow: { justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  summaryTotal: { borderTopWidth: 1, marginTop: 8, paddingTop: 16 },

  footerDock: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  errorDock: { alignItems: "center", padding: 12, borderRadius: 8, marginBottom: 12 },

  successContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  successGlowWrap: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  successGlow: { position: "absolute", width: 200, height: 200, borderRadius: 100 },
  successIconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  successDetailsCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 20, marginTop: 32 },

  modalHeader: { paddingBottom: 16, alignItems: "center", justifyContent: "space-between" },
  branchMetaBox: { borderRadius: 12, padding: 16 },
  branchMetaRow: { alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
