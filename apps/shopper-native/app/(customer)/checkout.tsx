import React, { useCallback, useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, KeyboardAvoidingView, Modal } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, Layout } from "react-native-reanimated";

import { CustomerUI, kit, Button } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import { useDarkColors } from "@/hooks/useDarkColors";
import { theme } from "@pharmacy/design-tokens";

// Data & State
import { usePremiumCheckout } from "@/features/checkout/hooks/usePremiumCheckout";
import { useCartStore } from "@/stores/cart";
import { AuthGateModal } from "@/features/checkout/components/AuthGateModal";
import { AddressFormDrawer } from "@/features/addresses/components/AddressFormDrawer";
import { useDeliveryQuote } from "@/features/delivery/useDeliveryQuote";
import type { Branch } from "@/features/delivery/branches/types";

const IS_RTL = isRtl();

// --- Subcomponents ---

function StepAccordion({ 
  step, 
  title, 
  isActive, 
  isCompleted, 
  onEdit, 
  children,
  summary
}: any) {
  const { c } = useDarkColors();
  
  return (
    <Animated.View layout={Layout.springify().damping(20)} style={[styles.accordionCard, { backgroundColor: c.surface, borderColor: isActive ? kit.color.accentDeep : c.line }]}>
      <Pressable onPress={() => isCompleted && !isActive && onEdit()} style={[styles.accordionHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[styles.stepBadge, { backgroundColor: isActive ? kit.color.accentDeep : (isCompleted ? kit.color.success : c.canvas) }]}>
          {isCompleted && !isActive ? (
             <Ionicons name="checkmark" size={14} color="#fff" />
          ) : (
             <CustomerUI.Typography variant="caption" weight="bold" color={isActive ? "#fff" : c.inkSoft}>{step}</CustomerUI.Typography>
          )}
        </View>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <CustomerUI.Typography variant="h5" weight="bold" color={isActive ? kit.color.accentDeep : c.ink}>{title}</CustomerUI.Typography>
          {isCompleted && !isActive && summary && (
             <CustomerUI.Typography variant="body" color={c.inkSoft} style={{ marginTop: 2, textAlign: textAlignStart(IS_RTL) }}>
               {summary}
             </CustomerUI.Typography>
          )}
        </View>
        {isCompleted && !isActive && (
          <CustomerUI.Typography variant="body" weight="bold" color={kit.color.accentDeep}>{isRtl() ? "تعديل" : "Edit"}</CustomerUI.Typography>
        )}
      </Pressable>
      
      {isActive && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.accordionBody, { borderTopColor: c.line }]}>
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

function LocationDetailsModal({ 
  address, 
  quote, 
  visible, 
  onClose 
}: { 
  address: any; 
  quote: ReturnType<typeof useDeliveryQuote>; 
  visible: boolean; 
  onClose: () => void; 
}) {
  const { c } = useDarkColors();
  const { t, i18n } = useTranslation();
  
  if (!address) return null;
  const branch = quote.branch;
  const branchName = branch ? (i18n.language === "en" ? branch.nameEn : branch.nameAr) : null;
  const branchHours = branch ? (i18n.language === "en" ? branch.hoursEn : branch.hoursAr) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View entering={SlideInDown.springify()} exiting={SlideOutDown} style={[styles.modalSheet, { backgroundColor: c.surface }]}>
          <View style={styles.modalHandle} />
          
          <View style={[styles.modalHeader, { flexDirection: flexRow(IS_RTL) }]}>
             <CustomerUI.Typography variant="h4" weight="black" color={c.ink}>{t("checkout.locationDetails", "Location Details")}</CustomerUI.Typography>
             <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close-circle" size={28} color={c.inkFaint} />
             </Pressable>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
             {/* Customer Address Info */}
             <CustomerUI.Typography variant="h6" weight="bold" color={c.ink} style={{ marginBottom: 12, textAlign: textAlignStart(IS_RTL) }}>
                {t("checkout.yourAddress", "Your Delivery Address")}
             </CustomerUI.Typography>
             
             <View style={styles.branchMetaBox}>
                <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Ionicons name="home-outline" size={20} color={c.inkSoft} />
                   <CustomerUI.Typography variant="body" color={c.ink} style={{ flex: 1, paddingHorizontal: 8, textAlign: textAlignStart(IS_RTL) }}>
                      {address.street}, {address.building && `Bldg ${address.building}, `}{address.apartment && `Apt ${address.apartment}, `}{address.city}
                   </CustomerUI.Typography>
                </View>
                <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomWidth: 0 }]}>
                   <Ionicons name="navigate-outline" size={20} color={c.inkSoft} />
                   <CustomerUI.Typography variant="body" color={c.ink} style={{ flex: 1, paddingHorizontal: 8, textAlign: textAlignStart(IS_RTL) }}>
                      {address.lat && address.lng ? t("checkout.gpsVerified", "GPS Coordinates Verified") : t("checkout.gpsMissing", "Approximate Area (No GPS)")}
                   </CustomerUI.Typography>
                </View>
             </View>

             {/* Branch & Zone Info */}
             <CustomerUI.Typography variant="h6" weight="bold" color={c.ink} style={{ marginTop: 24, marginBottom: 12, textAlign: textAlignStart(IS_RTL) }}>
                {t("checkout.processingBranch", "Assigned Branch & Zone")}
             </CustomerUI.Typography>
             
             <View style={styles.branchMetaBox}>
                <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <Ionicons name="flash-outline" size={20} color={quote.isDeliverable ? kit.color.success : kit.color.danger} />
                   <CustomerUI.Typography variant="body" weight="bold" color={quote.isDeliverable ? kit.color.success : kit.color.danger} style={{ flex: 1, paddingHorizontal: 8, textAlign: textAlignStart(IS_RTL) }}>
                      {quote.isDeliverable ? t("checkout.zoneEligible", "Inside Delivery Zone") : t("checkout.zoneIneligible", "Outside Delivery Zone")}
                   </CustomerUI.Typography>
                </View>
                {branch && (
                  <>
                    <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
                       <Ionicons name="storefront-outline" size={20} color={c.inkSoft} />
                       <CustomerUI.Typography variant="body" color={c.ink} style={{ flex: 1, paddingHorizontal: 8, textAlign: textAlignStart(IS_RTL) }}>
                          {branchName}
                       </CustomerUI.Typography>
                    </View>
                    <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL) }]}>
                       <Ionicons name="time-outline" size={20} color={c.inkSoft} />
                       <CustomerUI.Typography variant="body" color={c.ink} style={{ flex: 1, paddingHorizontal: 8, textAlign: textAlignStart(IS_RTL) }}>
                          {branchHours}
                       </CustomerUI.Typography>
                    </View>
                    {quote.distanceKm !== null && (
                      <View style={[styles.branchMetaRow, { flexDirection: flexRow(IS_RTL), borderBottomWidth: 0 }]}>
                         <Ionicons name="map-outline" size={20} color={c.inkSoft} />
                         <CustomerUI.Typography variant="body" color={c.ink} style={{ flex: 1, paddingHorizontal: 8, textAlign: textAlignStart(IS_RTL) }}>
                            {t("checkout.distanceAway", { distance: quote.distanceKm.toFixed(1), defaultValue: `${quote.distanceKm.toFixed(1)} km away` })}
                         </CustomerUI.Typography>
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

export default function CheckoutScreen() {
  const { t, i18n } = useTranslation();
  const { c } = useDarkColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    status,
    setStatus,
    addresses,
    selectedAddress,
    setSelectedAddressId,
    paymentMethod,
    setPaymentMethod,
    submit,
    items,
    pricing,
    errorMsg,
    placedOrderId,
  } = usePremiumCheckout();

  const setShippingFee = useCartStore(s => s.setShippingFee);

  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const [locationDetailsModal, setLocationDetailsModal] = useState<boolean>(false);

  // 1. Core Automation: Address -> Zone -> Branch -> Delivery Quote
  const quote = useDeliveryQuote({
    subtotal: pricing.subtotal,
    customerCoords: selectedAddress?.lat && selectedAddress?.lng ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : null,
    address: selectedAddress ? { city: selectedAddress.city, streetName: selectedAddress.street } : undefined,
  });

  // 2. Sync quote delivery fee with checkout totals automatically
  useEffect(() => {
    if (quote.cost !== undefined) {
      setShippingFee(quote.cost);
    }
  }, [quote.cost, setShippingFee]);

  // Transitions
  useEffect(() => {
    if (status === "READY" && selectedAddress && quote.isDeliverable && activeStep === 1) {
       setActiveStep(2);
    }
  }, [selectedAddress, quote.isDeliverable, status]);

  // Error Overlays
  if (status === "AUTH_REQUIRED") {
    return (
       <View style={[styles.container, { backgroundColor: c.canvas }]}>
          <AuthGateModal visible={true} onSuccess={() => setStatus("LOADING")} onCancel={() => router.back()} />
       </View>
    );
  }

  if (status === "SUCCESS") {
    return (
       <View style={[styles.container, { backgroundColor: c.canvas, paddingTop: insets.top }]}>
          <Animated.View entering={FadeIn.delay(300)} style={styles.successContent}>
             <View style={[styles.successIconCircle, { backgroundColor: kit.color.successTint }]}>
                <Ionicons name="checkmark-circle" size={80} color={kit.color.success} />
             </View>
             <CustomerUI.Typography variant="h2" weight="black" color={c.ink} style={{ marginTop: 24, textAlign: "center" }}>
                {t("checkout.orderPlaced", "Order Confirmed")}
             </CustomerUI.Typography>
             <CustomerUI.Typography variant="body" color={c.inkSoft} style={{ marginTop: 8, textAlign: "center", paddingHorizontal: 20 }}>
                {t("checkout.orderPlacedDesc", "Your order has been received and is being prepared by our pharmacists.")}
             </CustomerUI.Typography>
             
             <View style={[styles.successDetailsCard, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <CustomerUI.Typography variant="body" color={c.inkSoft}>{t("checkout.orderNumber", "Order #")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="body" weight="bold" color={c.ink}>{placedOrderId}</CustomerUI.Typography>
                </View>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <CustomerUI.Typography variant="body" color={c.inkSoft}>{t("checkout.totalPaid", "Total Amount")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="body" weight="bold" color={kit.color.accentDeep}>{pricing.total.toLocaleString("ar-EG")} EGP</CustomerUI.Typography>
                </View>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL), borderBottomWidth: 0 }]}>
                   <CustomerUI.Typography variant="body" color={c.inkSoft}>{t("checkout.deliveryTo", "Delivery To")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="body" weight="bold" color={c.ink} style={{ maxWidth: "60%", textAlign: textAlignStart(IS_RTL) }}>
                      {selectedAddress?.street}
                   </CustomerUI.Typography>
                </View>
             </View>

             <View style={{ width: "100%", gap: 12, marginTop: 40 }}>
                <Button 
                   label={t("checkout.trackOrder", "Track Order")} 
                   onPress={() => {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                     router.replace(`/(customer)/(tabs)/orders`);
                   }}
                />
                <Button 
                   label={t("checkout.continueShopping", "Continue Shopping")} 
                   variant="secondary" 
                   onPress={() => router.replace(`/(customer)/(tabs)/products`)}
                />
             </View>
          </Animated.View>
       </View>
    );
  }

  const isBlocked = status === "LOADING" || status === "SUBMITTING";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: c.canvas, paddingTop: insets.top }]}>
        
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
           <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
              <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={28} color={c.ink} />
           </Pressable>
           <CustomerUI.Typography variant="h3" weight="black" color={c.ink}>
              {t("checkout.title", "Checkout")}
           </CustomerUI.Typography>
           <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
           
           {/* Step 1: Delivery Address & Smart Automation */}
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
                 <Ionicons name="map-outline" size={48} color={c.inkFaint} />
                 <CustomerUI.Typography variant="body" color={c.inkSoft} style={{ marginVertical: 12 }}>
                    {t("checkout.noAddresses", "You have no saved addresses.")}
                 </CustomerUI.Typography>
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
                      style={[styles.addressCard, { borderColor: selectedAddress?.id === addr.id ? kit.color.accentDeep : c.line, backgroundColor: selectedAddress?.id === addr.id ? kit.color.accentTint : c.surface }]}
                   >
                      <View style={[styles.addressCardRow, { flexDirection: flexRow(IS_RTL) }]}>
                        <View style={[styles.radioOuter, { borderColor: selectedAddress?.id === addr.id ? kit.color.accentDeep : c.inkFaint }]}>
                           {selectedAddress?.id === addr.id && <View style={[styles.radioInner, { backgroundColor: kit.color.accentDeep }]} />}
                        </View>
                        <View style={{ flex: 1, paddingHorizontal: 12 }}>
                           <CustomerUI.Typography variant="body" weight="bold" color={c.ink} style={{ textAlign: textAlignStart(IS_RTL) }}>
                              {addr.label || t("address.labelHome", "Home")}
                           </CustomerUI.Typography>
                           <CustomerUI.Typography variant="caption" color={c.inkSoft} style={{ textAlign: textAlignStart(IS_RTL), marginTop: 4 }}>
                              {addr.street}, {addr.building && `Bldg ${addr.building}`}, {addr.city}
                           </CustomerUI.Typography>
                        </View>
                      </View>
                   </Pressable>
                 ))}
                 
                 <Pressable onPress={() => setIsAddressDrawerOpen(true)} style={[styles.addBtn, { flexDirection: flexRow(IS_RTL) }]}>
                    <Ionicons name="add" size={20} color={kit.color.accentDeep} />
                    <CustomerUI.Typography variant="body" weight="bold" color={kit.color.accentDeep} style={{ paddingHorizontal: 8 }}>
                       {t("checkout.addAddress", "Add another address")}
                    </CustomerUI.Typography>
                 </Pressable>

                 {/* SMART ZONE DETECTION UI */}
                 {selectedAddress && quote.isDeliverable && quote.branch && (
                   <Animated.View entering={FadeIn.delay(200)} style={[styles.smartZoneCard, { backgroundColor: c.canvas, borderColor: kit.color.success }]}>
                      <View style={[styles.smartZoneHeader, { flexDirection: flexRow(IS_RTL) }]}>
                         <Ionicons name="checkmark-circle" size={16} color={kit.color.success} />
                         <CustomerUI.Typography variant="caption" weight="bold" color={kit.color.success} style={{ paddingHorizontal: 6, letterSpacing: 0.5 }}>
                            {t("checkout.inZone", "IN DELIVERY ZONE")}
                         </CustomerUI.Typography>
                      </View>
                      <View style={[styles.smartZoneBody, { flexDirection: flexRow(IS_RTL) }]}>
                         <View style={{ flex: 1 }}>
                            <CustomerUI.Typography variant="body" color={c.inkSoft} style={{ textAlign: textAlignStart(IS_RTL) }}>
                               {t("checkout.assignedBranch", "Processing from:")} <CustomerUI.Typography variant="body" weight="bold" color={c.ink}>{i18n.language === "en" ? quote.branch.nameEn : quote.branch.nameAr}</CustomerUI.Typography>
                            </CustomerUI.Typography>
                         </View>
                         <Pressable onPress={() => setLocationDetailsModal(true)}>
                            <CustomerUI.Typography variant="caption" weight="bold" color={kit.color.accentDeep}>{t("checkout.viewDetails", "Location Details")}</CustomerUI.Typography>
                         </Pressable>
                      </View>
                   </Animated.View>
                 )}

                 {selectedAddress && !quote.isDeliverable && (
                    <Animated.View entering={FadeIn} style={[styles.warningBox, { backgroundColor: kit.color.dangerTint, borderColor: kit.color.danger, flexDirection: flexRow(IS_RTL) }]}>
                       <Ionicons name="alert-circle" size={20} color={kit.color.danger} />
                       <View style={{ paddingHorizontal: 8, flex: 1 }}>
                         <CustomerUI.Typography variant="body" weight="bold" color={kit.color.danger} style={{ textAlign: textAlignStart(IS_RTL) }}>
                            {t("checkout.deliveryUnavailable", "Delivery Unavailable")}
                         </CustomerUI.Typography>
                         {quote.outOfServiceMessage && (
                           <CustomerUI.Typography variant="caption" color={kit.color.danger} style={{ textAlign: textAlignStart(IS_RTL), marginTop: 2 }}>
                              {quote.outOfServiceMessage}
                           </CustomerUI.Typography>
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

           {/* Step 2: Delivery Method */}
           <StepAccordion 
             step={2} 
             title={t("checkout.deliveryMethod", "Delivery Method")}
             isActive={activeStep === 2}
             isCompleted={activeStep > 2}
             onEdit={() => setActiveStep(2)}
             summary={t("checkout.standardDelivery", "Standard Delivery")}
           >
             <View style={[styles.methodCard, { borderColor: kit.color.accentDeep, backgroundColor: kit.color.accentTint, flexDirection: flexRow(IS_RTL) }]}>
                <Ionicons name="bicycle" size={28} color={kit.color.accentDeep} />
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                   <CustomerUI.Typography variant="body" weight="bold" color={kit.color.accentDeep} style={{ textAlign: textAlignStart(IS_RTL) }}>{t("checkout.standardDelivery", "Standard Delivery")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="caption" color={kit.color.accentDeep} style={{ textAlign: textAlignStart(IS_RTL) }}>
                      {quote.eta ? t("checkout.etaFormat", { min: quote.eta.min, max: quote.eta.max, defaultValue: `${quote.eta.min}-${quote.eta.max} minutes` }) : t("checkout.deliveryTime", "Within 60 minutes")}
                   </CustomerUI.Typography>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                   <CustomerUI.Typography variant="body" weight="bold" color={kit.color.accentDeep}>
                      {quote.cost === 0 ? t("checkout.free", "Free") : `+${quote.cost} EGP`}
                   </CustomerUI.Typography>
                   <Ionicons name="checkmark-circle" size={24} color={kit.color.accentDeep} style={{ marginTop: 4 }} />
                </View>
             </View>
             <Button label={t("common.continue", "Continue")} onPress={() => setActiveStep(3)} style={{ marginTop: 16 }} />
           </StepAccordion>

           {/* Step 3: Payment Method */}
           <StepAccordion 
             step={3} 
             title={t("checkout.payment", "Payment Method")}
             isActive={activeStep === 3}
             isCompleted={activeStep > 3}
             onEdit={() => setActiveStep(3)}
             summary={paymentMethod === "cod" ? t("checkout.cod", "Cash on Delivery") : t("checkout.card", "Credit / Debit Card")}
           >
             <Pressable onPress={() => { Haptics.selectionAsync(); setPaymentMethod("cod"); }} style={[styles.methodCard, { borderColor: paymentMethod === "cod" ? kit.color.accentDeep : c.line, backgroundColor: paymentMethod === "cod" ? kit.color.accentTint : c.surface, flexDirection: flexRow(IS_RTL) }]}>
                <Ionicons name="cash-outline" size={28} color={paymentMethod === "cod" ? kit.color.accentDeep : c.inkSoft} />
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                   <CustomerUI.Typography variant="body" weight="bold" color={paymentMethod === "cod" ? kit.color.accentDeep : c.ink} style={{ textAlign: textAlignStart(IS_RTL) }}>{t("checkout.cod", "Cash on Delivery")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="caption" color={paymentMethod === "cod" ? kit.color.accentDeep : c.inkSoft} style={{ textAlign: textAlignStart(IS_RTL) }}>{t("checkout.payAtDoor", "Pay when you receive your order")}</CustomerUI.Typography>
                </View>
                {paymentMethod === "cod" && <Ionicons name="checkmark-circle" size={24} color={kit.color.accentDeep} />}
             </Pressable>
             
             <Pressable onPress={() => { Haptics.selectionAsync(); setPaymentMethod("card"); }} style={[styles.methodCard, { borderColor: paymentMethod === "card" ? kit.color.accentDeep : c.line, backgroundColor: paymentMethod === "card" ? kit.color.accentTint : c.surface, flexDirection: flexRow(IS_RTL) }]}>
                <Ionicons name="card-outline" size={28} color={paymentMethod === "card" ? kit.color.accentDeep : c.inkSoft} />
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                   <CustomerUI.Typography variant="body" weight="bold" color={paymentMethod === "card" ? kit.color.accentDeep : c.ink} style={{ textAlign: textAlignStart(IS_RTL) }}>{t("checkout.card", "Credit / Debit Card")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="caption" color={paymentMethod === "card" ? kit.color.accentDeep : c.inkSoft} style={{ textAlign: textAlignStart(IS_RTL) }}>{t("checkout.paySecurely", "Pay securely via Stripe")}</CustomerUI.Typography>
                </View>
                {paymentMethod === "card" && <Ionicons name="checkmark-circle" size={24} color={kit.color.accentDeep} />}
             </Pressable>

             <Button label={t("checkout.reviewOrder", "Review Order")} onPress={() => setActiveStep(4)} style={{ marginTop: 16 }} />
           </StepAccordion>

           {/* Step 4: Review & Place Order */}
           <StepAccordion 
             step={4} 
             title={t("checkout.review", "Review & Confirm")}
             isActive={activeStep === 4}
             isCompleted={false}
             onEdit={() => {}}
           >
             <View style={[styles.summaryCard, { backgroundColor: c.canvas, borderColor: c.line }]}>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <CustomerUI.Typography variant="body" color={c.inkSoft}>{t("checkout.subtotal", "Subtotal")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="body" weight="bold" color={c.ink}>{pricing.subtotal.toLocaleString("ar-EG")} EGP</CustomerUI.Typography>
                </View>
                <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                   <CustomerUI.Typography variant="body" color={c.inkSoft}>{t("checkout.deliveryFee", "Delivery Fee")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="body" weight="bold" color={pricing.delivery === 0 ? kit.color.success : c.ink}>{pricing.delivery === 0 ? t("checkout.free", "Free") : `${pricing.delivery.toLocaleString("ar-EG")} EGP`}</CustomerUI.Typography>
                </View>
                {pricing.discount > 0 && (
                  <View style={[styles.summaryRow, { flexDirection: flexRow(IS_RTL) }]}>
                     <CustomerUI.Typography variant="body" color={kit.color.success}>{t("checkout.discount", "Discount")}</CustomerUI.Typography>
                     <CustomerUI.Typography variant="body" weight="bold" color={kit.color.success}>-{pricing.discount.toLocaleString("ar-EG")} EGP</CustomerUI.Typography>
                  </View>
                )}
                <View style={[styles.summaryRow, styles.summaryTotal, { borderTopColor: c.line, flexDirection: flexRow(IS_RTL) }]}>
                   <CustomerUI.Typography variant="h4" weight="bold" color={c.ink}>{t("checkout.total", "Final Total")}</CustomerUI.Typography>
                   <CustomerUI.Typography variant="h3" weight="black" color={kit.color.accentDeep}>{pricing.total.toLocaleString("ar-EG")} EGP</CustomerUI.Typography>
                </View>
             </View>
           </StepAccordion>

        </ScrollView>

        {/* Sticky Action Footer */}
        {activeStep === 4 && (
          <Animated.View entering={SlideInDown.duration(300)} style={[styles.footerDock, { backgroundColor: c.surface, borderTopColor: c.line }]}>
             {errorMsg && (
                <View style={[styles.errorDock, { backgroundColor: kit.color.dangerTint }]}>
                   <Ionicons name="warning" size={16} color={kit.color.danger} />
                   <CustomerUI.Typography variant="caption" weight="bold" color={kit.color.danger} style={{ marginLeft: 6 }}>{errorMsg}</CustomerUI.Typography>
                </View>
             )}
             <Button 
                label={t("checkout.placeOrder", "Place Order")}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  submit();
                }}
                loading={isBlocked}
                disabled={!quote.isDeliverable}
                size="lg"
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
      
      {/* Drawer */}
      <AddressFormDrawer visible={isAddressDrawerOpen} onClose={() => setIsAddressDrawerOpen(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  
  accordionCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden", ...kit.shadow.raised },
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
  
  summaryCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  summaryRow: { justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  summaryTotal: { borderTopWidth: 1, marginTop: 8, paddingTop: 16 },
  
  footerDock: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, ...kit.shadow.floating },
  errorDock: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 8, marginBottom: 12 },
  
  successContent: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  successIconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  successDetailsCard: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 20, marginTop: 32 },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: 300, ...kit.shadow.floating },
  modalHandle: { width: 40, height: 4, backgroundColor: kit.color.lineStrong, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 12 },
  modalHeader: { paddingHorizontal: 20, paddingBottom: 16, alignItems: "center", justifyContent: "space-between" },
  branchMetaBox: { backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 12, padding: 16 },
  branchMetaRow: { alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.1)" },
});
