import React, { useCallback } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { kit } from "@pharmacy/ui-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth";
import {
  useNotificationPreferences,
  type NotificationCategoryPrefs,
  type NotificationChannelPrefs,
} from "@/features/notifications";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const CHANNELS: Array<{
  key:      keyof NotificationChannelPrefs;
  labelKey: string;
  descKey:  string;
  icon:     IoniconsName;
  color:    string;
  bg:       string;
}> = [
  { key: "push",  labelKey: "notifications.channelPushLabel",  descKey: "notifications.channelPushDesc",  icon: "notifications-outline", color: kit.color.accentDeep,   bg: kit.color.accentTint          },
  { key: "email", labelKey: "notifications.channelEmailLabel", descKey: "notifications.channelEmailDesc", icon: "mail-outline",           color: "#7C3AED",               bg: "rgba(124,58,237,0.08)"       },
  { key: "sms",   labelKey: "notifications.channelSmsLabel",   descKey: "notifications.channelSmsDesc",   icon: "chatbubble-outline",     color: kit.color.warn,          bg: kit.color.warnTint            },
];

const CATEGORIES: Array<{
  key:      keyof NotificationCategoryPrefs;
  labelKey: string;
  descKey:  string;
  icon:     IoniconsName;
  color:    string;
}> = [
  { key: "order_updates",    labelKey: "notifications.catOrderLabel",       descKey: "notifications.catOrderDesc",       icon: "bag-handle-outline",      color: kit.color.accentDeep },
  { key: "promotions",       labelKey: "notifications.catPromoLabel",       descKey: "notifications.catPromoDesc",       icon: "pricetag-outline",        color: kit.color.warn       },
  { key: "security_alerts",  labelKey: "notifications.catSecurityLabel",    descKey: "notifications.catSecurityDesc",    icon: "shield-checkmark-outline", color: kit.color.success    },
  { key: "health_reminders", labelKey: "notifications.catHealthLabel",      descKey: "notifications.catHealthDesc",      icon: "heart-outline",           color: "#E53E3E"             },
  { key: "new_arrivals",     labelKey: "notifications.catNewArrivalsLabel", descKey: "notifications.catNewArrivalsDesc", icon: "sparkles-outline",        color: "#7C3AED"             },
  { key: "account_updates",  labelKey: "notifications.catAccountLabel",     descKey: "notifications.catAccountDesc",     icon: "person-outline",          color: kit.color.inkSoft    },
];

// ─── Section header ───────────────────────────────────────────────────────────
function SectionLabel({ icon, title, accent = kit.color.accentDeep }: { icon: IoniconsName; title: string; accent?: string }) {
  return (
    <View style={[s.sectionLabel, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={[s.sectionBadge, { backgroundColor: `${accent}14`, borderColor: `${accent}28` }]}>
        <Ionicons name={icon} size={15} color={accent} />
      </View>
      <UIText style={[s.sectionTitle, { color: accent, textAlign: TEXT_START }]}>{title}</UIText>
    </View>
  );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({
  icon, color, bg, label, desc, value, onChange, disabled, last,
}: {
  icon: IoniconsName; color: string; bg: string;
  label: string; desc: string;
  value: boolean; onChange: (v: boolean) => void;
  disabled: boolean; last?: boolean;
}) {
  return (
    <View style={[s.row, { flexDirection: flexRow(IS_RTL) }, !last && s.rowBorder]}>
      <View style={[s.rowIcon, { backgroundColor: bg, borderColor: `${color}28` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <View style={s.rowText}>
        <UIText style={[s.rowLabel, { textAlign: TEXT_START }]}>{label}</UIText>
        <UIText style={[s.rowDesc, { textAlign: TEXT_START }]}>{desc}</UIText>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: kit.color.lineStrong, true: kit.color.accent }}
        thumbColor={value ? kit.color.accentDeep : "#fff"}
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationPreferencesScreen() {
  const { t }    = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const { preferences, isLoading, update } = useNotificationPreferences(user?.id);

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  }, []);

  const toggleChannel  = useCallback((key: keyof NotificationChannelPrefs, v: boolean) => {
    haptic();
    update({ channels:   { ...preferences.channels,   [key]: v } });
  }, [haptic, preferences.channels, update]);

  const toggleCategory = useCallback((key: keyof NotificationCategoryPrefs, v: boolean) => {
    haptic();
    update({ categories: { ...preferences.categories, [key]: v } });
  }, [haptic, preferences.categories, update]);

  return (
    <View style={s.screen}>

      {/* ── VIP Header ── */}
      <Animated.View entering={FadeIn.duration(240)} style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
        </Pressable>
        <View style={s.iconTile}>
          <Ionicons name="options-outline" size={22} color={kit.color.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <UIText style={s.headerEyebrow}>{t("notifications.prefTitle")}</UIText>
          <UIText style={s.headerTitle}>{t("notifications.prefSubtitle")}</UIText>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>

        {/* Signed-out banner */}
        {!user && (
          <Animated.View entering={FadeIn.duration(200)} style={[s.warnBanner, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="lock-closed-outline" size={14} color={kit.color.warn} />
            <UIText style={[s.warnText, { textAlign: TEXT_START }]}>{t("notifications.signInToSave")}</UIText>
          </Animated.View>
        )}

        {/* ── Channels ── */}
        <Animated.View entering={FadeInDown.duration(280)}>
          <SectionLabel icon="megaphone-outline" title={t("notifications.channelsTitle")} />
          <View style={s.card}>
            {CHANNELS.map((ch, i) => (
              <ToggleRow
                key={ch.key}
                icon={ch.icon}
                color={ch.color}
                bg={ch.bg}
                label={t(ch.labelKey)}
                desc={t(ch.descKey)}
                value={preferences.channels[ch.key]}
                onChange={(v) => toggleChannel(ch.key, v)}
                disabled={isLoading}
                last={i === CHANNELS.length - 1}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── Categories ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(280)} style={{ marginTop: 24 }}>
          <SectionLabel icon="grid-outline" title={t("notifications.categoriesTitle")} accent={kit.color.inkSoft} />
          <View style={s.card}>
            {CATEGORIES.map((cat, i) => (
              <ToggleRow
                key={cat.key}
                icon={cat.icon}
                color={cat.color}
                bg={`${cat.color}14`}
                label={t(cat.labelKey)}
                desc={t(cat.descKey)}
                value={preferences.categories[cat.key]}
                onChange={(v) => toggleCategory(cat.key, v)}
                disabled={isLoading}
                last={i === CATEGORIES.length - 1}
              />
            ))}
          </View>
        </Animated.View>

        {/* Footer note */}
        <Animated.View entering={FadeInDown.delay(160).duration(280)} style={[s.footerNote, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="information-circle-outline" size={14} color={kit.color.accentDeep} />
          <UIText style={[s.footerText, { textAlign: TEXT_START }]}>{t("notifications.securityNote")}</UIText>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // Header
  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 20,
    paddingBottom:     16,
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
  headerEyebrow: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.4,
    color:              kit.color.ink,
    includeFontPadding: false,
    textAlign:          TEXT_START,
  },
  headerTitle: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
    textAlign:          TEXT_START,
  },

  // Content
  content: { padding: 20, gap: 0 },

  // Warn banner
  warnBanner: {
    alignItems:        "center",
    gap:               8,
    backgroundColor:   kit.color.warnTint,
    borderRadius:      14,
    padding:           12,
    marginBottom:      20,
    borderWidth:       1,
    borderColor:       kit.color.warn + "40",
  },
  warnText: {
    flex:               1,
    fontSize:           11,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.warn,
    includeFontPadding: false,
  },

  // Section label
  sectionLabel: {
    alignItems:    "center",
    gap:           10,
    marginBottom:  12,
  },
  sectionBadge: {
    width:          32,
    height:         32,
    borderRadius:   11,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1,
  },
  sectionTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    letterSpacing:      0.3,
    includeFontPadding: false,
  },

  // Card
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },

  // Row
  row: {
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 16,
    paddingVertical:   16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  rowIcon: {
    width:          44,
    height:         44,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
    borderWidth:    1,
  },
  rowText: { flex: 1, gap: 3 },
  rowLabel: {
    fontSize:           13,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  rowDesc: {
    fontSize:           11,
    fontFamily:         theme.fonts.regular,
    color:              kit.color.inkFaint,
    lineHeight:         16,
    includeFontPadding: false,
  },

  // Footer
  footerNote: {
    alignItems:        "flex-start",
    gap:               10,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      14,
    padding:           14,
    marginTop:         24,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  footerText: {
    flex:               1,
    fontSize:           11,
    fontFamily:         theme.fonts.regular,
    color:              kit.color.accentDeep,
    lineHeight:         18,
    includeFontPadding: false,
  },
});
