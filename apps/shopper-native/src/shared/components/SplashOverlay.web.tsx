/**
 * SplashOverlay.web.tsx — real web implementation.
 *
 * The native version plays the brand video through expo-video's VideoView,
 * a native view manager that doesn't exist on web. This version plays the
 * exact same clip through a plain HTML5 <video> element instead (React Native
 * Web renders straight to DOM, so creating one directly is the standard
 * escape hatch for the handful of elements RN doesn't wrap) — same brand
 * hold → video → exit pipeline, same useSplashSequence state machine, same
 * deterministic timing guarantees, same skip control.
 *
 * Browser autoplay policy requires muted + playsInline for autoplay to work
 * without a user gesture, so the clip is always silent here (it already is
 * on native too — see SplashOverlay.tsx's player.muted = true).
 */
import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { useTranslation } from "react-i18next";
import { AppLogo } from "@/shared/components/AppLogo";
import { PressableScale } from "@/shared/motion";
import { isRtl } from "@/utils/layout";
import { useSplashSequence } from "./useSplashSequence";
import { notifySplashExited } from "@/shared/splashBridge";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VIDEO_SOURCE = require("../../../assets/splash-video.mp4");
const VIDEO_URI: string = typeof VIDEO_SOURCE === "string" ? VIDEO_SOURCE : VIDEO_SOURCE?.uri ?? VIDEO_SOURCE?.default;

const MIN_BRAND_MS = 900;
const LOAD_TIMEOUT_MS = 3_000;
const VIDEO_DURATION_MS = 3_300;
const SAFETY_EXTRA_MS = 700;
const EXIT_MS = 380;

const IS_RTL = isRtl();

export function SplashOverlay(): React.ReactElement | null {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const s = useMemo(() => getStyles(theme), [theme]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const seq = useSplashSequence({
    minBrandMs: MIN_BRAND_MS,
    loadTimeoutMs: LOAD_TIMEOUT_MS,
    videoDurationMs: VIDEO_DURATION_MS,
    safetyExtraMs: SAFETY_EXTRA_MS,
    exitMs: EXIT_MS,
    onExited: notifySplashExited,
  });

  useEffect(() => {
    if (reduced) {
      notifySplashExited();
      return;
    }
    seq.begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (!seq.videoShouldPlay || !videoRef.current) return;
    const el = videoRef.current;
    el.currentTime = 0;
    // Chrome can reject an imperative play() on a silent, video-only element
    // with "paused to save power" if it hasn't yet registered the element as
    // visible/foreground at the exact moment play() is called — a scheduling
    // race, not a real playback failure. One retry on the next frame (by
    // which point layout/visibility has settled) resolves it; only treat it
    // as a genuine error if the retry also fails.
    const attempt = (isRetry: boolean) => {
      el.play().catch((e) => {
        if (!isRetry && e?.name === "AbortError") {
          requestAnimationFrame(() => attempt(true));
          return;
        }
        seq.notifyVideoError();
      });
    };
    attempt(false);
  }, [seq.videoShouldPlay, seq]);

  const holdOpacity = useSharedValue(1);
  const overlayOpacity = useSharedValue(1);
  const skipOpacity = useSharedValue(0);

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.7);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.7);

  useEffect(() => {
    if (reduced) return;
    glowOpacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    glowScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
    logoOpacity.value = withTiming(1, { duration: 320 });
    logoScale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.4)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (seq.phase === "video") {
      holdOpacity.value = withTiming(0, { duration: 300 });
      skipOpacity.value = withTiming(1, { duration: 280 });
    }
    if (seq.phase === "exiting") {
      overlayOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq.phase]);

  const overlayAnim = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const holdAnim = useAnimatedStyle(() => ({ opacity: holdOpacity.value }));
  const skipAnim = useAnimatedStyle(() => ({ opacity: skipOpacity.value }));
  const glowAnim = useAnimatedStyle(() => ({ opacity: glowOpacity.value, transform: [{ scale: glowScale.value }] }));
  const logoAnim = useAnimatedStyle(() => ({ opacity: logoOpacity.value, transform: [{ scale: logoScale.value }] }));

  if (reduced || seq.phase === "done" || !VIDEO_URI) return null;

  return (
    <Animated.View style={[styles.root, overlayAnim]} accessibilityViewIsModal>
      {React.createElement("video", {
        ref: videoRef,
        src: VIDEO_URI,
        muted: true,
        // The native attribute (not just the imperative .play() call below)
        // — browsers apply their background-video power-saving pause policy
        // more leniently to autoplay-attribute playback than to script-
        // triggered playback.
        autoPlay: true,
        playsInline: true,
        loop: false,
        onEnded: () => seq.notifyVideoFinished(),
        onCanPlay: () => seq.notifyVideoLoaded(),
        onError: () => seq.notifyVideoError(),
        style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
      })}

      <LinearGradient
        colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
        style={styles.scrimTop}
        pointerEvents="none"
      />

      {/* Brand hold — fades out once the video is confirmed playing. */}
      <Animated.View style={[styles.hold, holdAnim]} pointerEvents="none">
        <View style={s.holdBrand}>
          <Animated.View style={[s.glow, glowAnim]} />
          <Animated.View style={[s.logoTile, logoAnim, theme.shadows[3]]}>
            <AppLogo size={84} />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View style={[styles.skipSafe, skipAnim]}>
        <SafeAreaView edges={["top"]}>
          <View style={[styles.skipRow, IS_RTL ? styles.skipStart : styles.skipEnd]}>
            <PressableScale
              onPress={seq.skip}
              scaleTo={0.93}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t("splash.skipLabel")}
              accessibilityHint={t("splash.skipHint")}
              style={styles.skipBtn}
            >
              <View style={styles.skipInner}>
                <UIText weight="bold" style={styles.skipText} numberOfLines={1}>
                  {t("splash.skip")}
                </UIText>
                <Ionicons name="close" size={13} color="rgba(255,255,255,0.58)" />
              </View>
            </PressableScale>
          </View>
        </SafeAreaView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // position:"fixed" (not "absolute") is deliberate and web-only: this
  // overlay is a sibling of the real app under BottomSheetModalProvider,
  // and something in that provider's own internal layout was giving each
  // sibling a fractional share of the row's width instead of stacking them
  // as true overlays -- the splash only ever painted inside whatever slice
  // it was allocated (visually: pinned to one edge, covering roughly a
  // quarter of the screen). "fixed" positions against the real browser
  // viewport directly, immune to whatever any ancestor's flex layout does.
  // eslint-disable-next-line react-native/no-unsupported-style-property
  root: { ...StyleSheet.absoluteFillObject, position: "fixed" as "absolute", backgroundColor: "#000", zIndex: 999 },
  scrimTop: { position: "absolute", top: 0, start: 0, end: 0, height: 140, zIndex: 40 },
  hold: { ...StyleSheet.absoluteFillObject, backgroundColor: "#ffffff", zIndex: 30 },
  skipSafe: { position: "absolute", top: 0, start: 0, end: 0, zIndex: 50 },
  skipRow: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 8 },
  skipStart: { justifyContent: "flex-start" },
  skipEnd: { justifyContent: "flex-end" },
  skipBtn: { minHeight: 36, minWidth: 44, alignItems: "center", justifyContent: "center" },
  skipInner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 9999, backgroundColor: "rgba(0,0,0,0.28)" },
  skipText: { color: "rgba(255,255,255,0.92)", fontSize: 13 },
});

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    holdBrand: { flex: 1, alignItems: "center", justifyContent: "center" },
    glow: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: theme.colors.brand.primaryLight,
    },
    logoTile: {
      width: 84,
      height: 84,
      borderRadius: Math.round(84 * 0.24),
      overflow: "hidden",
    },
  });
}
