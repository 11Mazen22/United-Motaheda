/**
 * Hero — Home's signature dark-luxury moment: greeting + a floating glass
 * search bar + a single prescription-scan CTA. Deliberately restrained —
 * TodayCare (rendered just below) already owns "what needs the user today",
 * so this band's only job is search entry and one calm, confident branded
 * beat, not a grid of quick-action tiles.
 */

import React, { memo, useEffect, useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAuth } from "@/features/auth";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface HeroProps {
  onSearch: () => void;
  onScanRx: () => void;
}

export const Hero = memo(function Hero({ onSearch, onScanRx }: HeroProps) {
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const reducedMotion = useReducedMotion();
  const firstName = useMemo(() => (user?.name ?? "").split(" ")[0].trim() || null, [user?.name]);

  const glow = useSharedValue(0.5);
  useEffect(() => {
    if (reducedMotion) return;
    glow.value = withRepeat(withSequence(withTiming(0.85, { duration: 3200 }), withTiming(0.5, { duration: 3200 })), -1, true);
  }, [glow, reducedMotion]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradients.heroPrimary as unknown as [string, string, string]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />

      <View style={[styles.content, { paddingHorizontal: pagePad }]}>
        <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.headline}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <UIText weight="bold" style={styles.badgeText}>
              {firstName ? t("home.greeting", { name: firstName }) : t("home.greetingGuest")}
            </UIText>
          </View>
          <UIText variant="h1" style={{ color: "#FFFFFF", textAlign: "center", marginTop: 14 }}>
            {t("home.heroTaglineTitle")}
          </UIText>
          <UIText variant="body-sm" style={{ color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 8 }}>
            {t("home.heroTaglineSub")}
          </UIText>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(80).springify()} style={{ marginTop: 24 }}>
          <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel={t("search.placeholder")} style={[styles.searchBox, Platform.OS === "web" && { backgroundColor: "rgba(255,255,255,0.14)" }]}>
            {Platform.OS !== "web" && <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
            <View style={[styles.searchInner, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="search" size={20} color="rgba(255,255,255,0.85)" />
              <UIText numberOfLines={1} style={{ flex: 1, marginHorizontal: 12, color: "rgba(255,255,255,0.75)", textAlign: TEXT_START }}>
                {t("search.placeholder")}
              </UIText>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(140).springify()}>
          <Pressable onPress={onScanRx} accessibilityRole="button" style={styles.rxRow}>
            <View style={styles.rxIconWell}>
              <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            </View>
            <UIText weight="bold" numberOfLines={1} style={{ flex: 1, color: "#FFFFFF", textAlign: TEXT_START }}>
              {t("home.qaScanLabel", "Scan Rx")}
            </UIText>
            <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={18} color="rgba(255,255,255,0.65)" />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  glow: {
    position: "absolute",
    top: -80,
    end: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(44,203,189,0.35)",
  },
  content: {
    paddingTop: 96,
    paddingBottom: 24,
    gap: 14,
  },
  headline: {
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2CCBBD",
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
    color: "#FFFFFF",
  },
  searchBox: {
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  searchInner: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  rxRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  rxIconWell: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
});
