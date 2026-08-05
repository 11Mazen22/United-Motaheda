/**
 * About — VIP light surface rebuild (Phase 2).
 * Removes dark ink hero. Brand identity via layered ring on canvas.
 */
import React from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { kit } from "@/shared/kit";
import { useTranslation } from "react-i18next";
import { theme } from "@/shared/theme";
import { AppLogo } from "@/shared/components/AppLogo";
import { BranchMapList } from "@/components/BranchMapCard";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON, FORWARD_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const APP_VERSION = "1.0.0";
const APP_BUILD   = "100";

const STATS = [
  { valueKey: "about.stat1Value", labelKey: "about.stat1Label" },
  { valueKey: "about.stat2Value", labelKey: "about.stat2Label" },
  { valueKey: "about.stat3Value", labelKey: "about.stat3Label" },
] as const;

interface ContactRowProps {
  icon:    React.ComponentProps<typeof Ionicons>["name"];
  label:   string;
  value:   string;
  color:   string;
  onPress: () => void;
}

function ContactRow({ icon, label, value, color, onPress }: ContactRowProps) {
  const handlePress = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={s.contactRowTouchable}>
      {({ pressed }) => (
        <View style={[s.contactRow, { flexDirection: flexRow(IS_RTL) }, pressed && s.contactRowPressed]}>
          <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12, flex: 1 }}>
            <View style={[s.contactIcon, { backgroundColor: `${color}14` }]}>
              <Ionicons name={icon} size={20} color={color} />
            </View>
            <View style={{ gap: 2 }}>
              <UIText style={[s.contactLabel, { textAlign: TEXT_START }]}>{label}</UIText>
              <UIText style={[s.contactValue, { textAlign: TEXT_START }]}>{value}</UIText>
            </View>
          </View>
          <Ionicons name={FORWARD_CHEVRON} size={16} color={kit.color.inkFaint} />
        </View>
      )}
    </Pressable>
  );
}

interface InfoRowProps { label: string; value: string }
function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={[s.infoRow, { flexDirection: flexRow(IS_RTL) }]}>
      <UIText style={[s.infoLabel, { textAlign: TEXT_START }]}>{label}</UIText>
      <UIText style={s.infoValue}>{value}</UIText>
    </View>
  );
}

export default function AboutScreen() {
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const { t }        = useTranslation();
  const { language } = useAppLanguage();

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>

      {/* ── VIP Header ── */}
      <Animated.View entering={FadeIn.duration(220)} style={[s.header, { flexDirection: flexRow(IS_RTL) }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>
          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
        </Pressable>
        <View style={s.iconTile}>
          <Ionicons name="information-circle-outline" size={22} color={kit.color.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <UIText style={[s.headerTitle, { textAlign: TEXT_START }]}>{t("about.title")}</UIText>
          <UIText style={[s.headerSub,   { textAlign: TEXT_START }]}>{t("about.subtitle")}</UIText>
        </View>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        {/* Brand identity — layered ring on white */}
        <Animated.View entering={FadeInUp.delay(60).duration(380)} style={s.brandBlock}>
          <View style={s.ringOuter}>
            <View style={s.ringInner}>
              <AppLogo size="lg" />
            </View>
          </View>
          <UIText style={[s.heroTagline, { textAlign: "center" }]}>{t("about.tagline")}</UIText>
          <View style={[s.versionBadge, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="git-branch-outline" size={11} color={kit.color.accentDeep} />
            <UIText style={s.versionText}>{t("profile.version", { ver: APP_VERSION })}</UIText>
          </View>
        </Animated.View>

        {/* Who we are */}
        <Animated.View entering={FadeInDown.duration(320).delay(100)} style={s.section}>
          <View style={[s.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.sectionBadge}>
              <Ionicons name="heart-outline" size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("about.whoWeAreTitle")}</UIText>
          </View>
          <View style={s.card}>
            <UIText style={[s.description, { textAlign: TEXT_START }]}>
              {t("about.whoWeArePara1")}{"\n\n"}{t("about.whoWeArePara2")}
            </UIText>
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.duration(320).delay(140)} style={s.section}>
          <View style={[s.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.sectionBadge}>
              <Ionicons name="stats-chart-outline" size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("about.statsTitle")}</UIText>
          </View>
          <View style={[s.statsRow, { flexDirection: flexRow(IS_RTL) }]}>
            {STATS.map((stat) => (
              <View key={stat.labelKey} style={s.statCard}>
                <UIText style={s.statValue}>{t(stat.valueKey)}</UIText>
                <UIText style={[s.statLabel, { textAlign: "center" }]}>{t(stat.labelKey)}</UIText>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Branches */}
        <Animated.View entering={FadeInDown.duration(320).delay(170)} style={s.section}>
          <View style={[s.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.sectionBadge}>
              <Ionicons name="location-outline" size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("about.branchesTitle")}</UIText>
          </View>
          <BranchMapList flat />
        </Animated.View>

        {/* Contact */}
        <Animated.View entering={FadeInDown.duration(320).delay(200)} style={s.section}>
          <View style={[s.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.sectionBadge}>
              <Ionicons name="call-outline" size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("about.contact")}</UIText>
          </View>
          <View style={s.card}>
            <ContactRow
              icon="logo-whatsapp"
              label={t("about.whatsappLabel")}
              value="+20 111 234 3212"
              color="#25D366"
              onPress={() => Linking.openURL("https://wa.me/201112343212?text=مرحباً").catch(() => {})}
            />
            <View style={s.rowDivider} />
            <ContactRow
              icon="call-outline"
              label={t("about.phoneLabel")}
              value="+20 111 234 3212"
              color={kit.color.accentDeep}
              onPress={() => Linking.openURL("tel:+201112343212").catch(() => {})}
            />
            <View style={s.rowDivider} />
            <ContactRow
              icon="mail-outline"
              label={t("about.emailLabel")}
              value="united.pharmacy.eg@gmail.com"
              color={kit.color.accent}
              onPress={() => Linking.openURL("mailto:united.pharmacy.eg@gmail.com").catch(() => {})}
            />
          </View>
        </Animated.View>

        {/* App info */}
        <Animated.View entering={FadeInDown.duration(320).delay(240)} style={s.section}>
          <View style={[s.sectionHeader, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.sectionBadge}>
              <Ionicons name="phone-portrait-outline" size={14} color={kit.color.accentDeep} />
            </View>
            <UIText style={[s.sectionTitle, { textAlign: TEXT_START }]}>{t("about.appInfoTitle")}</UIText>
          </View>
          <View style={s.card}>
            <InfoRow label={t("about.versionLabel")} value={APP_VERSION} />
            <View style={s.rowDivider} />
            <InfoRow label={t("about.buildLabel")} value={APP_BUILD} />
            <View style={s.rowDivider} />
            <InfoRow
              label={t("about.osLabel")}
              value={Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web"}
            />
            <View style={s.rowDivider} />
            <InfoRow
              label={t("language.label")}
              value={language === "en" ? t("language.en") : t("language.ar")}
            />
          </View>
        </Animated.View>

        <UIText style={s.copyright}>{t("about.copyright")}</UIText>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  header: {
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    flexShrink:      0,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.3,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  headerSub: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  content: { gap: 0 },

  // Brand block
  brandBlock: {
    alignItems:      "center",
    gap:             16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  ringOuter: {
    width:           112,
    height:          112,
    borderRadius:    56,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  ringInner: {
    width:           76,
    height:          76,
    borderRadius:    22,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },
  heroTagline: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           14,
    lineHeight:         22,
    color:              kit.color.inkSoft,
    maxWidth:           280,
    includeFontPadding: false,
  },
  versionBadge: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      999,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  versionText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // Sections
  section:       { paddingHorizontal: 20, paddingTop: 20, gap: 10 },
  sectionHeader: { alignItems: "center", gap: 10 },
  sectionBadge: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  sectionTitle: {
    flex:               1,
    fontFamily:         theme.fonts.extrabold,
    fontSize:           13,
    color:              kit.color.ink,
    letterSpacing:      -0.1,
    includeFontPadding: false,
  },

  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    16,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  description: {
    fontFamily:         theme.fonts.regular,
    fontSize:           14,
    color:              kit.color.inkSoft,
    lineHeight:         24,
    padding:            16,
    includeFontPadding: false,
  },

  statsRow: { gap: 10 },
  statCard: {
    flex:            1,
    backgroundColor: kit.color.surface,
    borderRadius:    16,
    padding:         16,
    alignItems:      "center",
    gap:             4,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  statValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    color:              kit.color.accentDeep,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           10,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // Touchable wrapper carries no visual styling — the Pressable's own
  // function-computed style is unreliable on this app's RN/Fabric setup, so
  // all real visuals (background, layout, pressed state) live on the plain
  // View inside instead.
  contactRowTouchable: { borderRadius: 0 },
  contactRow:   { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  contactRowPressed: { backgroundColor: kit.color.well },
  contactIcon:  { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  contactLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           10,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  contactValue: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  infoRow:  { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13 },
  infoLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           13,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  infoValue: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  rowDivider:  { height: StyleSheet.hairlineWidth, backgroundColor: kit.color.line, marginHorizontal: 16 },
  copyright: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    paddingTop:         28,
    paddingBottom:      8,
    includeFontPadding: false,
  },
});
