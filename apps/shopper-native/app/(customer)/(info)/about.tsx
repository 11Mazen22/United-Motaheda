import React from "react";

import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";

import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { kit } from "@pharmacy/ui-native";

import { useTranslation } from "react-i18next";

import { theme } from "@pharmacy/design-tokens";

import { AppLogo } from "@/shared/components/AppLogo";

import { useAppLanguage } from "@/i18n/LanguageProvider";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON, FORWARD_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);

const APP_VERSION = "1.0.0", APP_BUILD = "100";

const STATS = [{ vk: "about.stat1Value", lk: "about.stat1Label" }, { vk: "about.stat2Value", lk: "about.stat2Label" }, { vk: "about.stat3Value", lk: "about.stat3Label" }] as const;



function ContactRow({ icon, label, value, color, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string; color: string; onPress: () => void }) {

  const press = () => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); onPress(); };

  return <Pressable onPress={press} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={a.touch}>

    {({ pressed }) => <View style={[a.row, { flexDirection: flexRow(RTL) }, pressed && a.rowP]}> 

      <View style={{ flexDirection: flexRow(RTL), alignItems: "center", gap: 12, flex: 1 }}>

        <View style={[a.icon, { backgroundColor: `${color}14` }]}><Ionicons name={icon} size={20} color={color} /></View>

        <View style={{ gap: 2 }}>

          <UIText style={[a.lbl, { textAlign: TA }]}>{label}</UIText>

          <UIText style={[a.val, { textAlign: TA }]}>{value}</UIText>

        </View>

      </View>

      <Ionicons name={FORWARD_CHEVRON} size={16} color={kit.color.inkFaint} />

    </View>}

  </Pressable>;

}



function InfoRow({ label, value }: { label: string; value: string }) {

  return <View style={[a.infoRow, { flexDirection: flexRow(RTL) }]}>

    <UIText style={[a.infoLbl, { textAlign: TA }]}>{label}</UIText>

    <UIText style={a.infoVal}>{value}</UIText>

  </View>;

}



export default function AboutScreen() {

  const router = useRouter(), insets = useSafeAreaInsets(), { t } = useTranslation();

  const { language } = useAppLanguage();



  return (

    <View style={[a.screen, { paddingTop: insets.top }]}> 



      <Animated.View entering={FadeIn.duration(220)} style={[a.header, { flexDirection: flexRow(RTL) }]}> 

        <Pressable onPress={() => router.back()} style={a.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>

          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />

        </Pressable>

        <View style={a.tile}><Ionicons name="information-circle-outline" size={22} color={kit.color.accentDeep} /></View>

        <View style={{ flex: 1 }}>

          <UIText style={[a.hTitle, { textAlign: TA }]}>{t("about.title")}</UIText>

          <UIText style={[a.hSub, { textAlign: TA }]}>{t("about.subtitle")}</UIText>

        </View>

      </Animated.View>



      <ScrollView contentContainerStyle={[a.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>



        <Animated.View entering={FadeInUp.delay(60).duration(380)} style={a.brand}>

          <View style={a.ringO}><View style={a.ringI}><AppLogo size="lg" /></View></View>

          <UIText style={[a.tagline, { textAlign: "center" }]}>{t("about.tagline")}</UIText>

          <View style={[a.verBadge, { flexDirection: flexRow(RTL) }]}> 

            <Ionicons name="git-branch-outline" size={11} color={kit.color.accentDeep} />

            <UIText style={a.verTxt}>{t("profile.version", { ver: APP_VERSION })}</UIText>

          </View>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(320).delay(100)} style={a.sec}>

          <View style={[a.secHdr, { flexDirection: flexRow(RTL) }]}> 

            <View style={a.secBadge}><Ionicons name="heart-outline" size={14} color={kit.color.accentDeep} /></View>

            <UIText style={[a.secTitle, { textAlign: TA }]}>{t("about.whoWeAreTitle")}</UIText>

          </View>

          <View style={a.card}><UIText style={[a.desc, { textAlign: TA }]}>{t("about.whoWeArePara1")}{"\n\n"}{t("about.whoWeArePara2")}</UIText></View>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(320).delay(140)} style={a.sec}>

          <View style={[a.secHdr, { flexDirection: flexRow(RTL) }]}> 

            <View style={a.secBadge}><Ionicons name="stats-chart-outline" size={14} color={kit.color.accentDeep} /></View>

            <UIText style={[a.secTitle, { textAlign: TA }]}>{t("about.statsTitle")}</UIText>

          </View>

          <View style={[a.statsRow, { flexDirection: flexRow(RTL) }]}>

            {STATS.map(st => <View key={st.lk} style={a.statCard}>

              <UIText style={a.statV}>{t(st.vk)}</UIText>

              <UIText style={[a.statL, { textAlign: "center" }]}>{t(st.lk)}</UIText>

            </View>)}

          </View>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(320).delay(200)} style={a.sec}>

          <View style={[a.secHdr, { flexDirection: flexRow(RTL) }]}> 

            <View style={a.secBadge}><Ionicons name="call-outline" size={14} color={kit.color.accentDeep} /></View>

            <UIText style={[a.secTitle, { textAlign: TA }]}>{t("about.contact")}</UIText>

          </View>

          <View style={a.card}>

            <ContactRow icon="logo-whatsapp" label={t("about.whatsappLabel")} value="+20 111 234 3212" color="#25D366" onPress={() => Linking.openURL("https://wa.me/201112343212?text=مرحباً").catch(() => {})} />

            <View style={a.divider} />

            <ContactRow icon="call-outline" label={t("about.phoneLabel")} value="+20 111 234 3212" color={kit.color.accentDeep} onPress={() => Linking.openURL("tel:+201112343212").catch(() => {})} />

            <View style={a.divider} />

            <ContactRow icon="mail-outline" label={t("about.emailLabel")} value="united.pharmacy.eg@gmail.com" color={kit.color.accent} onPress={() => Linking.openURL("mailto:united.pharmacy.eg@gmail.com").catch(() => {})} />

          </View>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(320).delay(240)} style={a.sec}>

          <View style={[a.secHdr, { flexDirection: flexRow(RTL) }]}> 

            <View style={a.secBadge}><Ionicons name="phone-portrait-outline" size={14} color={kit.color.accentDeep} /></View>

            <UIText style={[a.secTitle, { textAlign: TA }]}>{t("about.appInfoTitle")}</UIText>

          </View>

          <View style={a.card}>

            <InfoRow label={t("about.versionLabel")} value={APP_VERSION} /><View style={a.divider} />

            <InfoRow label={t("about.buildLabel")} value={APP_BUILD} /><View style={a.divider} />

            <InfoRow label={t("about.osLabel")} value={Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web"} /><View style={a.divider} />

            <InfoRow label={t("language.label")} value={language === "en" ? t("language.en") : t("language.ar")} />

          </View>

        </Animated.View>



        <UIText style={a.copyright}>{t("about.copyright")}</UIText>

      </ScrollView>

    </View>

  );

}



const a = StyleSheet.create({

  screen: { flex: 1, backgroundColor: kit.color.canvas },

  header: { alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, ...kit.shadow.raised },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: kit.color.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised, flexShrink: 0 },

  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  hTitle: { fontFamily: theme.fonts.black, fontSize: 18, letterSpacing: -0.3, color: kit.color.ink, includeFontPadding: false },

  hSub: { fontFamily: theme.fonts.semibold, fontSize: 11, color: kit.color.inkFaint, includeFontPadding: false },



  content: { gap: 0 },



  brand: { alignItems: "center", gap: 16, paddingVertical: 32, paddingHorizontal: 20, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line },

  ringO: { width: 112, height: 112, borderRadius: 56, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center" },

  ringI: { width: 76, height: 76, borderRadius: 22, backgroundColor: kit.color.surface, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", ...kit.shadow.brandGlow },

  tagline: { fontFamily: theme.fonts.semibold, fontSize: 14, lineHeight: 22, color: kit.color.inkSoft, maxWidth: 280, includeFontPadding: false },

  verBadge: { alignItems: "center", gap: 5, backgroundColor: kit.color.accentTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: kit.color.line },

  verTxt: { fontFamily: theme.fonts.bold, fontSize: 11, color: kit.color.accentDeep, includeFontPadding: false },



  sec: { paddingHorizontal: 20, paddingTop: 20, gap: 10 },

  secHdr: { alignItems: "center", gap: 10 },

  secBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  secTitle: { flex: 1, fontFamily: theme.fonts.extrabold, fontSize: 13, color: kit.color.ink, letterSpacing: -0.1, includeFontPadding: false },



  card: { backgroundColor: kit.color.surface, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised },

  desc: { fontFamily: theme.fonts.regular, fontSize: 14, color: kit.color.inkSoft, lineHeight: 24, padding: 16, includeFontPadding: false },



  statsRow: { gap: 10 },

  statCard: { flex: 1, backgroundColor: kit.color.surface, borderRadius: 16, padding: 16, alignItems: "center", gap: 4, borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised },

  statV: { fontFamily: theme.fonts.black, fontSize: 22, color: kit.color.accentDeep, letterSpacing: -0.4, includeFontPadding: false },

  statL: { fontFamily: theme.fonts.semibold, fontSize: 10, color: kit.color.inkFaint, includeFontPadding: false },



  touch: { borderRadius: 0 },

  row: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },

  rowP: { backgroundColor: kit.color.well },

  icon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },

  lbl: { fontFamily: theme.fonts.semibold, fontSize: 10, color: kit.color.inkFaint, includeFontPadding: false },

  val: { fontFamily: theme.fonts.bold, fontSize: 13, color: kit.color.ink, includeFontPadding: false },

  infoRow: { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13 },

  infoLbl: { fontFamily: theme.fonts.semibold, fontSize: 13, color: kit.color.inkSoft, includeFontPadding: false },

  infoVal: { fontFamily: theme.fonts.bold, fontSize: 13, color: kit.color.ink, includeFontPadding: false },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: kit.color.line, marginHorizontal: 16 },

  copyright: { fontFamily: theme.fonts.regular, fontSize: 11, color: kit.color.inkFaint, textAlign: "center", paddingTop: 28, paddingBottom: 8, includeFontPadding: false },

});
