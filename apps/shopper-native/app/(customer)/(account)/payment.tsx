/**

 * Payment methods — settings screen where the user picks their default payment

 * method. Not the checkout flow's payment step (which lives in app/checkout).

 */



import React from "react";

import { useDarkColors } from '@/hooks/useDarkColors';

import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { kit } from "@pharmacy/ui-native";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTranslation } from "react-i18next";

import { PaymentMethodSelector, usePaymentStore } from "@/features/payment";

import { Text as UIText } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { theme } from "@pharmacy/design-tokens";



type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



const TRUST_ITEMS: { icon: IoniconsName; labelKey: string }[] = [

  { icon: "lock-closed-outline",      labelKey: "payment.trustEncrypted" },

  { icon: "shield-checkmark-outline", labelKey: "payment.trustSecure"    },

  { icon: "eye-off-outline",          labelKey: "payment.trustPrivacy"   },

  { icon: "flash-outline",            labelKey: "payment.trustInstant"   },

];



export default function PaymentScreen() {

  const { c } = useDarkColors();
  const s = getStyles(c, theme);



  const router = useRouter();

  const insets = useSafeAreaInsets();

  const { t }  = useTranslation();



  // Store hydration (anonymous cache + authed server sync) is owned by

  // PharmacyBootstrap at the root layout — it re-hydrates on every auth

  // state change. Re-hydrating here with hydratePaymentStore() would force

  // anonymous mode (userId: null) on every screen visit, clobbering an

  // already-loaded signed-in user's server preference.

  const selectedLabelKey = usePaymentStore((s) =>

    s.methods.find((m) => m.type === s.selected)?.labelKey ?? ""

  );

  const selectedLabel = selectedLabelKey ? t(selectedLabelKey) : "";



  return (

    <View style={s.screen}>



      {/* ── VIP Header ── */}

      <Animated.View entering={FadeIn.duration(240)} style={[s.header, { paddingTop: insets.top + 10 }]}>

        <Pressable

          onPress={() => router.back()}

          hitSlop={10}

          accessibilityRole="button"

          accessibilityLabel={t("common.back")}

          style={s.backBtn}>

          <Ionicons name={BACK_CHEVRON} size={18} color={c.inkSoft} />

        </Pressable>



        <View style={s.iconTile}>

          <Ionicons name="card-outline" size={22} color={c.accentDeep} />

        </View>



        <View style={{ flex: 1 }}>

          <UIText style={s.headerTitle}>{t("payment.title")}</UIText>

          <UIText style={s.headerSubtitle}>{t("payment.subtitle")}</UIText>

        </View>

      </Animated.View>



      <ScrollView

        showsVerticalScrollIndicator={false}

        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>



        {/* ── Current method callout ── */}

        <Animated.View entering={FadeIn.duration(220)} style={[s.currentCard, { flexDirection: flexRow(IS_RTL) }]}>

          <View style={s.currentBadge}>

            <Ionicons name="checkmark" size={14} color="#fff" />

          </View>

          <View style={{ flex: 1, gap: 3 }}>

            <UIText style={[s.currentLabel, { textAlign: TEXT_START }]}>{t("payment.savedTitle")}</UIText>

            <UIText style={[s.currentValue, { textAlign: TEXT_START }]} numberOfLines={2}>

              {selectedLabel || "—"}

            </UIText>

          </View>

          <View style={s.currentAccentBar} />

        </Animated.View>



        {/* ── Method cards ── */}

        <Animated.View entering={FadeInDown.delay(80).duration(280)}>

          <View style={s.sectionLabel}>

            <View style={[s.sectionBadge, { flexDirection: flexRow(IS_RTL) }]}>

              <Ionicons name="list-outline" size={14} color={c.accentDeep} />

            </View>

            <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("payment.methodsTitle")}</UIText>

          </View>

          <PaymentMethodSelector />

        </Animated.View>



        {/* ── Trust strip ── */}

        <Animated.View entering={FadeInDown.delay(180).duration(280)} style={s.trustStrip}>

          {TRUST_ITEMS.map((item) => (

            <View key={item.labelKey} style={s.trustItem}>

              <View style={s.trustIcon}>

                <Ionicons name={item.icon} size={14} color={c.accentDeep} />

              </View>

              <UIText style={s.trustText} numberOfLines={1}>{t(item.labelKey)}</UIText>

            </View>

          ))}

        </Animated.View>



        {/* ── Info note ── */}

        <Animated.View entering={FadeInDown.delay(240).duration(280)} style={[s.infoNote, { flexDirection: flexRow(IS_RTL) }]}>

          <Ionicons name="information-circle-outline" size={16} color={c.accentDeep} />

          <UIText style={[s.infoText, { textAlign: TEXT_START }]}>{t("payment.infoNote")}</UIText>

        </Animated.View>

      </ScrollView>

    </View>

  );

}



// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (c: { canvas: string; surface: string; line: string; accentDeep: string; accentTint: string; ink: string; inkSoft: string; inkFaint: string; warn: string; warnTint: string; success: string; successTint: string; danger: string; dangerTint: string; well: string }, theme: { fonts: { black: string; bold: string; semibold: string; medium: string; regular: string }; layout: { pagePaddingH: number } }) => StyleSheet.create({

  screen: { flex: 1, backgroundColor: c.canvas },



  // Header

  header: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               14,

    paddingHorizontal: 20,

    paddingBottom:     16,

    backgroundColor:   c.surface,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: c.line,

    ...kit.shadow.raised,

  },

  backBtn: {

    width:           40,

    height:          40,

    borderRadius:    20,

    backgroundColor: c.surface,

    alignItems:      "center",

    justifyContent:  "center",

    borderWidth:     1,

    borderColor:     c.line,

    ...kit.shadow.raised,

    flexShrink:      0,

  },

  iconTile: {

    width:           52,

    height:          52,

    borderRadius:    16,

    backgroundColor: c.accentTint,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

    flexShrink:      0,

  },

  headerTitle: {

    fontFamily:         theme.fonts.black,

    fontSize:           18,

    letterSpacing:      -0.4,

    color:              c.ink,

    includeFontPadding: false,

    textAlign:          TEXT_START,

  },

  headerSubtitle: {

    fontFamily:         theme.fonts.semibold,

    fontSize:           11,

    color:              c.inkFaint,

    includeFontPadding: false,

    textAlign:          TEXT_START,

    marginTop:          1,

  },



  // Content

  content: { padding: 20, gap: 20 },



  // Current method callout

  currentCard: {

    alignItems:      "center",

    gap:             14,

    padding:         16,

    borderRadius:    16,

    backgroundColor: c.accentTint,

    borderWidth:     1,

    borderColor:     c.line,

    overflow:        "hidden",

    ...kit.shadow.raised,

  },

  currentBadge: {

    width:           34,

    height:          34,

    borderRadius:    11,

    backgroundColor: c.accentDeep,

    alignItems:      "center",

    justifyContent:  "center",

    flexShrink:      0,

  },

  currentLabel: {

    fontFamily:         theme.fonts.bold,

    fontSize:           10,

    letterSpacing:      0.5,

    color:              c.accentDeep,

    includeFontPadding: false,

  },

  currentValue: {

    fontFamily:         theme.fonts.black,

    fontSize:           14,

    color:              c.ink,

    lineHeight:         19,

    includeFontPadding: false,

  },

  currentAccentBar: {

    position:        "absolute",

    top:             0,

    bottom:          0,

    start:           0,

    width:           3,

    backgroundColor: c.accentDeep,

  },



  // Section label

  sectionLabel: {

    flexDirection:  flexRow(IS_RTL),

    alignItems:     "center",

    gap:            10,

    marginBottom:   12,

  },

  sectionBadge: {

    width:           32,

    height:          32,

    borderRadius:    11,

    backgroundColor: c.accentTint,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

  },

  sectionTitle: {

    fontFamily:         theme.fonts.black,

    fontSize:           13,

    letterSpacing:      0.3,

    color:              c.inkSoft,

    includeFontPadding: false,

  },



  // Trust strip

  trustStrip: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    justifyContent:    "space-between",

    paddingVertical:   14,

    paddingHorizontal: 8,

    borderRadius:      16,

    backgroundColor:   c.surface,

    borderWidth:       1,

    borderColor:       c.line,

    ...kit.shadow.raised,

  },

  trustItem: {

    flex:        1,

    alignItems:  "center",

    gap:         6,

  },

  trustIcon: {

    width:           34,

    height:          34,

    borderRadius:    11,

    backgroundColor: c.accentTint,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

  },

  trustText: {

    fontFamily:         theme.fonts.bold,

    fontSize:           9,

    color:              c.inkSoft,

    textAlign:          "center",

    includeFontPadding: false,

  },



  // Info note

  infoNote: {

    alignItems:      "flex-start",

    gap:             10,

    padding:         14,

    borderRadius:    14,

    backgroundColor: c.accentTint,

    borderWidth:     1,

    borderColor:     c.line,

  },

  infoText: {

    flex:               1,

    fontFamily:         theme.fonts.regular,

    fontSize:           12,

    lineHeight:         18,

    color:              c.accentDeep,

    includeFontPadding: false,

  },

});

