/**
 * DriverGuideCard — first-run explainer for the driver dashboard.
 *
 * Reported live: a driver looking at the dashboard for the first time
 * couldn't tell what any of it meant (the availability toggle, the metric
 * cards, the daily goal, the empty task list) -- every label was correct
 * Arabic but nothing explained what the SCREEN was for as a whole. This is
 * the fix: a four-step walkthrough of the actual flow (go online -> accept
 * an offer -> run the delivery -> track earnings here), shown once and
 * dismissed for good via MMKV, matching the pattern already used for
 * "last-seen onboarding step" elsewhere in this app.
 */
import React, { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeOut, FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { appKV } from "@/lib/mmkv";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const SEEN_KEY = "driver_guide_seen_v1";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Step {
  icon: IoniconsName;
  titleKey: string;
  bodyKey: string;
}

const STEPS: Step[] = [
  { icon: "toggle",            titleKey: "driver.guideStep1Title", bodyKey: "driver.guideStep1Body" },
  { icon: "notifications",     titleKey: "driver.guideStep2Title", bodyKey: "driver.guideStep2Body" },
  { icon: "navigate",          titleKey: "driver.guideStep3Title", bodyKey: "driver.guideStep3Body" },
  { icon: "stats-chart",       titleKey: "driver.guideStep4Title", bodyKey: "driver.guideStep4Body" },
];

export function DriverGuideCard(): React.ReactElement | null {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const s = React.useMemo(() => getStyles(theme), [theme]);
  const [dismissed, setDismissed] = useState(() => appKV.getString(SEEN_KEY) === "1");

  const handleDismiss = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    appKV.set(SEEN_KEY, "1");
    setDismissed(true);
  }, []);

  if (dismissed) return null;

  return (
    <Animated.View entering={FadeInDown.duration(360).springify()} exiting={FadeOut.duration(220)} style={s.wrap}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
      >
        <View style={[s.headerRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.headerIcon}>
            <Ionicons name="bulb" size={18} color="#fff" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText style={s.headerEyebrow}>{t("driver.guideEyebrow", "أول مرة هنا؟")}</UIText>
            <UIText numberOfLines={1} style={s.headerTitle}>{t("driver.guideTitle", "هكذا تعمل لوحة السائق")}</UIText>
          </View>
          <Pressable onPress={handleDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.close", "إغلاق")} style={s.closeBtn}>
            <Ionicons name="close" size={16} color="#fff" />
          </Pressable>
        </View>

        <View style={s.stepsCol}>
          {STEPS.map((step, i) => (
            <View key={step.titleKey} style={[s.stepRow, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={s.stepBadge}>
                <UIText style={s.stepBadgeText}>{i + 1}</UIText>
              </View>
              <View style={s.stepIconWell}>
                <Ionicons name={step.icon} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <UIText numberOfLines={1} style={[s.stepTitle, { textAlign: TEXT_START }]}>{t(step.titleKey)}</UIText>
                <UIText numberOfLines={2} style={[s.stepBody, { textAlign: TEXT_START }]}>{t(step.bodyKey)}</UIText>
              </View>
            </View>
          ))}
        </View>

        <Pressable onPress={handleDismiss} accessibilityRole="button" style={({ pressed }) => [s.gotItBtn, pressed && { opacity: 0.85 }]}>
          <UIText style={s.gotItText}>{t("driver.guideGotIt", "فهمت، ابدأ")}</UIText>
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.brand.primary} />
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    wrap: { marginTop: 14 },
    card: { borderRadius: 20, padding: 16, gap: 14, ...theme.shadows[3] },
    headerRow: { alignItems: "center", gap: 10 },
    headerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
    headerEyebrow: { fontSize: 10, lineHeight: 14, color: "rgba(255,255,255,0.75)", letterSpacing: 0.4 },
    headerTitle: { fontSize: 16, lineHeight: 21, fontWeight: "800", color: "#fff", marginTop: 1 },
    closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
    stepsCol: { gap: 12 },
    stepRow: { alignItems: "flex-start", gap: 10 },
    stepBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.22)", marginTop: 2 },
    stepBadgeText: { fontSize: 10, lineHeight: 13, fontWeight: "800", color: "#fff" },
    stepIconWell: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
    stepTitle: { fontSize: 13, lineHeight: 18, fontWeight: "800", color: "#fff" },
    stepBody: { fontSize: 11.5, lineHeight: 16, color: "rgba(255,255,255,0.78)", marginTop: 1 },
    gotItBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 12, backgroundColor: "#fff", marginTop: 2 },
    gotItText: { fontSize: 13, lineHeight: 17, fontWeight: "800", color: theme.colors.brand.primary },
  });
}
