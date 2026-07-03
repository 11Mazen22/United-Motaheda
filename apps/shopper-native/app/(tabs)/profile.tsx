/**
 * ProfileScreen — VIP 2026 redesign on @/shared/kit.
 *
 * LoyaltySummaryCard: LinearGradient removed → flat tier-colour fill + identity stripe.
 * SectionLabel: larger badge (32×32), bolder label.
 * MenuRow: taller rows (56px), larger icon tiles (44×44).
 * Cards: borderRadius raised to kit.radius.lg (16).
 */
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/features/auth";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { useOrderStore } from "@/stores/orders";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { useTranslation } from "react-i18next";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { ProfileAuthHero } from "@/features/profile/components/ProfileAuthHero";
import { ProfileGuestHero } from "@/features/profile/components/ProfileGuestHero";
import { PROFILE } from "@/features/profile/components/profile.styles";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useTabSwipeGesture } from "@/shared/navigation/useTabSwipeGesture";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const SPRING_PRESS = { damping: 22, stiffness: 420, mass: 0.7 } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function waUrl(lang: string): string {
  const msg = lang === "en"
    ? "Hello, I need help with a specific medicine or order."
    : "مرحباً، أحتاج مساعدة بخصوص دواء أو طلب معين.";
  return `https://wa.me/201112343212?text=${encodeURIComponent(msg)}`;
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

const SectionLabel = memo(function SectionLabel({
  icon, label, accent = kit.color.accentDeep,
}: {
  icon:    IoniconsName;
  label:   string;
  accent?: string;
}) {
  return (
    <View style={[sl.row, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={[sl.badge, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <UIText style={[sl.label, { color: accent, textAlign: TEXT_START }]}>{label}</UIText>
    </View>
  );
});

// ─── MenuRow ──────────────────────────────────────────────────────────────────

interface MenuRowProps {
  icon:      IoniconsName;
  label:     string;
  subtitle?: string;
  onPress:   () => void;
  badge?:    number | string;
  color?:    string;
  danger?:   boolean;
  last?:     boolean;
}

const MenuRow = memo(function MenuRow({
  icon, label, subtitle, onPress, badge, color, danger, last,
}: MenuRowProps) {
  const ic    = danger ? kit.color.danger : (color ?? kit.color.accentDeep);
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleIn    = useCallback(() => { scale.value = withSpring(0.985, SPRING_PRESS); }, [scale]);
  const handleOut   = useCallback(() => { scale.value = withSpring(1,     SPRING_PRESS); }, [scale]);
  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}>
      <Animated.View style={[mr.row, !last && mr.sep, anim]}>

        {/* Leading icon tile */}
        <View style={[mr.iconTile, {
          backgroundColor: danger ? kit.color.dangerTint  : `${ic}14`,
          borderColor:     danger ? "rgba(179,38,30,0.28)" : `${ic}26`,
        }]}>
          <Ionicons name={icon} size={20} color={ic} />
        </View>

        {/* Title + optional subtitle — flex:1 so the chevron stays at the
            trailing edge. Vertical metrics are dictated by the label; the
            subtitle floats underneath with a tight 16pt line-height so the
            row's overall height grows only when a subtitle exists. */}
        <View style={mr.textGroup}>
          <UIText
            weight="bold"
            style={[mr.label, danger && { color: kit.color.danger }]}
            numberOfLines={1}>
            {label}
          </UIText>
          {subtitle && (
            <UIText weight="semibold" style={mr.sub} numberOfLines={1}>
              {subtitle}
            </UIText>
          )}
        </View>

        {/* Trailing cluster: optional badge + chevron well */}
        <View style={mr.trailing}>
          {badge != null && (
            <View style={[mr.badgePill, danger && mr.badgeDanger]}>
              <UIText weight="black" style={[mr.badgeText, { color: danger ? kit.color.danger : kit.color.accentDeep }]}>
                {badge}
              </UIText>
            </View>
          )}
          <View style={mr.chevronWell}>
            <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.inkFaint} />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});


// ─── ProfileScreen ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const gesture = useTabSwipeGesture("profile");
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { t }                     = useTranslation();
  const { language, setLanguage } = useAppLanguage();
  const { user, signOut }         = useAuth();
  const cartCount     = useCartStore((s) => s.itemCount());
  const wishlistCount = useWishlistStore((s) => s.items.length);
  const orders        = useOrderStore((s) => s.orders);
  const [signingOut, setSigningOut] = useState(false);

  const { orderCount, lastOrder } = useMemo(() => ({
    orderCount: orders.length,
    lastOrder:  orders[0] ?? null,
  }), [orders]);

  const goEditProfile   = useCallback(() => router.push("/edit-profile"),         [router]);
  const goSecurity      = useCallback(() => router.push("/change-password"),      [router]);
  const goNotifications = useCallback(() => router.push("/notifications"),        [router]);
  const goAddresses     = useCallback(() => router.push("/addresses"),            [router]);
  const goPayment       = useCallback(() => router.push("/payment"),              [router]);
  const goFaq           = useCallback(() => router.push("/faq"),                  [router]);
  const goAbout         = useCallback(() => router.push("/about"),                [router]);
  const goPrivacy       = useCallback(() => router.push("/privacy"),              [router]);
  const goTerms         = useCallback(() => router.push("/terms"),                [router]);
  const callWhatsApp    = useCallback(() => Linking.openURL(waUrl(language)).catch(() => {}), [language]);
  const callPhone       = useCallback(() => Linking.openURL("tel:01112343212").catch(() => {}), []);
  const toggleLanguage  = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void setLanguage(language === "ar" ? "en" : "ar");
  }, [language, setLanguage]);

  const handleSignOut = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setSigningOut(true);
    try { await signOut(); } finally { setSigningOut(false); }
  }, [signOut]);

  return (
    <GestureDetector gesture={gesture}>
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: theme.layout.tabBarHeight + 32 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── Hero ── */}
        {user ? (
          <ProfileAuthHero
            user={user}
            orderCount={orderCount}
            wishlistCount={wishlistCount}
            cartCount={cartCount}
            lastOrder={lastOrder}
            insetsTop={insets.top}
          />
        ) : (
          <ProfileGuestHero insetsTop={insets.top} />
        )}

        {/* ── Settings ── */}
        <View style={s.section}>
          <SectionLabel icon="settings-outline" label={t("profile.settingsSection")} accent={kit.color.accentDeep} />
          <View style={s.card}>
            {user && (
              <MenuRow
                icon="create-outline" color={kit.color.accent}
                label={t("profile.menuEditProfile")} subtitle={t("profile.menuEditProfileSubtitle")}
                onPress={goEditProfile}
              />
            )}
            <MenuRow
              icon="language-outline" color="#2563EB"
              label={t("language.label")} subtitle={language === "ar" ? t("language.en") : t("language.ar")}
              onPress={toggleLanguage}
            />
            <MenuRow
              icon="notifications-outline" color={kit.color.warn}
              label={t("profile.notifications")} subtitle={t("profile.notificationsSubtitle")}
              onPress={goNotifications}
            />
            {user && (
              <MenuRow
                icon="lock-closed-outline" color={kit.color.inkSoft}
                label={t("profile.menuSecurity")} subtitle={t("profile.menuSecuritySubtitle")}
                onPress={goSecurity}
              />
            )}
            <MenuRow
              icon="location-outline" color={kit.color.success}
              label={t("profile.menuAddresses")} subtitle={t("profile.menuAddressesSubtitle")}
              onPress={goAddresses}
            />
            <MenuRow
              icon="card-outline" color="#7C3AED"
              label={t("profile.menuPayment")} subtitle={t("profile.menuPaymentSubtitle")}
              onPress={goPayment}
              last
            />
          </View>
        </View>

        {/* ── Support ── */}
        <View style={s.section}>
          <SectionLabel icon="headset-outline" label={t("profile.sectionSupport")} accent={PROFILE.whatsappGreen} />
          <View style={s.card}>
            <MenuRow
              icon="logo-whatsapp" color={PROFILE.whatsappGreen}
              label={t("profile.whatsapp")} subtitle={t("profile.whatsappSubtitle")}
              onPress={callWhatsApp}
            />
            <MenuRow
              icon="call-outline" color={kit.color.accent}
              label={t("profile.callUs")} subtitle="01112343212"
              onPress={callPhone}
            />
            <MenuRow
              icon="help-circle-outline" color="#6366F1"
              label={t("profile.faq")}
              onPress={goFaq} last
            />
          </View>
        </View>

        {/* ── About ── */}
        <View style={s.section}>
          <SectionLabel icon="information-circle-outline" label={t("profile.sectionAbout")} accent={kit.color.inkSoft} />
          <View style={s.card}>
            <MenuRow icon="business-outline"         color={kit.color.accent}   label={t("profile.aboutPharmacy")} onPress={goAbout}   />
            <MenuRow icon="document-text-outline"    color={kit.color.inkSoft}  label={t("profile.privacy")}       onPress={goPrivacy} />
            <MenuRow icon="shield-checkmark-outline" color={kit.color.success}  label={t("profile.terms")}         onPress={goTerms}   last />
          </View>
        </View>

        {/* ── Sign out ── */}
        {user && (
          <View style={s.dangerWrap}>
            <Pressable
              onPress={handleSignOut}
              disabled={signingOut}
              accessibilityRole="button"
              accessibilityLabel={t("profile.logout")}
              style={s.dangerCard}>
              {({ pressed }) => (
                <View style={[s.dangerCardInner, pressed && s.dangerCardPressed]}>
                  {/* Leading cluster: icon + label/subtitle stack */}
                  <View style={s.dangerLeading}>
                    <View style={s.dangerIconWell}>
                      <Ionicons name="log-out-outline" size={20} color={kit.color.danger} />
                    </View>
                    <View style={s.dangerTextStack}>
                      <UIText style={s.dangerLabel} numberOfLines={1}>
                        {signingOut ? t("common.loading") : t("profile.logout")}
                      </UIText>
                      <UIText style={s.dangerSubtitle} numberOfLines={1}>
                        {t("profile.logoutSubtitle")}
                      </UIText>
                    </View>
                  </View>
                  {/* Trailing chevron — pinned to the row's end edge */}
                  <Ionicons
                    name={FORWARD_CHEVRON}
                    size={16}
                    color="rgba(179,38,30,0.55)"
                  />
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={s.footer}>
          <View style={[s.footerPill, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="medkit" size={12} color={kit.color.accentDeep} />
            <UIText style={s.footerBrand}>{t("profile.footerName")}</UIText>
          </View>
          <UIText style={s.footerName}>United Pharmacies</UIText>
          <UIText style={s.footerVersion}>{t("profile.version", { ver: "1.0.0" })}</UIText>
        </View>

      </ScrollView>
    </View>
    </GestureDetector>
  );
}

// ─── SectionLabel styles ──────────────────────────────────────────────────────

const sl = StyleSheet.create({
  row: {
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: theme.layout.pagePaddingH,
    marginBottom:      12,
  },
  badge: {
    width:          32,
    height:         32,
    borderRadius:   11,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
  },
  label: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         18,
    letterSpacing:      0.3,
    includeFontPadding: false,
  },
});

// ─── MenuRow styles ───────────────────────────────────────────────────────────

const mr = StyleSheet.create({
  row: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    paddingVertical:   14,
    paddingHorizontal: 16,
    backgroundColor:   kit.color.surface,
    gap:               14,
    minHeight:         64,
  },
  sep: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  iconTile: {
    width:          44,
    height:         44,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
    flexShrink:     0,
  },
  textGroup: {
    flex:           1,
    gap:            2,
    justifyContent: "center",
    flexShrink:     1,
  },
  label: {
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    letterSpacing:      -0.1,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  sub: {
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    letterSpacing:      0.1,
    includeFontPadding: false,
  },
  trailing: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
    flexShrink:    0,
  },
  chevronWell: {
    width:          22,
    height:         22,
    alignItems:     "center",
    justifyContent: "center",
  },
  badgePill: {
    minWidth:          26,
    height:            24,
    borderRadius:      12,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 8,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       "rgba(14,126,116,0.18)",
  },
  badgeDanger: {
    backgroundColor: kit.color.dangerTint,
    borderColor:     "rgba(179,38,30,0.3)",
  },
  badgeText: {
    fontSize:           10,
    lineHeight:         14,
    letterSpacing:      0.2,
    includeFontPadding: false,
  },
});


// ─── Screen styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },
  scroll: {},

  section: {
    marginTop: kit.sp(7),
  },

  card: {
    marginHorizontal: theme.layout.pagePaddingH,
    backgroundColor:  kit.color.surface,
    borderRadius:     kit.radius.lg,
    overflow:         "hidden",
    borderWidth:      1,
    borderColor:      kit.color.line,
    ...kit.shadow.raised,
  },

  dangerWrap: {
    paddingHorizontal: theme.layout.pagePaddingH,
    marginTop:         kit.sp(5),
  },
  // Sign-out: explicit row layout, justify space-between.
  // Leading cluster = icon + label/subtitle stack; trailing = chevron.
  // dangerCard is the bare Pressable — visual styling lives on dangerCardInner
  // (a plain View) so the Pressable's own style prop never needs a gap-bearing
  // function-computed array, which has been unreliable in this RN/Fabric setup.
  dangerCard: {
    borderRadius: kit.radius.lg,
    overflow:     "hidden",
  },
  dangerCardInner: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "space-between",
    gap:               12,
    backgroundColor:   kit.color.dangerTint,
    borderRadius:      kit.radius.lg,
    paddingVertical:   14,
    paddingHorizontal: 16,
    borderWidth:       1.5,
    borderColor:       "rgba(179,38,30,0.32)",
    ...kit.shadow.raised,
  },
  dangerCardPressed: {
    opacity:   0.88,
    transform: [{ scale: 0.99 }],
  },
  dangerLeading: {
    flex:          1,
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
    flexShrink:    1,
  },
  dangerIconWell: {
    width:           44,
    height:          44,
    borderRadius:    14,
    backgroundColor: "rgba(179,38,30,0.13)",
    borderWidth:     1,
    borderColor:     "rgba(179,38,30,0.28)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  dangerTextStack: {
    flex: 1,
    gap:  2,
  },
  dangerLabel: {
    fontFamily:         theme.fonts.extrabold,
    fontSize:           14,
    lineHeight:         20,
    letterSpacing:      -0.1,
    color:              kit.color.danger,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  dangerSubtitle: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11.5,
    lineHeight:         16,
    color:              "rgba(179,38,30,0.65)",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  footer: {
    alignItems:    "center",
    marginTop:     kit.sp(5),
    paddingBottom: kit.sp(4),
    gap:           6,
  },
  footerPill: {
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  footerBrand: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  footerName: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  footerVersion: {
    fontFamily:         theme.fonts.regular,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
    marginTop:          kit.sp(1),
  },
});
