import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useSegments } from "expo-router";
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
import { useAuth } from "@/features/auth";
import { markNotificationRead } from "../api";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useBannerStore } from "../banner-store";
import { theme as legacyTheme } from "@pharmacy/design-tokens";

// ─── Constants ────────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const VISIBLE_MS = 4500;

// Same semantic mapping as the full notifications list (notifications.tsx's
// TYPE_CONFIG) — this banner and that screen must agree on what each type
// means, or the same "health" notification reads as reassuring here and
// alarming there. No LinearGradient: banned outside SplashOverlay (see the
// VIP header pattern) — solid tinted wells instead, same as every other
// icon treatment in the kit system.
interface TypeMeta {
  icon:     IoniconsName;
  color:    string;
  bg:       string;
  labelKey: string;
}

function getTypeMeta(theme: NativeTheme): Record<string, TypeMeta> {
  return {
    order:  { icon: "bag-check-outline",    color: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight, labelKey: "notification.order"  },
    offer:  { icon: "pricetag-outline",     color: theme.colors.status.warning,       bg: `${theme.colors.status.warning}1A`,   labelKey: "notification.offer"  },
    health: { icon: "heart-circle-outline", color: theme.colors.status.error,    bg: `${theme.colors.status.error}1A`, labelKey: "notification.health" },
    system: { icon: "sparkles-outline",     color: theme.colors.text.secondary,   bg: theme.colors.canvas.surfaceMuted,       labelKey: "notification.system" },
  };
}

// ─── Banner ───────────────────────────────────────────────────────────────────

// The driver section ((driver) screens) renders its own header — eyebrow +
// greeting + logout button — directly under the safe area with no shared
// header component the banner can measure. Those headers run ~70-80px tall,
// which collided with this banner's old fixed `insets.top + 8` position
// (verified against DriverManifest.tsx's header, the tallest of the five
// (driver) screens). Non-driver screens don't put content flush under the
// safe area this way, so they keep the original tight offset.
const DRIVER_HEADER_CLEARANCE = 88;

export function NotificationBanner() {
  const { theme }     = useTheme();
  const styles        = useMemo(() => getStyles(theme), [theme]);
  const TYPE_META      = useMemo(() => getTypeMeta(theme), [theme]);
  const { t }         = useTranslation();
  const { user }      = useAuth();
  const router        = useRouter();
  const insets        = useSafeAreaInsets();
  // useSegments() preserves raw route-group folder names (e.g. "(driver)")
  // exactly as they appear on disk — unlike usePathname(), which normalizes
  // them out of the resolved URL. Its default typed overload infers a union
  // of every known route LEAF name app-wide, which "(driver)" (a group, not
  // a leaf) doesn't belong to, so the comparison below needs the untyped
  // array shape, not the strict per-route literal type.
  const segments      = useSegments() as readonly string[];
  const isDriverRoute = segments[0] === "(driver)";
  const isPharmacistRoute = segments[0] === "(pharmacist)";
  // Notifications is a persona-scoped screen — customer/pharmacist/driver
  // each ship their own (Expo Router route groups are invisible in the
  // resolved URL, so all three can't share the bare "/notifications" leaf
  // without colliding). Pick the fallback that matches whichever persona
  // the tap happened in, not a single hardcoded path.
  const notificationsHref = isDriverRoute
    ? "/driver-notifications"
    : isPharmacistRoute
    ? "/pharmacist-notifications"
    : "/notifications";
  const banner        = useBannerStore((s) => s.banner);
  const queuedCount   = useBannerStore((s) => s.queue.length);
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
    if (user?.id && !banner.isRead) {
      void markNotificationRead(banner.id, user.id).catch(() => {});
    }
    // Use the notification's own actionUrl (e.g. "/orders", "/wallet") when
    // present. Fall back to the notifications list — there is no per-notification
    // detail screen, so the old /notifications/${id} pattern was a dead route.
    const dest = (banner.actionUrl ?? notificationsHref) as Parameters<typeof router.push>[0];
    router.push(dest);
  };

  const handleDismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    slideOut();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + (isDriverRoute ? DRIVER_HEADER_CLEARANCE : 8), pointerEvents: "box-none" },
        containerAnim,
      ]}
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
          <View style={styles.labelRow}>
            <UIText style={[styles.bannerLabel, { color: meta.color }]}>{t(meta.labelKey)}</UIText>
            {queuedCount > 0 && (
              <View style={[styles.queuePill, { backgroundColor: meta.bg }]}>
                <UIText style={[styles.queueText, { color: meta.color }]}>+{queuedCount}</UIText>
              </View>
            )}
          </View>
          <UIText style={styles.bannerTitle} numberOfLines={1}>{banner.title}</UIText>
          <UIText style={styles.bannerBody}  numberOfLines={1}>{banner.body}</UIText>
        </View>

        {/* Dismiss button */}
        <Pressable onPress={handleDismiss} hitSlop={14} style={styles.closeBtn}>
          <Ionicons name="close" size={12} color={theme.colors.text.muted} />
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

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      start: 12,
      end: 12,
      zIndex:   1000,
    },
    card: {
      flexDirection:     flexRow(isRtl()),
      alignItems:        "center",
      gap:               10,
      backgroundColor:   theme.colors.canvas.surface,
      borderRadius:      24,
      paddingVertical:   15,
      paddingHorizontal: 16,
      paddingEnd:        12,
      overflow:          "hidden",
      ...theme.shadows[3],
      borderWidth:       1,
      borderColor:       "rgba(15, 23, 42, 0.08)",
    },
    accentStrip: {
      position:                   "absolute",
      end: 0,
      top:                        0,
      bottom:                     0,
      width:                      5,
      borderTopEndRadius:       24,
      borderBottomEndRadius:    24,
    },
    iconCircle: {
      width:           44,
      height:          44,
      borderRadius:    15,
      alignItems:      "center",
      justifyContent:  "center",
    },
    textCol:     { flex: 1, gap: 2, marginEnd: 4 },
    labelRow:    { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 6 },
    bannerLabel: { fontSize: 10, fontFamily: legacyTheme.fonts.extrabold, letterSpacing: 0.9, textAlign: textAlignStart(isRtl()) },
    queuePill:   { minWidth: 20, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    queueText:   { fontSize: 10, fontFamily: legacyTheme.fonts.black },
    bannerTitle: { fontSize: theme.typography.sizes[16], fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary, textAlign: textAlignStart(isRtl()) },
    bannerBody:  { fontSize: theme.typography.sizes[14], fontFamily: legacyTheme.fonts.regular, color: theme.colors.text.secondary, lineHeight: 20, textAlign: textAlignStart(isRtl()) },
    closeBtn: {
      width:           26,
      height:          26,
      borderRadius:    8,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      alignItems:      "center",
      justifyContent:  "center",
      borderWidth:     StyleSheet.hairlineWidth,
      borderColor:     theme.colors.border.default,
    },
    progressTrack: {
      position:        "absolute",
      bottom:          0,
      start: 0,
      end: 0,
      height:          2.5,
      backgroundColor: theme.colors.border.default,
    },
    progressFill: {
      height:       2.5,
      borderRadius: 99,
      opacity:      0.6,
    },
  });
}
