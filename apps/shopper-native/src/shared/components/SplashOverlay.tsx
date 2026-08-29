/**

 * SplashOverlay — premium, deterministic branded launch.

 *

 * Pipeline:

 *   native splash  ─▶  BRAND reveal  ─▶  VIDEO (brand story)  ─▶  exit  ─▶  app

 *

 *   • Native → JS handoff is seamless: the JS layer paints the SAME white field

 *     with the brand mark already centred and fully opaque — no opacity flash.

 *   • BRAND reveal: four concentric rings + logo tile + wordmark choreograph in

 *     with spring physics — a premium "wake up", not a static spinner.

 *   • VIDEO plays from frame 0, so the user always sees the clip from the start.

 *   • Exit cross-fades the overlay to reveal the app beneath.

 *

 * z-order: the <Video> is rendered FIRST and covered by an opaque white "hold".

 * On Android the video's SurfaceView composites independently of the React tree,

 * so a parent opacity cannot hide it — we fade the hold OUT to reveal the

 * already-running clip, never a black/white flicker.

 *

 * Accessibility: decorative visuals hidden from screen readers; only Skip

 * is exposed. All entrance motion respects OS Reduce Motion.

 *

 * LinearGradient note: this component is the ONLY permitted LinearGradient user

 * in the codebase (see design-system policy). Gradients are used only on the

 * video scrim overlay — not on the white brand hold.

 */



import React, { useCallback, useEffect, useRef } from "react";

import { I18nManager, StyleSheet, View, type LayoutChangeEvent } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { LinearGradient } from "expo-linear-gradient";

import { setStatusBarHidden } from "expo-status-bar";

import * as SplashScreen from "expo-splash-screen";

import { useVideoPlayer, VideoView } from "expo-video";

import { Ionicons } from "@expo/vector-icons";

import Animated, {

  cancelAnimation,

  Easing,

  useAnimatedStyle,

  useReducedMotion,

  useSharedValue,

  withDelay,

  withRepeat,

  withSequence,

  withSpring,

  withTiming,

} from "react-native-reanimated";

import { Text as UIText } from "@pharmacy/ui-native";

import { useTranslation } from "react-i18next";

import { AppLogo } from "@/shared/components/AppLogo";

import { PressableScale } from "@/shared/motion";

import { theme } from "@pharmacy/design-tokens";

import { useSplashSequence } from "./useSplashSequence";

import { notifySplashExited } from "@/shared/splashBridge";



// ─── Timeline (ms) ─────────────────────────────────────────────────────────────

// Was 1_500 — the forced brand-hold before the video could even start read
// as a launch delay ("splash doesn't appear immediately"). 900ms still lets
// the ring/logo entrance mostly settle (logoOpacity 320ms, ringsOpacity
// completes ~540ms in) before handing off to video.
const MIN_BRAND_MS      = 900;

const LOAD_TIMEOUT_MS   = 3_000;

const VIDEO_DURATION_MS = 3_300;

const SAFETY_EXTRA_MS   = 700;

const EXIT_MS           = 380;

const HOLD_FADE_MS      = 300;

const SKIP_FADE_IN_MS   = 280;



// ─── Session guard ─────────────────────────────────────────────────────────────

let alreadyShown = false;



const IS_RTL = I18nManager.isRTL;



// ─────────────────────────────────────────────────────────────────────────────



export function SplashOverlay(): React.ReactElement | null {

  const [visible, setVisible] = React.useState(!alreadyShown);



  useEffect(() => {

    if (visible) alreadyShown = true;

  }, [visible]);



  if (!visible) return null;

  return <SplashSequenceView onExited={() => { notifySplashExited(); setVisible(false); }} />;

}



// ─────────────────────────────────────────────────────────────────────────────



function SplashSequenceView({ onExited }: { onExited: () => void }): React.ReactElement {

  const { t }   = useTranslation();

  const reduced = useReducedMotion();



  const seq = useSplashSequence({

    minBrandMs:      MIN_BRAND_MS,

    loadTimeoutMs:   LOAD_TIMEOUT_MS,

    videoDurationMs: VIDEO_DURATION_MS,

    safetyExtraMs:   SAFETY_EXTRA_MS,

    exitMs:          EXIT_MS,

    onExited,

  });



  const seqRef = useRef(seq);
  seqRef.current = seq;

  // ── Animated values ──────────────────────────────────────────────────────────

  const overlayOpacity  = useSharedValue(1);

  const holdOpacity     = useSharedValue(1);

  const skipOpacity     = useSharedValue(0);



  const logoScale    = useSharedValue(reduced ? 1 : 0.94);

  const logoOpacity  = useSharedValue(0);

  const ringsScale   = useSharedValue(reduced ? 1 : 0.86);

  const ringsOpacity = useSharedValue(0);

  const wordOpacity  = useSharedValue(0);

  const wordShift    = useSharedValue(reduced ? 0 : 10);



  // Radar-style pulse ring — a distinct value from ringsScale/ringsOpacity so
  // it can loop indefinitely on the UI thread without fighting the one-shot
  // entrance spring above. Off entirely under reduced motion.
  const pulseScale   = useSharedValue(1);

  const pulseOpacity = useSharedValue(0);



  const overlayAnim = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const holdAnim    = useAnimatedStyle(() => ({ opacity: holdOpacity.value }));

  const skipAnim    = useAnimatedStyle(() => ({ opacity: skipOpacity.value }));

  const logoAnim    = useAnimatedStyle(() => ({

    opacity:   logoOpacity.value,

    transform: [{ scale: logoScale.value }],

  }));

  const ringsAnim = useAnimatedStyle(() => ({

    opacity:   ringsOpacity.value,

    transform: [{ scale: ringsScale.value }],

  }));

  const pulseAnim = useAnimatedStyle(() => ({

    opacity:   pulseOpacity.value,

    transform: [{ scale: pulseScale.value }],

  }));

  const wordAnim = useAnimatedStyle(() => ({

    opacity:   wordOpacity.value,

    transform: [{ translateY: wordShift.value }],

  }));



  // ── Native-splash handoff + brand entrance ───────────────────────────────────

  const startedRef = useRef(false);

  const start = useCallback(() => {

    if (startedRef.current) return;

    startedRef.current = true;

    SplashScreen.hideAsync().catch(() => {});



    if (reduced) {

      logoOpacity.value  = withTiming(1, { duration: 1 });

      ringsOpacity.value = withTiming(1, { duration: 220 });

      wordOpacity.value  = withDelay(120, withTiming(1, { duration: 220 }));

    } else {

      logoOpacity.value  = withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) });

      logoScale.value    = withSpring(1, { damping: 18, stiffness: 140, mass: 1 });

      ringsOpacity.value = withDelay(80,  withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));

      ringsScale.value   = withDelay(80,  withSpring(1, { damping: 20, stiffness: 110, mass: 1.4 }));

      wordOpacity.value  = withDelay(320, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));

      wordShift.value    = withDelay(320, withSpring(0, theme.animation.spring.gentle));



      // Radar pulse — starts once the rings have mostly settled (~700ms in)
      // and loops until the phase-transition effect below cancels it.
      pulseScale.value   = withDelay(700, withRepeat(
        withSequence(withTiming(1, { duration: 0 }), withTiming(1.34, { duration: 1_700, easing: Easing.out(Easing.ease) })),
        -1, false,
      ));

      pulseOpacity.value = withDelay(700, withRepeat(
        withSequence(withTiming(0.30, { duration: 0 }), withTiming(0, { duration: 1_700, easing: Easing.out(Easing.ease) })),
        -1, false,
      ));

    }



    seqRef.current.begin();

  }, [reduced, logoOpacity, logoScale, ringsOpacity, ringsScale, wordOpacity, wordShift, pulseScale, pulseOpacity]);



  const handleLayout = (_e: LayoutChangeEvent) => start();



  // ── Status bar + fallback start ──────────────────────────────────────────────

  useEffect(() => {

    setStatusBarHidden(true, "fade");

    const fallback = setTimeout(start, 250);

    return () => {

      clearTimeout(fallback);

      setStatusBarHidden(false, "fade");

    };

      
  }, [start]);



  // ── Phase transitions ────────────────────────────────────────────────────────

  useEffect(() => {

    if (seq.phase === "video") {

      cancelAnimation(pulseScale);

      cancelAnimation(pulseOpacity);

      holdOpacity.value = withTiming(0, { duration: HOLD_FADE_MS, easing: Easing.in(Easing.ease) });

      skipOpacity.value = withTiming(1, { duration: SKIP_FADE_IN_MS, easing: Easing.out(Easing.ease) });

    } else if (seq.phase === "exiting") {

      cancelAnimation(pulseScale);

      cancelAnimation(pulseOpacity);

      skipOpacity.value    = withTiming(0, { duration: 160 });

      overlayOpacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.out(Easing.cubic) });

    }


  }, [seq.phase, holdOpacity, overlayOpacity, skipOpacity, pulseScale, pulseOpacity]);



  // ── Video player (expo-video — expo-av is deprecated on this SDK and its

  // require()'d-asset embedding into the native build is unreliable) ──────────

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const player = useVideoPlayer(require("../../../assets/splash-video.mp4"), (p) => {

    p.loop  = false;

    p.muted = true;

  });



  // Plays only once the state machine enters the "video" phase — never on

  // mount — and always seeks to frame 0 first (see notifyVideoLoaded doc).

  useEffect(() => {

    if (!seq.videoShouldPlay) return;

    player.currentTime = 0;

    player.play();

  }, [seq.videoShouldPlay, player]);



  useEffect(() => {

    const statusSub = player.addListener("statusChange", ({ status }) => {

      if (status === "readyToPlay") seq.notifyVideoLoaded();

      if (status === "error") seq.notifyVideoError();

    });

    const endSub = player.addListener("playToEnd", () => seq.notifyVideoFinished());

    return () => {

      statusSub.remove();

      endSub.remove();

    };

  }, [player, seq, seq.notifyVideoLoaded, seq.notifyVideoError, seq.notifyVideoFinished]);



  return (

    <Animated.View style={[styles.root, overlayAnim]} onLayout={handleLayout} accessibilityViewIsModal>



      {/* Video — under the hold; plays from frame 0 once the machine allows. */}

      <VideoView

        player={player}

        style={styles.video}

        contentFit="cover"

        nativeControls={false}

        allowsPictureInPicture={false}

      />



      {/* Top gradient scrim — over the video, ensures the skip pill is always legible.

          LinearGradient is allowed here (SplashOverlay is the sole permitted user). */}

      {seq.phase === "video" && (

        <LinearGradient

          colors={["rgba(0,0,0,0.38)", "transparent"]}

          style={styles.scrimTop}

          pointerEvents="none"

        />

      )}



      {/* White brand hold — covers the video until the video phase. Decorative. */}

      <Animated.View

        style={[styles.hold, holdAnim]}

        pointerEvents="none"

        importantForAccessibility="no-hide-descendants"

        accessibilityElementsHidden>

        <View style={styles.holdBrand}>



          {/* Four concentric rings — outermost first so inner rings render on top */}

          <Animated.View style={[styles.ring4,     ringsAnim]} />

          {/* Radar pulse — radiates outward from the ring band on a loop, a
              "still alive" cue while the video decodes. Purely decorative. */}
          <Animated.View style={[styles.ringPulse, pulseAnim]} pointerEvents="none" />

          <Animated.View style={[styles.ringOuter, ringsAnim]} />

          <Animated.View style={[styles.ringInner, ringsAnim]} />

          <Animated.View style={[styles.ringCore,  ringsAnim]} />



          {/* Mark */}

          <Animated.View style={[styles.logoTile, logoAnim]}>

            <AppLogo size="lg" />

          </Animated.View>



          {/* Wordmark */}

          <Animated.View style={[styles.wordmark, wordAnim]}>

            <UIText weight="black" style={styles.brandName}>

              {t("splash.brandName", "صيدلية المتحدة")}

            </UIText>

            <UIText weight="semibold" style={styles.brandNameEn}>

              United Pharmacy

            </UIText>

            <View style={styles.brandSep}>

              <View style={styles.brandLine} />

              <View style={styles.brandDot} />

              <View style={styles.brandLine} />

            </View>

            <UIText variant="caption" style={styles.brandSub}>

              {t("splash.tagline")}

            </UIText>

          </Animated.View>



        </View>

      </Animated.View>



      {/* Skip — appears with the video; positioned at the trailing reading edge. */}

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

              style={styles.skipBtn}>

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



// ─── Styles ───────────────────────────────────────────────────────────────────



const styles = StyleSheet.create({

  root: {

    ...StyleSheet.absoluteFillObject,

    zIndex:          9999,

    backgroundColor: "#ffffff",

  },

  video: { ...StyleSheet.absoluteFillObject },



  // Top scrim — cinematic gradient to ensure skip legibility over video

  scrimTop: {

    position: "absolute",

    top:      0,

    start: 0,

    end: 0,

    height:   140,

    zIndex:   40,

  },



  // ── Brand hold ───────────────────────────────────────────────────────────────

  hold: {

    ...StyleSheet.absoluteFillObject,

    backgroundColor: "#ffffff",

  },

  holdBrand: {

    flex:           1,

    alignItems:     "center",

    justifyContent: "center",

    gap:            24,

  },



  // ── Rings — four concentric, outermost to innermost ───────────────────────────

  ring4: {

    position:     "absolute",

    width:        296,

    height:       296,

    borderRadius: 148,

    borderWidth:  1,

    borderColor:  "rgba(14,126,116,0.06)",

  },

  ringOuter: {

    position:     "absolute",

    width:        228,

    height:       228,

    borderRadius: 114,

    borderWidth:  1.5,

    borderColor:  "rgba(14,126,116,0.11)",

  },

  ringPulse: {

    position:     "absolute",

    width:        228,

    height:       228,

    borderRadius: 114,

    borderWidth:  1.5,

    borderColor:  "rgba(14,126,116,0.55)",

  },

  ringInner: {

    position:     "absolute",

    width:        166,

    height:       166,

    borderRadius: 83,

    borderWidth:  1.5,

    borderColor:  "rgba(14,126,116,0.20)",

  },

  ringCore: {

    position:     "absolute",

    width:        120,

    height:       120,

    borderRadius: 60,

    borderWidth:  1,

    borderColor:  "rgba(14,126,116,0.30)",

  },



  // ── Logo tile — brand-tinted glow ─────────────────────────────────────────────

  logoTile: {

    width:           112,

    height:          112,

    borderRadius:    38,

    overflow:        "hidden",

    alignItems:      "center",

    justifyContent:  "center",

    backgroundColor: "#FFFFFF",

    borderWidth:     1.5,

    borderColor:     "rgba(14,126,116,0.16)",

    shadowColor:     "#0E7E74",

    shadowOffset:    { width: 0, height: 10 },

    shadowOpacity:   0.30,

    shadowRadius:    24,

    elevation:       16,

    boxShadow:       "0px 10px 24px rgba(14,126,116,0.30)",

  },



  // ── Wordmark ──────────────────────────────────────────────────────────────────

  wordmark: {

    alignItems: "center",

    gap:        4,

  },

  brandName: {

    fontSize:           26,

    color:              "#07122a",

    letterSpacing:      -0.8,

    includeFontPadding: false,

    lineHeight:         32,

    textAlign:          "center",

  },

  brandNameEn: {

    fontSize:           13,

    color:              "rgba(7,18,42,0.50)",

    letterSpacing:      0.4,

    includeFontPadding: false,

    lineHeight:         18,

    textAlign:          "center",

  },

  // Refined separator: two short lines flanking the dot

  brandSep: {

    flexDirection: "row",

    alignItems:    "center",

    gap:           6,

  },

  brandLine: {

    width:           18,

    height:          1,

    backgroundColor: "rgba(14,126,116,0.24)",

    borderRadius:    1,

  },

  brandDot: {

    width:           5,

    height:          5,

    borderRadius:    2.5,

    backgroundColor: "rgba(14,126,116,0.65)",

  },

  brandSub: {

    color:              "rgba(14,126,116,0.78)",

    includeFontPadding: false,

    lineHeight:         16,

    textAlign:          "center",

    letterSpacing:      0.4,

  },



  // ── Skip pill ─────────────────────────────────────────────────────────────────

  skipSafe: {

    position: "absolute",

    top:      0,

    start: 0,

    end: 0,

    zIndex:   50,

  },

  skipRow: {

    flexDirection:     "row",

    paddingHorizontal: 16,

    paddingTop:        10,

  },

  skipStart: { justifyContent: "flex-start" },

  skipEnd:   { justifyContent: "flex-end"   },



  skipBtn: {

    backgroundColor: "rgba(6, 10, 18, 0.58)",

    borderRadius:    26,

    borderWidth:     1,

    borderColor:     "rgba(255, 255, 255, 0.20)",

    alignSelf:       "flex-start",

    flexShrink:      0,

    // Deep shadow for legibility over video

    shadowColor:     "#000",

    shadowOffset:    { width: 0, height: 6 },

    shadowOpacity:   0.24,

    shadowRadius:    16,

    elevation:       5,

  },

  skipInner: {

    flexDirection:     "row",

    alignItems:        "center",

    gap:               7,

    paddingHorizontal: 18,

    paddingVertical:   10,

    minHeight:         44,

  },

  skipText: {

    fontSize:   13,

    lineHeight: 22,

    color:      "#ffffff",

    flexShrink: 0,

  },

});

