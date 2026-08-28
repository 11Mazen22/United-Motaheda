import React, { memo, useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { CustomerUI, useTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useUnreadCount } from "@/features/notifications";
import { useAuth } from "@/features/auth";
import { usePremiumCheckout } from "@/features/checkout/hooks/usePremiumCheckout";
import { useDeliveryQuote } from "@/features/delivery/useDeliveryQuote";
import { AddressFormDrawer } from "@/features/addresses/components/AddressFormDrawer";
import { useAddressStore, type AddressFormData } from "@/features/addresses/store";
import { ADDRESS_LABELS } from "@/features/addresses/types";
import { showErrorSheet } from "@/shared/store/appSheetStore";

const IS_RTL = isRtl();

export const DeliveryHeader = memo(function DeliveryHeader() {
  const { t } = useTranslation();
  const { isTablet, pagePad } = useScreenLayout();
  const { theme } = useTheme();
  const router = useRouter();

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
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const addAddress = useAddressStore(s => s.add);

  const openAddressDrawer = useCallback(() => {
    if (!authUser?.id) {
      // Was a silent no-op before — a guest could fill out the whole form,
      // tap Save, and nothing would happen with zero feedback ("save button
      // doesn't work"). Redirect to sign-in instead of even opening the
      // drawer, same redirect-back pattern already used by checkout/login.
      router.push({ pathname: "/(auth)/login", params: { redirect: "/(customer)/(tabs)" } });
      return;
    }
    setIsAddressDrawerOpen(true);
  }, [authUser?.id, router]);

  const handleAddressSubmit = useCallback(async (form: AddressFormData) => {
    if (!authUser?.id) return;
    setIsSavingAddress(true);
    try {
      await addAddress(authUser.id, form);
      setIsAddressDrawerOpen(false);
    } catch (e) {
      showErrorSheet(
        t("addresses.saveError"),
        e instanceof Error ? e.message : t("addresses.saveErrorDesc"),
      );
    } finally {
      setIsSavingAddress(false);
    }
  }, [authUser?.id, addAddress, t]);

  // selectedAddress.label is the raw internal key ("home"/"work"/"family"/
  // "other"), not a display string -- rendering it directly showed the
  // literal English word "home" regardless of app language. Same
  // key-to-translated-label lookup AddressCard already uses for the same field.
  const addressLabelConfig = selectedAddress
    ? ADDRESS_LABELS.find((l) => l.key === selectedAddress.label)
    : undefined;

  const pinTone = quote.isDeliverable ? theme.colors.status.success : theme.colors.status.error;
  const pinTint = quote.isDeliverable ? `${theme.colors.status.success}1A` : `${theme.colors.status.error}1A`;

  return (
    <>
      <View
        style={[
          s.header,
          {
            paddingTop: isTablet ? 14 : 10,
            paddingHorizontal: pagePad,
            backgroundColor: theme.colors.canvas.surface,
            borderBottomColor: theme.colors.border.default,
            flexDirection: flexRow(IS_RTL),
          },
        ]}
      >
        <Pressable
          style={[s.locationBox, { flexDirection: flexRow(IS_RTL) }]}
          onPress={openAddressDrawer}
          accessibilityRole="button"
          accessibilityLabel={t("home.deliverTo", "Delivering to")}
        >
           <View style={[s.iconCircle, { backgroundColor: pinTint }]}>
              <Ionicons name={quote.isDeliverable ? "location" : "location-outline"} size={18} color={pinTone} />
           </View>

           <View style={s.textBlock}>
             <CustomerUI.Typography variant="caption" weight="bold" color={theme.colors.text.secondary} style={{ textAlign: textAlignStart(IS_RTL) }}>
               {t("home.deliverTo", "Delivering to")}
             </CustomerUI.Typography>

             <View style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>
                <CustomerUI.Typography variant="body" weight="black" color={theme.colors.text.primary} style={{ textAlign: textAlignStart(IS_RTL) }} numberOfLines={1}>
                  {selectedAddress ? (addressLabelConfig ? t(addressLabelConfig.labelKey) : selectedAddress.street) : t("home.selectLocation", "Select your location")}
                </CustomerUI.Typography>
                <Ionicons name="chevron-down" size={16} color={theme.colors.text.primary} style={{ marginStart: 4 }} />
             </View>
           </View>
        </Pressable>

        <View style={[s.actions, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
              router.push("/(customer)/(account)/notifications");
            }}
            accessibilityRole="button"
            accessibilityLabel={t("notifications.title", "Notifications")}
            style={[s.actionBtn, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}
          >
            <Ionicons name="notifications-outline" size={22} color={theme.colors.text.primary} />
            {notifBadge > 0 && (
              <View style={[s.notifBadge, { backgroundColor: theme.colors.status.error, borderColor: theme.colors.canvas.surface }]}>
                <CustomerUI.Typography variant="caption" weight="black" color="#FFF" style={{ fontSize: 9 }}>
                  {notifBadge > 9 ? "9+" : notifBadge}
                </CustomerUI.Typography>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      <AddressFormDrawer visible={isAddressDrawerOpen} onClose={() => setIsAddressDrawerOpen(false)} onSubmit={handleAddressSubmit} loading={isSavingAddress} />
    </>
  );
});

const s = StyleSheet.create({
  header: {
    paddingBottom: 12,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationBox: {
    alignItems: "center",
    flex: 1,
    marginEnd: 16,
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
    end: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
  },
});
