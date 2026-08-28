import React, { useMemo } from "react";

import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import type { NativeTheme } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import Animated, { FadeInDown } from "react-native-reanimated";

import { useTranslation } from "react-i18next";

import { theme as legacyTheme } from "@pharmacy/design-tokens";


import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);

const WA_URL = `https://wa.me/201112343212?text=${encodeURIComponent("السلام عليكم، أحتاج إلى مساعدة بخصوص تطبيق صيدليات المتحدة. يرجى التواصل معي عند أقرب فرصة. شكراً لكم.")}`;



function openWhatsApp(t: (key: string) => string) {

  Linking.canOpenURL(WA_URL).then(ok => {

    if (ok) return Linking.openURL(WA_URL);

    Alert.alert(t("terms.whatsappUnavailableTitle"), t("terms.whatsappUnavailableBody"), [{ text: t("terms.ok") }]);

  }).catch(() => Alert.alert(t("terms.whatsappErrorTitle"), t("terms.whatsappErrorBody")));

}



function Section({ title, children, delay = 0, theme, styles }: { title: string; children: React.ReactNode; delay?: number; theme: NativeTheme; styles: ReturnType<typeof getStyles> }) {

  return (

    <Animated.View entering={FadeInDown.duration(350).delay(delay)} style={styles.sec}>

      <View style={styles.secHdr}>

        <View style={styles.secDot}><Ionicons name="document-text-outline" size={12} color={theme.colors.brand.primary} /></View>

        <UIText style={styles.secTitle}>{title}</UIText>

      </View>

      <UIText style={styles.secBody}>{children}</UIText>

    </Animated.View>

  );

}



export default function TermsScreen() {

  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation(), router = useRouter(), insets = useSafeAreaInsets();



  return (

    <View style={[styles.screen, { paddingTop: insets.top }]}>

      <View style={styles.header}>

        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>

          <Ionicons name={BACK_CHEVRON} size={18} color={theme.colors.text.secondary} />

        </Pressable>

        <UIText style={styles.title}>{t("terms.title")}</UIText>

        <View style={{ width: 38 }} />

      </View>



      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>

        <Animated.View entering={FadeInDown.duration(300)} style={styles.updated}>

          <Ionicons name="calendar-outline" size={15} color={theme.colors.brand.primary} />

          <UIText style={styles.updatedT}>{t("terms.lastUpdated", { date: "2025" })}</UIText>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(350).delay(40)} style={styles.warn}>

          <Ionicons name="document-text" size={20} color={theme.colors.status.warning} />

          <UIText style={styles.warnT}>{t("terms.agreeBanner")}</UIText>

        </Animated.View>



        {(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"] as const).map((key, i) => (
          <Section key={key} title={t(`terms.sections.${key}.title`)} delay={80 + i * 40} theme={theme} styles={styles}>
            {t(`terms.sections.${key}.body`)}
          </Section>
        ))}



        <Animated.View entering={FadeInDown.duration(350).delay(440)} style={styles.wa}>

          <View style={[styles.waIn, { flexDirection: flexRow(RTL) }]}> 

            <View style={styles.waIcon}><Ionicons name="logo-whatsapp" size={22} color="#25D366" /></View>

            <View style={{ flex: 1, gap: 2 }}>

              <UIText style={styles.waTitle}>{t("terms.supportTitle")}</UIText>

              <UIText style={styles.waSub}>{t("terms.supportSubtitle")}</UIText>

            </View>

            <Pressable style={styles.waBtnT} onPress={() => openWhatsApp(t)} accessibilityRole="button" accessibilityLabel={t("terms.supportTitle")}>

              {({ pressed }) => <View style={[styles.waBtn, pressed && styles.waBtnP]}><UIText style={styles.waBtnTxt}>{t("terms.supportStart")}</UIText></View>}

            </Pressable>

          </View>

        </Animated.View>



        <UIText style={styles.foot}>{t("terms.footer")}</UIText>

      </ScrollView>

    </View>

  );

}



function getStyles(theme: NativeTheme) {
return StyleSheet.create({

  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },

  header: { flexDirection: flexRow(RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default, ...theme.shadows[1] },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.canvas.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1] },

  title: { fontSize: 22, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary },

  content: { padding: 20 },

  updated: { flexDirection: flexRow(RTL), alignItems: "center", justifyContent: RTL ? "flex-start" : "flex-end", gap: 6, marginBottom: 14 },

  updatedT: { fontSize: 13, fontFamily: legacyTheme.fonts.semibold, color: theme.colors.brand.primary },

  warn: { flexDirection: flexRow(RTL), alignItems: "flex-start", gap: 10, backgroundColor: `${theme.colors.status.warning}1A`, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(217,119,6,0.25)", marginBottom: 20 },

  warnT: { flex: 1, fontSize: 15, fontFamily: legacyTheme.fonts.semibold, color: theme.colors.text.primary, textAlign: TA, lineHeight: 22 },

  sec: { marginBottom: 28 },

  secHdr: { flexDirection: flexRow(RTL), alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default },

  secDot: { width: 26, height: 26, borderRadius: 8, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: "rgba(14,126,116,0.20)", alignItems: "center", justifyContent: "center" },

  secTitle: { fontSize: 17, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary, flex: 1, textAlign: TA, letterSpacing: -0.3, includeFontPadding: false },

  secBody: { fontSize: 15, fontFamily: legacyTheme.fonts.regular, color: theme.colors.text.secondary, textAlign: TA, lineHeight: 28, includeFontPadding: false },

  foot: { fontSize: 11, color: theme.colors.text.muted, textAlign: "center", paddingTop: 16 },



  wa: { backgroundColor: "#F0FFF7", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "rgba(37,211,102,0.25)", marginBottom: 24 },

  waIn: { alignItems: "center", gap: 12 },

  waIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(37,211,102,0.12)", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  waTitle: { fontSize: 15, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.primary },

  waSub: { fontSize: 12, fontFamily: legacyTheme.fonts.regular, color: theme.colors.text.secondary },

  waBtnT: { borderRadius: 10, flexShrink: 0 },

  waBtn: { backgroundColor: "#25D366", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },

  waBtnP: { backgroundColor: "#1FB859" },

  waBtnTxt: { fontSize: 13, fontFamily: legacyTheme.fonts.bold, color: "#fff" },

});
}
