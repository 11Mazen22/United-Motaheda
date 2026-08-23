import React, { memo, useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { CustomerUI } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { kit } from "@pharmacy/ui-native";
import { useScreenLayout } from "@/utils/responsive";
import { useUnreadCount } from "@/features/notifications";
import { useAuth } from "@/features/auth";
import { usePremiumCheckout } from "@/features/checkout/hooks/usePremiumCheckout";
import { useDeliveryQuote } from "@/features/delivery/useDeliveryQuote";
import { AddressFormDrawer } from "@/features/addresses/components/AddressFormDrawer";
import { useAddressStore, type AddressFormData } from "@/features/addresses/store";

const IS_RTL = isRtl();

export const DeliveryHeader = memo(function DeliveryHeader() {
  const { t } = useTranslation();
  const { isTablet, pagePad } = useScreenLayout();
  const theme = CustomerUI.useLuxuryTheme();
  
  const { user: authUser } = useAuth();
  const unreadCount = useUnreadCount(authUser?.id);
  const notifBadge = typeof unreadCount === "number" ? unreadCount : 0;

  // Sync with exactly what Checkout computes!
  const { selectedAddress, pricing } = usePremiumCheckout();
  const quote = useDeliveryQuote({
    subtotal: pricing.subtotal,
    customerCoords: selectedAddress?.lat && selectedAddress?.lng ? { lat: selectedAddress.lat, lng: selectedAddress.lng } : null,
    address: selectedAddress ? { city: selectedAddress.city, streetName: selectedAddress.street } : undefined,
  });

  const [isAddressDrawerOpen, setIsAddressDrawerOpen] = useState(false);
  const addAddress = useAddressStore(s => s.add);

  const handleAddressSubmit = useCallback(async (form: AddressFormData) => {
    if (!authUser?.id) return;
    await addAddress(authUser.id, form);
    setIsAddressDrawerOpen(false);
  }, [authUser?.id, addAddress]);

  return (
    <>
      <View
        style={[
          s.header,
          {
            paddingTop: isTablet ? 14 : 10,
            paddingHorizontal: pagePad,
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.line,
          },
        ]}
      >
        <Pressable 
          style={[s.locationBox, { flexDirection: flexRow(IS_RTL) }]}
          onPress={() => setIsAddressDrawerOpen(true)}
        >
           <View style={[s.iconCircle, { backgroundColor: quote.isDeliverable ? kit.color.successTint : kit.color.dangerTint }]}>
              <Ionicons name={quote.isDeliverable ? "location" : "location-outline"} size={18} color={quote.isDeliverable ? kit.color.success : kit.color.danger} />
           </View>
           
           <View style={s.textBlock}>
             <CustomerUI.Typography variant="caption" weight="bold" color={theme.colors.inkSoft} style={{ textAlign: textAlignStart(IS_RTL) }}>
               {t("home.deliverTo", "Delivering to")}
             </CustomerUI.Typography>
             
             <View style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>
                <CustomerUI.Typography variant="body" weight="black" color={theme.colors.ink} style={{ textAlign: textAlignStart(IS_RTL) }} numberOfLines={1}>
                  {selectedAddress ? (selectedAddress.label || selectedAddress.street) : t("home.selectLocation", "Select your location")}
                </CustomerUI.Typography>
                <Ionicons name="chevron-down" size={16} color={theme.colors.ink} style={{ marginHorizontal: 4 }} />
             </View>
           </View>
        </Pressable>

        {/* Action buttons */}
        <View style={[s.actions, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
            }}
            style={[s.actionBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.ink} />
            {notifBadge > 0 && (
              <View style={s.notifBadge}>
                <CustomerUI.Typography variant="caption" weight="black" color="#FFF" style={{ fontSize: 9 }}>
                  {notifBadge > 9 ? "9+" : notifBadge}
                </CustomerUI.Typography>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      <AddressFormDrawer visible={isAddressDrawerOpen} onClose={() => setIsAddressDrawerOpen(false)} onSubmit={handleAddressSubmit} />
    </>
  );
});

const s = StyleSheet.create({
  header: {
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationBox: {
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    flex: 1,
    paddingHorizontal: 10,
    justifyContent: "center",
  },
  row: {
    alignItems: "center",
  },
  actions: {
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notifBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: kit.color.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});
