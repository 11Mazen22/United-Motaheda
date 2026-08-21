import React, { memo, useCallback, useMemo, useState } from "react";

import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { GestureDetector } from "react-native-gesture-handler";

import { Ionicons } from "@expo/vector-icons";

import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";

import { useAuth } from "@/features/auth";

import { useCartStore } from "@/stores/cart";

import { useWishlistStore } from "@/stores/wishlist";

import { useOrderStore } from "@/stores/orders";

import { Text as UIText } from "@pharmacy/ui-native";

import { kit } from "@pharmacy/ui-native";

import { useDarkColors } from "@/hooks/useDarkColors";

import { useTranslation } from "react-i18next";

import { useAppLanguage } from "@/i18n/LanguageProvider";

import { ProfileAuthHero } from "@/features/profile/components/ProfileAuthHero";

import { ProfileGuestHero } from "@/features/profile/components/ProfileGuestHero";

import { ThemePickerSheet } from "@/features/profile/components/ThemePickerSheet";

import { useThemeStore } from "@/stores/themeStore";

import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";

import { useTabSwipeGesture } from "@/shared/navigation/useTabSwipeGesture";

import { theme } from "@pharmacy/design-tokens";



const RTL = isRtl(), TA = textAlignStart(RTL);

const SP = { damping: 22, stiffness: 420 } as const;



const waUrl = (lang: string) => {

  const msg = lang === "en"

    ? "Hello, I need help with a specific medicine or order."

    : "مرحباً، أحتاج مساعدة بخصوص دواء أو طلب معين.";

  return `https://wa.me/201112343212?text=${encodeURIComponent(msg)}`;

};



const SectionLabel = memo(function SectionLabel({ icon, label, accent }: {

  icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; accent?: string;

}) {

  const { c } = useDarkColors();

  const ac = accent ?? c.accentDeep;

  return (

    <View style={[styles.slRow, { flexDirection: flexRow(RTL) }]}>

      <View style={[styles.slBadge, { backgroundColor: `${ac}14`, borderColor: `${ac}28` }]}>

        <Ionicons name={icon} size={15} color={ac} />

      </View>

      <UIText style={[styles.slLbl, { color: ac, textAlign: TA }]}>{label}</UIText>

    </View>

  );

});



const MenuRow = memo(function MenuRow({ icon, label, subtitle, onPress, badge, color, danger, last }: {

  icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; subtitle?: string; onPress: () => void; badge?: number | string; color?: string; danger?: boolean; last?: boolean;

}) {

  const { c } = useDarkColors();

  const ic = danger ? c.danger : (color ?? c.accentDeep);

  const scale = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (

    <Pressable onPress={() => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); onPress(); }}

      onPressIn={() => scale.value = withSpring(0.985, SP)}

      onPressOut={() => scale.value = withSpring(1, SP)}

      accessibilityRole="button" accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}>

      <Animated.View style={[styles.mrRow, !last && styles.mrSep, anim]}>

        <View style={[styles.mrTile, { backgroundColor: danger ? c.dangerTint : `${ic}14`, borderColor: danger ? "rgba(179,38,30,0.28)" : `${ic}26` }]}>

          <Ionicons name={icon} size={20} color={ic} />

        </View>

        <View style={styles.mrGrp}>

          <UIText weight="bold" style={[styles.mrLbl, danger && { color: c.danger }]} numberOfLines={1}>{label}</UIText>

          {subtitle && <UIText weight="semibold" style={styles.mrSub} numberOfLines={1}>{subtitle}</UIText>}

        </View>

        <View style={styles.mrEnd}>

          {badge != null && <View style={[styles.mrPill, danger && styles.mrPillD]}> 

            <UIText weight="black" style={[styles.mrPillT, { color: danger ? c.danger : c.accentDeep }]}>{badge}</UIText>

          </View>}

          <View style={styles.mrChv}><Ionicons name={FORWARD_CHEVRON} size={14} color={c.inkFaint} /></View>

        </View>

      </Animated.View>

    </Pressable>

  );

});



export default function ProfileScreen() {

  const { c } = useDarkColors();

  const { gesture, animatedStyle } = useTabSwipeGesture("profile");

  const router = useRouter(), insets = useSafeAreaInsets(), { t } = useTranslation();

  const { language, setLanguage } = useAppLanguage();

  const { user, signOut } = useAuth();

  const [showThemePicker, setShowThemePicker] = useState(false);

  const themeMode = useThemeStore(s => s.mode);

  const cartCount = useCartStore(s => s.itemCount());

  const wishlistCount = useWishlistStore(s => s.items.length);

  const orders = useOrderStore(s => s.orders);

  const [signingOut, setSigningOut] = useState(false);

  const orderCount = useMemo(() => orders.length, [orders]);



  const go = useCallback((p: string) => () => router.push(p), [router]);

  const callWhatsApp = useCallback(() => Linking.openURL(waUrl(language)).catch(() => {}), [language]);

  const callPhone = useCallback(() => Linking.openURL("tel:01112343212").catch(() => {}), []);

  const toggleLanguage = useCallback(() => {

    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});

    void setLanguage(language === "ar" ? "en" : "ar");

  }, [language, setLanguage]);



  const handleSignOut = useCallback(async () => {

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

    setSigningOut(true);

    try { await signOut(); } finally { setSigningOut(false); }

  }, [signOut]);



  return (

    <GestureDetector gesture={gesture}>

    <Animated.View style={[styles.screen, animatedStyle]}>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: theme.layout.tabBarHeight + 32 }]} showsVerticalScrollIndicator={false}>

        {user

          ? <ProfileAuthHero user={user} orderCount={orderCount} wishlistCount={wishlistCount} cartCount={cartCount} lastOrder={orders[0] ?? null} insetsTop={insets.top} />

          : <ProfileGuestHero insetsTop={insets.top} />}



        <View style={styles.sec}>

          <SectionLabel icon="person-outline" label={t("profile.sectionAccount")} />

          <View style={styles.card}>

            {user && <MenuRow icon="create-outline" color={c.accent} label={t("profile.menuEditProfile")} subtitle={t("profile.menuEditProfileSubtitle")} onPress={go("/edit-profile")} />}

            <MenuRow icon="lock-closed-outline" color={c.inkSoft} label={t("profile.menuSecurity")} subtitle={t("profile.menuSecuritySubtitle")} onPress={go("/change-password")} />

            <MenuRow icon="language-outline" color="#2563EB" label={t("language.label")} subtitle={language === "ar" ? t("language.en") : t("language.ar")} onPress={toggleLanguage} />

            <MenuRow icon="notifications-outline" color={c.warn} label={t("profile.notifications")} subtitle={t("profile.notificationsSubtitle")} onPress={go("/(customer)/(account)/notifications")} last />

          </View>

        </View>



        <View style={styles.sec}>

          <SectionLabel icon="cube-outline" label={t("profile.sectionDelivery")} accent={c.success} />

          <View style={styles.card}>

            <MenuRow icon="location-outline" color={c.success} label={t("profile.menuAddresses")} subtitle={t("profile.menuAddressesSubtitle")} onPress={go("/(customer)/(account)/addresses")} />

            <MenuRow icon="card-outline" color="#7C3AED" label={t("profile.menuPayment")} subtitle={t("profile.menuPaymentSubtitle")} onPress={go("/(customer)/(account)/payment")} last />

          </View>

        </View>



        <View style={styles.sec}>

          <SectionLabel icon="bag-handle-outline" label={t("profile.sectionOrders")} />

          <View style={styles.card}>

            <MenuRow icon="receipt-outline" color={c.accentDeep} label={t("profile.orderHistory")} onPress={() => router.push("/(customer)/(account)/orders")} last />

          </View>

        </View>



        <View style={styles.sec}>

          <SectionLabel icon="settings-outline" label={t("profile.sectionPreferences")} accent={c.inkSoft} />

          <View style={styles.card}>

            <MenuRow icon="moon-outline" color="#6366F1" label={t("profile.theme")} subtitle={themeMode === "dark" ? t("profile.themeDark") : themeMode === "light" ? t("profile.themeLight") : t("profile.themeSystem")} onPress={() => setShowThemePicker(true)} last />

          </View>

        </View>



        <View style={styles.sec}>

          <SectionLabel icon="headset-outline" label={t("profile.sectionSupport")} accent="#16A34A" />

          <View style={styles.card}>

            <MenuRow icon="logo-whatsapp" color="#16A34A" label={t("profile.whatsapp")} subtitle={t("profile.whatsappSubtitle")} onPress={callWhatsApp} />

            <MenuRow icon="call-outline" color={c.accent} label={t("profile.callUs")} subtitle="01112343212" onPress={callPhone} />

            <MenuRow icon="help-circle-outline" color="#6366F1" label={t("profile.faq")} onPress={go("/(customer)/(info)/faq")} last />

          </View>

        </View>



        <View style={styles.sec}>

          <SectionLabel icon="document-text-outline" label={t("profile.sectionLegal")} />

          <View style={styles.card}>

            <MenuRow icon="business-outline" color={c.accent} label={t("profile.aboutPharmacy")} onPress={go("/(customer)/(info)/about")} />

            <MenuRow icon="shield-checkmark-outline" color={c.success} label={t("profile.privacy")} onPress={go("/(customer)/(info)/privacy")} />

            <MenuRow icon="document-text-outline" color={c.inkSoft} label={t("profile.terms")} onPress={go("/(customer)/(info)/terms")} last />

          </View>

        </View>



        {user && (

          <View style={styles.dWrap}>

            <Pressable onPress={handleSignOut} disabled={signingOut} accessibilityRole="button" accessibilityLabel={t("profile.logout")} style={styles.dCard}>

              {({ pressed }) => (

                <View style={[styles.dInner, pressed && styles.dPress]}>

                  <View style={styles.dLead}>

                    <View style={styles.dIcon}><Ionicons name="log-out-outline" size={20} color={c.danger} /></View>

                    <View style={{ flex: 1, gap: 2 }}>

                      <UIText style={styles.dLbl} numberOfLines={1}>{signingOut ? t("common.loading") : t("profile.logout")}</UIText>

                      <UIText style={styles.dSub} numberOfLines={1}>{t("profile.logoutSubtitle")}</UIText>

                    </View>

                  </View>

                  <Ionicons name={FORWARD_CHEVRON} size={16} color="rgba(179,38,30,0.55)" />

                </View>

              )}

            </Pressable>

          </View>

        )}



        <View style={styles.foot}>

          <View style={[styles.fPill, { flexDirection: flexRow(RTL) }]}> 

            <Ionicons name="medkit" size={12} color={c.accentDeep} />

            <UIText style={styles.fBrand}>{t("profile.footerName")}</UIText>

          </View>

          <UIText style={styles.fName}>United Pharmacies</UIText>

          <UIText style={styles.fVer}>{t("profile.version", { ver: "1.0.0" })}</UIText>

        </View>

      </ScrollView>

      <ThemePickerSheet visible={showThemePicker} onClose={() => setShowThemePicker(false)} />

    </Animated.View>

    </GestureDetector>

  );

}



const styles = StyleSheet.create({

  slRow: { alignItems: "center", gap: 10, paddingHorizontal: theme.layout.pagePaddingH, marginBottom: 12 },

  slBadge: { width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1 },

  slLbl: { fontFamily: theme.fonts.black, fontSize: 13, lineHeight: 18, letterSpacing: 0.3, includeFontPadding: false },



  mrRow: { flexDirection: flexRow(RTL), alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, backgroundColor: kit.color.surface, gap: 14, minHeight: 56 },

  mrSep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line },

  mrTile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, flexShrink: 0 },

  mrGrp: { flex: 1, gap: 2, justifyContent: "center", flexShrink: 1 },

  mrLbl: { fontSize: 14, lineHeight: 20, color: kit.color.ink, letterSpacing: -0.1, textAlign: TA, includeFontPadding: false },

  mrSub: { fontSize: 11, lineHeight: 16, color: kit.color.inkFaint, textAlign: TA, letterSpacing: 0.1, includeFontPadding: false },

  mrEnd: { flexDirection: flexRow(RTL), alignItems: "center", gap: 8, flexShrink: 0 },

  mrChv: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },

  mrPill: { minWidth: 26, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: "rgba(14,126,116,0.18)" },

  mrPillD: { backgroundColor: kit.color.dangerTint, borderColor: "rgba(179,38,30,0.3)" },

  mrPillT: { fontSize: 10, lineHeight: 14, letterSpacing: 0.2, includeFontPadding: false },



  screen: { flex: 1, backgroundColor: kit.color.canvas },

  scroll: {},

  sec: { marginTop: kit.sp(7) },

  card: { marginHorizontal: theme.layout.pagePaddingH, backgroundColor: kit.color.surface, borderRadius: kit.radius.lg, overflow: "hidden", borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised },

  dWrap: { paddingHorizontal: theme.layout.pagePaddingH, marginTop: kit.sp(5) },

  dCard: { borderRadius: kit.radius.lg, overflow: "hidden" },

  dInner: { flexDirection: flexRow(RTL), alignItems: "center", justifyContent: "space-between", gap: 12, backgroundColor: kit.color.dangerTint, borderRadius: kit.radius.lg, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: "rgba(179,38,30,0.32)", ...kit.shadow.raised },

  dPress: { opacity: 0.88, transform: [{ scale: 0.99 }] },

  dLead: { flex: 1, flexDirection: flexRow(RTL), alignItems: "center", gap: 14, flexShrink: 1 },

  dIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(179,38,30,0.13)", borderWidth: 1, borderColor: "rgba(179,38,30,0.28)", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  dLbl: { fontFamily: theme.fonts.extrabold, fontSize: 14, lineHeight: 20, letterSpacing: -0.1, color: kit.color.danger, textAlign: TA, includeFontPadding: false },

  dSub: { fontFamily: theme.fonts.regular, fontSize: 11.5, lineHeight: 16, color: "rgba(179,38,30,0.65)", textAlign: TA, includeFontPadding: false },

  foot: { alignItems: "center", marginTop: kit.sp(5), paddingBottom: kit.sp(4), gap: 6 },

  fPill: { alignItems: "center", gap: 6, backgroundColor: kit.color.accentTint, borderRadius: kit.radius.pill, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: kit.color.line },

  fBrand: { fontFamily: theme.fonts.bold, fontSize: 12, lineHeight: 17, color: kit.color.accentDeep, includeFontPadding: false },

  fName: { fontFamily: theme.fonts.regular, fontSize: 11, lineHeight: 16, color: kit.color.inkFaint, includeFontPadding: false },

  fVer: { fontFamily: theme.fonts.regular, fontSize: 10, lineHeight: 14, color: kit.color.inkFaint, includeFontPadding: false, marginTop: kit.sp(1) },

});
