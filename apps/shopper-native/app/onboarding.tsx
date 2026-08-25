/**
 * Onboarding — 2026 premium brand launch experience.
 *
 * Architecture: horizontal FlatList pager, each page = colored stage + white panel.
 * Fixed chrome: brand bar top · segment+FAB bottom.
 *
 * Improvements over prior version:
 *  • Dual counter-rotating ambient rings for depth
 *  • Panel slides up on activation (translateY spring)
 *  • Eyebrow label per slide (colored, uppercase)
 *  • Feature pills row (2 per slide) from i18n featureX keys
 *  • includeFontPadding:false + explicit lineHeight on every text style
 *  • Slightly larger hero tile (148px) + refined satellite positions
 */

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { AppLogo } from "@/shared/components/AppLogo";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { ONBOARDING_KEY } from "@/lib/onboardingKey";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { PressableScale } from "@/shared/motion";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL    = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Slide data ───────────────────────────────────────────────────────────────

interface Slide {
  id:              number;
  eyebrowKey:      string;
  titleKey:        string;
  bodyKey:         string;
  metricValue:     string;
  metricLabelKey:  string;
  features:        [string, string];
  icon:            IoniconsName;
  satIcon:         IoniconsName;
  satIcon2:        IoniconsName;
  tone:            string;
  tint:            string;
}

const SLIDES: Slide[] = [
  {
    id:             1,
    eyebrowKey:     "onboarding.slide1Eyebrow",
    titleKey:       "onboarding.slide1Title",
    bodyKey:        "onboarding.slide1Body",
    metricValue:    "52k+",
    metricLabelKey: "onboarding.metricProducts",
    features:       ["onboarding.featureGenuine", "onboarding.featureSupport"],
    icon:           "medkit",
    satIcon:        "sparkles",
    satIcon2:       "bag-handle-outline",
    tone:           "#0E7E74",
    tint:           "#E2F1EE",
  },
  {
    id:             2,
    eyebrowKey:     "onboarding.slide2Eyebrow",
    titleKey:       "onboarding.slide2Title",
    bodyKey:        "onboarding.slide2Body",
    metricValue:    "30–60",
    metricLabelKey: "onboarding.metricDelivery",
    features:       ["onboarding.featureFastDelivery", "onboarding.featureEasyPayment"],
    icon:           "flash",
    satIcon:        "time",
    satIcon2:       "navigate-outline",
    tone:           "#2358D6",
    tint:           "#E9EFFC",
  },
  {
    id:             3,
    eyebrowKey:     "onboarding.slide3Eyebrow",
    titleKey:       "onboarding.slide3Title",
    bodyKey:        "onboarding.slide3Body",
    metricValue:    "100%",
    metricLabelKey: "onboarding.metricQuality",
    features:       ["onboarding.featureSecureOrders", "onboarding.featureEasyReorder"],
    icon:           "shield-checkmark",
    satIcon:        "ribbon",
    satIcon2:       "checkmark-done-outline",
    tone:           "#15803D",
    tint:           "#E7F3EA",
  },
];

const SLIDE_COUNT = SLIDES.length;
const LAST_INDEX  = SLIDE_COUNT - 1;

// ─── Ambient rings (two counter-rotating for visual depth) ────────────────────

const AmbientRings = memo(function AmbientRings({
  reduced,
  tone,
}: { reduced: boolean; tone: string }) {
  const { theme } = useTheme();
  const page = useMemo(() => getPageStyles(theme), [theme]);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    r1.value = withRepeat(
      withTiming(360,  { duration: 22000, easing: Easing.linear }),
      -1, false,
    );
    r2.value = withRepeat(
      withTiming(-360, { duration: 34000, easing: Easing.linear }),
      -1, false,
    );
  }, [reduced, r1, r2]);

  const s1 = useAnimatedStyle(() => ({ transform: [{ rotate: `${r1.value}deg` }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ rotate: `${r2.value}deg` }] }));

  return (
    <>
      <Animated.View style={[page.ring1, { borderColor: tone + "30" }, s1]} />
      <Animated.View style={[page.ring2, { borderColor: tone + "1A" }, s2]} />
    </>
  );
});

// ─── Feature pill ─────────────────────────────────────────────────────────────

const FeaturePill = memo(function FeaturePill({
  label,
  tone,
}: { label: string; tone: string }) {
  const { theme } = useTheme();
  const page = useMemo(() => getPageStyles(theme), [theme]);
  return (
    <View style={[
      page.featurePill,
      { borderColor: tone + "38", backgroundColor: tone + "10" },
    ]}>
      <Ionicons name="checkmark-circle" size={13} color={tone} />
      <UIText style={[page.featurePillText, { color: tone }]}>{label}</UIText>
    </View>
  );
});

// ─── Individual slide ─────────────────────────────────────────────────────────

const SlidePage = memo(function SlidePage({
  slide,
  width,
  reduced,
  isActive,
  topPad,
  bottomPad,
}: {
  slide:     Slide;
  width:     number;
  reduced:   boolean;
  isActive:  boolean;
  topPad:    number;
  bottomPad: number;
}) {
  const { theme } = useTheme();
  const page = useMemo(() => getPageStyles(theme), [theme]);
  const { t }  = useTranslation();
  const appear = useSharedValue(reduced || isActive ? 1 : 0);

  useEffect(() => {
    if (reduced) { appear.value = 1; return; }
    appear.value = isActive
      ? withSpring(1, { damping: 16, stiffness: 130, mass: 0.9 })
      : withTiming(0.85, { duration: 240 });
  }, [isActive, reduced, appear]);

  const tileAnim = useAnimatedStyle(() => ({
    transform: [
      { rotate:     `${-4 + appear.value * 4}deg` },
      { scale:      0.88 + appear.value * 0.12 },
      { translateY: (1 - appear.value) * 20 },
    ],
    opacity: appear.value,
  }));

  const sat1Anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - appear.value) * 36 },
      { translateY: (1 - appear.value) * -24 },
      { scale:      appear.value },
    ],
    opacity: appear.value,
  }));

  const sat2Anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - appear.value) * -30 },
      { translateY: (1 - appear.value) * 28 },
      { scale:      appear.value },
    ],
    opacity: appear.value,
  }));

  const statAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - appear.value) * 24 }],
    opacity:   appear.value,
  }));

  const panelAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - appear.value) * 14 }],
    opacity:   0.55 + appear.value * 0.45,
  }));

  return (
    <View style={[page.root, { width, paddingTop: topPad }]}>

      {/* ── Stage ── */}
      <View style={page.stage}>
        {/* Full-bleed tint wash */}
        <View style={[page.stageWash, { backgroundColor: slide.tint }]} />
        {/* Soft center glow */}
        <View style={page.stageGlow} />

        <AmbientRings reduced={reduced} tone={slide.tone} />

        {/* Hero tile */}
        <Animated.View
          style={[
            page.tile,
            { backgroundColor: slide.tone, borderColor: "rgba(255,255,255,0.22)" },
            tileAnim,
          ]}
        >
          <Ionicons name={slide.icon} size={68} color="#fff" />
        </Animated.View>

        {/* Satellite cards */}
        <Animated.View style={[page.sat1, sat1Anim]}>
          <Ionicons name={slide.satIcon} size={24} color={slide.tone} />
        </Animated.View>
        <Animated.View style={[page.sat2, sat2Anim]}>
          <Ionicons name={slide.satIcon2} size={19} color={slide.tone} />
        </Animated.View>

        {/* Metric chip */}
        <Animated.View
          style={[page.statChip, { flexDirection: flexRow(IS_RTL) }, statAnim]}
        >
          <UIText style={[page.statValue, { writingDirection: "ltr" }]}>
            {slide.metricValue}
          </UIText>
          <UIText style={page.statLabel}>{t(slide.metricLabelKey)}</UIText>
        </Animated.View>
      </View>

      {/* ── Content panel ── */}
      <Animated.View style={[page.panel, { paddingBottom: bottomPad }, panelAnim]}>

        {/* Step counter */}
        <View style={[page.stepRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[page.stepDot, { backgroundColor: slide.tone }]} />
          <UIText style={page.step} accessibilityElementsHidden>
            {`0${slide.id} — 0${SLIDE_COUNT}`}
          </UIText>
        </View>

        {/* Eyebrow */}
        <UIText style={[page.eyebrow, { color: slide.tone }]}>
          {t(slide.eyebrowKey)}
        </UIText>

        {/* Title */}
        <UIText style={page.title}>{t(slide.titleKey)}</UIText>

        {/* Body */}
        <UIText style={page.body}>{t(slide.bodyKey)}</UIText>

        {/* Feature pills */}
        <View style={[page.featureRow, { flexDirection: flexRow(IS_RTL) }]}>
          {slide.features.map((key) => (
            <FeaturePill key={key} label={t(key)} tone={slide.tone} />
          ))}
        </View>

      </Animated.View>
    </View>
  );
});

// ─── Segment dot ──────────────────────────────────────────────────────────────

const Segment = memo(function Segment({
  active,
  reduced,
}: { active: boolean; reduced: boolean }) {
  const { theme } = useTheme();
  const chrome = useMemo(() => getChromeStyles(theme), [theme]);
  const w = useSharedValue(active ? 32 : 10);

  useEffect(() => {
    w.value = reduced
      ? active ? 32 : 10
      : withSpring(active ? 32 : 10, { damping: 18, stiffness: 220 });
  }, [active, reduced, w]);

  const style = useAnimatedStyle(() => ({ width: w.value }));

  return (
    <Animated.View
      style={[
        chrome.segment,
        { backgroundColor: active ? theme.colors.text.primary : theme.colors.border.strong },
        style,
      ]}
    />
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const chrome = useMemo(() => getChromeStyles(theme), [theme]);
  const { t }    = useTranslation();
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced  = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);

  const [index, setIndex]   = useState(0);
  const finishingRef        = useRef(false);
  const prevIndexRef        = useRef(0);

  const compact    = height < 720;
  const topPad     = insets.top + 64;
  const bottomPad  = Math.max(insets.bottom, 12) + 104;

  // Physical slide order (left-to-right on the canvas):
  //   LTR: [slide1, slide2, slide3]   — index 0 = leftmost = first
  //   RTL: [slide3, slide2, slide1]   — index 0 = rightmost = first (Arabic reading direction)
  // The data index in `index` is ALWAYS the logical onboarding step (0..LAST_INDEX),
  // independent of physical order, so `isLast = index === LAST_INDEX` always means slide 3.
  const physicalSlides = IS_RTL ? [...SLIDES].reverse() : SLIDES;

  // Map a logical step index (0..LAST_INDEX) ↔ physical scroll offset.
  const logicalToOffset = useCallback(
    (i: number) => (IS_RTL ? (LAST_INDEX - i) * width : i * width),
    [width],
  );
  const offsetToLogical = useCallback(
    (x: number) => {
      const physical = Math.round(x / width);
      return IS_RTL ? LAST_INDEX - physical : physical;
    },
    [width],
  );

  // Mount: scroll to the logical START (slide 1). In RTL that's the rightmost
  // physical position, so the user sees slide 1 first regardless of language.
  useEffect(() => {
    const initialOffset = logicalToOffset(0);
    if (initialOffset > 0) {
      // Defer one frame so ScrollView has measured its content.
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: initialOffset, animated: false });
      });
    }
  }, [logicalToOffset]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = offsetToLogical(e.nativeEvent.contentOffset.x);
      if (next === prevIndexRef.current) return;
      if (next < 0 || next > LAST_INDEX) return;
      prevIndexRef.current = next;
      setIndex(next);
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    },
    [offsetToLogical],
  );

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/(tabs)" as never);
  }, [router]);

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= SLIDE_COUNT) return;
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      scrollRef.current?.scrollTo({ x: logicalToOffset(i), animated: true });
    },
    [logicalToOffset],
  );

  const goNext = useCallback(() => {
    if (index < LAST_INDEX) goTo(index + 1);
    else void finish();
  }, [index, goTo, finish]);

  const isLast = index === LAST_INDEX;

  // FAB pulse ring on last slide
  const pulse        = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  useEffect(() => {
    if (isLast && !reduced) {
      pulse.value        = withRepeat(withSpring(1.32), -1, true);
      pulseOpacity.value = withRepeat(withTiming(0, { duration: 900 }), -1, true);
    } else {
      pulse.value        = withTiming(1);
      pulseOpacity.value = withTiming(0.3);
    }
  }, [isLast, reduced, pulse, pulseOpacity]);

  // Pulse ring color tracks the current slide tone so the CTA reads as
  // visually anchored to the content the user just finished consuming.
  const fabRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity:   pulseOpacity.value,
  }));

  const currentTone = SLIDES[index]?.tone ?? theme.colors.brand.primary;

  return (
    <View style={chrome.root}>
      <StatusBar style="dark" />

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Force LTR child layout — we handle RTL via explicit physical reordering.
        // This avoids RN/Android's automatic horizontal-list reversal in RTL,
        // which was causing slide 3 ("Start Now") to appear first.
        style={{ direction: "ltr" }}
      >
        {physicalSlides.map((slide) => (
          <SlidePage
            key={slide.id}
            slide={slide}
            width={width}
            reduced={reduced}
            isActive={slide.id - 1 === index}
            topPad={topPad}
            bottomPad={bottomPad}
          />
        ))}
      </ScrollView>

      {/* ── Top bar: logo + skip ── */}
      <Animated.View
        entering={reduced ? undefined : FadeInDown.duration(380).delay(60)}
        style={[chrome.topRow, { top: insets.top + 10, flexDirection: flexRow(IS_RTL) }]}
      >
        <View style={[chrome.brand, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={chrome.brandMark}>
            <AppLogo size="sm" />
          </View>
          <UIText style={chrome.brandName}>{t("common.appName")}</UIText>
        </View>

        <PressableScale
          onPress={() => void finish()}
          scaleTo={0.93}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.skipLabel")}
          style={chrome.skipChip}
        >
          <View style={[chrome.skipInner, { flexDirection: flexRow(IS_RTL) }]}>
            <UIText style={chrome.skipText} numberOfLines={1}>
              {t("onboarding.skip")}
            </UIText>
            <Ionicons name="close" size={13} color={theme.colors.text.muted} />
          </View>
        </PressableScale>
      </Animated.View>

      {/* ── Bottom bar: dots + FAB ── */}
      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(420).delay(260)}
        style={[
          chrome.controls,
          { bottom: Math.max(insets.bottom, 12) + 18, flexDirection: flexRow(IS_RTL) },
        ]}
      >
        {/* Segment dots */}
        <View
          style={[chrome.segments, { flexDirection: flexRow(IS_RTL) }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: SLIDE_COUNT, now: index + 1 }}
          accessibilityLabel={t("onboarding.slideProgress", {
            n: index + 1, total: SLIDE_COUNT,
          })}
        >
          {SLIDES.map((s, i) => (
            <Segment key={s.id} active={i === index} reduced={reduced} />
          ))}
        </View>

        {/* FAB */}
        <View style={chrome.fabWrapper}>
          {isLast && (
            <Animated.View
              style={[chrome.fabPulseRing, { borderColor: currentTone }, fabRingStyle]}
              pointerEvents="none"
            />
          )}
          <PressableScale
            onPress={goNext}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={isLast ? t("onboarding.start") : t("onboarding.next")}
            style={[
              chrome.fab,
              { flexDirection: flexRow(IS_RTL), backgroundColor: currentTone },
              isLast && chrome.fabWide,
              compact && chrome.fabCompact,
            ]}
          >
            {isLast && (
              <Animated.View entering={reduced ? undefined : FadeIn.duration(180)}>
                <UIText style={chrome.fabLabel}>{t("onboarding.start")}</UIText>
              </Animated.View>
            )}
            <Ionicons
              name={isLast ? "checkmark" : FORWARD_CHEVRON}
              size={22}
              color="#fff"
            />
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function getChromeStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.colors.canvas.background },

    topRow: {
      position:          "absolute",
      start:             0,
      end:               0,
      zIndex:            20,
      alignItems:        "center",
      justifyContent:    "space-between",
      paddingHorizontal: 20,
    },
    brand:     { alignItems: "center", gap: 10 },
    brandMark: {
      width:           36,
      height:          36,
      borderRadius:    12,
      overflow:        "hidden",
      backgroundColor: theme.colors.canvas.surface,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
    },
    brandName: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           13,
      lineHeight:         18,
      color:              theme.colors.text.primary,
      includeFontPadding: false,
    },
    // Skip pill — sized like a touchable target (≥44pt) and visually quieter
    // than the brand mark so the eye reads brand → progress → CTA, not skip.
    skipChip: {
      minHeight:         36,
      backgroundColor:   theme.colors.canvas.surface,
      borderRadius:      9999,
      borderWidth:       1,
      borderColor:       theme.colors.border.default,
      paddingHorizontal: 16,
      paddingVertical:   8,
      ...theme.shadows[1],
    },
    skipInner: { alignItems: "center", justifyContent: "center", gap: 6 },
    skipText: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           12,
      lineHeight:         18,
      color:              theme.colors.text.secondary,
      includeFontPadding: false,
      flexShrink:         0,
    },

    controls: {
      position:          "absolute",
      start:             0,
      end:               0,
      zIndex:            20,
      alignItems:        "center",
      justifyContent:    "space-between",
      paddingHorizontal: 24,
      minHeight:         60,
    },
    segments: { alignItems: "center", gap: 6 },
    segment:  { height: 6, borderRadius: 3 },

    fabWrapper: { justifyContent: "center", alignItems: "center" },
    // Pulse ring borrows the current slide's tone via inline `borderColor`,
    // not a static neutral — it visually says "this is your forward action".
    fabPulseRing: {
      position:     "absolute",
      width:        72,
      height:       72,
      borderRadius: 36,
      borderWidth:  2,
    },
    fab: {
      alignItems:     "center",
      justifyContent: "center",
      gap:            10,
      minWidth:       60,
      height:         60,
      borderRadius:   30,
      paddingHorizontal: 8,
      ...theme.shadows[3],
    },
    // On the last slide the FAB widens into a labelled CTA. The label
    // ("ابدأ الآن" / "Start Now") gets generous horizontal breathing room
    // so it never crowds the checkmark glyph.
    fabWide: {
      paddingHorizontal: 28,
      minWidth:          180,
    },
    fabCompact: { height: 54, minWidth: 54, borderRadius: 27 },
    fabLabel: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           14,
      lineHeight:         20,
      color:              "#fff",
      includeFontPadding: false,
    },
  });
}

function getPageStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root:  { flex: 1 },
    stage: { flex: 1, alignItems: "center", justifyContent: "center" },

    stageWash: {
      position: "absolute",
      top:      0,
      start: 0,
      end: 0,
      bottom:   0,
      opacity:  0.88,
    },
    stageGlow: {
      position:        "absolute",
      width:           200,
      height:          200,
      borderRadius:    100,
      backgroundColor: "rgba(255,255,255,0.36)",
    },

    ring1: {
      position:     "absolute",
      width:        290,
      height:       290,
      borderRadius: 145,
      borderWidth:  1.5,
      borderStyle:  "dashed",
      opacity:      0.65,
    },
    ring2: {
      position:     "absolute",
      width:        210,
      height:       210,
      borderRadius: 105,
      borderWidth:  1,
      borderStyle:  "solid",
      opacity:      0.45,
    },

    tile: {
      width:          148,
      height:         148,
      borderRadius:   46,
      alignItems:     "center",
      justifyContent: "center",
      borderWidth:    1.5,
      ...theme.shadows[4],
    },

    sat1: {
      position:        "absolute",
      top:             "14%",
      end:             "16%",
      width:           58,
      height:          58,
      borderRadius:    20,
      alignItems:      "center",
      justifyContent:  "center",
      backgroundColor: theme.colors.canvas.surface,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      ...theme.shadows[1],
    },
    sat2: {
      position:        "absolute",
      bottom:          "20%",
      start:           "13%",
      width:           46,
      height:          46,
      borderRadius:    14,
      alignItems:      "center",
      justifyContent:  "center",
      backgroundColor: theme.colors.canvas.surface,
      borderWidth:     1,
      borderColor:     theme.colors.border.default,
      ...theme.shadows[1],
    },

    statChip: {
      position:          "absolute",
      bottom:            "8%",
      end:               "10%",
      alignItems:        "baseline",
      gap:               5,
      backgroundColor:   theme.colors.canvas.surface,
      borderRadius:      9999,
      paddingHorizontal: 18,
      paddingVertical:   10,
      borderWidth:       1,
      borderColor:       theme.colors.border.default,
      ...theme.shadows[1],
    },
    statValue: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           22,
      lineHeight:         28,
      color:              theme.colors.text.primary,
      letterSpacing:      -0.5,
      includeFontPadding: false,
    },
    statLabel: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           11,
      lineHeight:         16,
      color:              theme.colors.text.secondary,
      includeFontPadding: false,
    },

    panel: {
      backgroundColor:     theme.colors.canvas.surface,
      borderTopStartRadius: 20 + 6,
      borderTopEndRadius:   20 + 6,
      borderTopWidth:      StyleSheet.hairlineWidth,
      borderTopColor:      theme.colors.border.default,
      paddingHorizontal:   28,
      paddingTop:          28,
      gap:                 8,
    },

    stepRow: { alignItems: "center", gap: 8 },
    stepDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    step: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           11,
      lineHeight:         15,
      color:              theme.colors.text.muted,
      letterSpacing:      2.2,
      textAlign:          TEXT_START,
      writingDirection:   "ltr",
      includeFontPadding: false,
    },

    eyebrow: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           11,
      lineHeight:         16,
      letterSpacing:      1.4,
      textTransform:      "uppercase",
      textAlign:          TEXT_START,
      includeFontPadding: false,
      marginTop:          2,
    },

    title: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           34,
      lineHeight:         41,
      color:              theme.colors.text.primary,
      textAlign:          TEXT_START,
      letterSpacing:      -0.7,
      includeFontPadding: false,
    },

    body: {
      fontFamily:         legacyTheme.fonts.regular,
      fontSize:           15,
      lineHeight:         24,
      color:              theme.colors.text.secondary,
      textAlign:          TEXT_START,
      includeFontPadding: false,
    },

    featureRow: {
      flexWrap:  "wrap",
      gap:       8,
      marginTop: 4,
    },
    featurePill: {
      flexDirection:  "row",
      alignItems:     "center",
      gap:            6,
      paddingHorizontal: 12,
      paddingVertical:   7,
      borderRadius:   9999,
      borderWidth:    1,
    },
    featurePillText: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           12,
      lineHeight:         16,
      includeFontPadding: false,
    },
  });
}
