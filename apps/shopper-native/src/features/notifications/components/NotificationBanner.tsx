import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useBannerStore } from "../banner-store";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";

// ─── Constants ────────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const VISIBLE_MS = 4500;

// Same semantic mapping as the full notifications list (notifications.tsx's
// TYPE_CONFIG) — this banner and that screen must agree on what each type
// means, or the same "health" notification reads as reassuring here and
// alarming there. No LinearGradient: banned outside SplashOverlay (see the
// VIP header pattern) — solid tinted wells instead, same as every other
// icon treatment in the kit system.
const TYPE_META: Record<string, {
  icon:     IoniconsName;
  color:    string;
  bg:       string;
  labelKey: string;
}> = {
  order:  { icon: "bag-check-outline",    color: kit.color.accentDeep, bg: kit.color.accentTint, labelKey: "notification.order"  },
  offer:  { icon: "pricetag-outline",     color: kit.color.warn,       bg: kit.color.warnTint,   labelKey: "notification.offer"  },
  health: { icon: "heart-circle-outline", color: kit.color.danger,    bg: kit.color.dangerTint, labelKey: "notification.health" },
  system: { icon: "sparkles-outline",     color: kit.color.inkSoft,   bg: kit.color.well,       labelKey: "notification.system" },
};

// ─── Banner ───────────────────────────────────────────────────────────────────

export function NotificationBanner() {
  const { t }         = useTranslation();
  const router        = useRouter();
  const insets        = useSafeAreaInsets();
  const banner        = useBannerStore((s) => s.banner);
  const dismissBanner = useBannerStore((s) => s.dismissBanner);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bannerWidth, setBannerWidth] = useState(0);

  // Animation values
  const translateY = useSharedValue(-180);
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(0.95);
  const progress   = useSharedValue(1); // 1→0 drains during VISIBLE_MS

  const slideOut = useCallback(() => {
    translateY.value = withTiming(-180, { duration: 320, easing: Easing.in(Easing.quad) });
    opacity.value    = withTiming(0,    { duration: 260 });
    scale.value      = withTiming(0.94, { duration: 260 });
    setTimeout(() => dismissBanner(), 330);
  }, [dismissBanner, translateY, opacity, scale]);

  useEffect(() => {
    if (!banner) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Slide in
    translateY.value = withSpring(0,    { damping: 16, stiffness: 340, mass: 0.85 });
    opacity.value    = withTiming(1,    { duration: 180 });
    scale.value      = withSpring(1.0,  { damping: 18, stiffness: 360 });

    // Progress bar drains linearly
    progress.value = 1;
    progress.value = withTiming(0, { duration: VISIBLE_MS - 150, easing: Easing.linear });

    timerRef.current = setTimeout(slideOut, VISIBLE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [banner?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const containerAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity:   opacity.value,
  }));

  const progressAnim = useAnimatedStyle(() => ({
    width: bannerWidth * progress.value,
  }));

  if (!banner) return null;

  const meta  = TYPE_META[banner.type] ?? TYPE_META.system;

  const handlePress = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    dismissBanner();
    // Use the notification's own actionUrl (e.g. "/orders", "/wallet") when
    // present. Fall back to the notifications list — there is no per-notification
    // detail screen, so the old /notifications/${id} pattern was a dead route.
    const dest = (banner.actionUrl ?? "/notifications") as Parameters<typeof router.push>[0];
    router.push(dest);
  };

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    slideOut();
  };

  return (
    <Animated.View
      style={[styles.container, { top: insets.top + 8, pointerEvents: "box-none" }, containerAnim]}
    >

      <Pressable
        onLayout={(e) => setBannerWidth(e.nativeEvent.layout.width)}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.card,
          pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] },
        ]}>

        {/* Accent strip */}
        <View style={[styles.accentStrip, { backgroundColor: meta.color }]} />

        {/* Icon */}
        <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>

        {/* Text content */}
        <View style={styles.textCol}>
          <UIText style={[styles.bannerLabel, { color: meta.color }]}>{t(meta.labelKey)}</UIText>
          <UIText style={styles.bannerTitle} numberOfLines={1}>{banner.title}</UIText>
          <UIText style={styles.bannerBody}  numberOfLines={1}>{banner.body}</UIText>
        </View>

        {/* Dismiss button */}
        <Pressable onPress={handleDismiss} hitSlop={14} style={styles.closeBtn}>
          <Ionicons name="close" size={12} color={kit.color.inkFaint} />
        </Pressable>

        {/* Progress bar (drains left to right) */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { backgroundColor: meta.color }, progressAnim]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left:     12,
    right:    12,
    zIndex:   1000,
  },
  card: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    gap:               10,
    backgroundColor:   kit.color.surface,
    borderRadius:      20,
    paddingVertical:   13,
    paddingHorizontal: 14,
    paddingEnd:        12,
    overflow:          "hidden",
    ...kit.shadow.floating,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       kit.color.line,
  },
  accentStrip: {
    position:                   "absolute",
    right:                      0,
    top:                        0,
    bottom:                     0,
    width:                      4,
    borderTopRightRadius:       20,
    borderBottomRightRadius:    20,
  },
  iconCircle: {
    width:           40,
    height:          40,
    borderRadius:    13,
    alignItems:      "center",
    justifyContent:  "center",
  },
  textCol:     { flex: 1, gap: 1.5, marginEnd: 4 },
  bannerLabel: { fontSize: 9, fontFamily: theme.fonts.extrabold, letterSpacing: 0.8, textAlign: textAlignStart(isRtl()) },
  bannerTitle: { fontSize: theme.fontSize.md, fontFamily: theme.fonts.black, color: kit.color.ink, textAlign: textAlignStart(isRtl()) },
  bannerBody:  { fontSize: theme.fontSize.sm, fontFamily: theme.fonts.regular, color: kit.color.inkSoft, textAlign: textAlignStart(isRtl()) },
  closeBtn: {
    width:           26,
    height:          26,
    borderRadius:    8,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     kit.color.line,
  },
  progressTrack: {
    position:        "absolute",
    bottom:          0,
    left:            0,
    right:           0,
    height:          2.5,
    backgroundColor: kit.color.line,
  },
  progressFill: {
    height:       2.5,
    borderRadius: 99,
    opacity:      0.6,
  },
});
