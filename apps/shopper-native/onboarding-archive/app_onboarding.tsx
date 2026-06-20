/**
 * Onboarding — 2026 VIP rebuild on the @/shared/kit design language.
 * Architecture preserved: tinted STAGE + white SHEET PANEL per page, fixed chrome.
 *
 * 2026 creative refresh:
 *  • Staggered spring entrances for stage elements
 *  • Ambient rotating ring for a living backdrop
 *  • Final FAB expands with a pulsing halo ring
 *  • Elevated typographic scale & refined shadow hierarchy
 */

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  type ListRenderItemInfo,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewToken,
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
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { ONBOARDING_KEY } from "@/lib/onboardingKey";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { PressableScale } from "@/shared/motion";
import { kit } from "@/shared/kit";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface Slide {
  id: number;
  titleKey: string;
  bodyKey: string;
  metricValue: string;
  metricLabelKey: string;
  icon: IoniconsName;
  satIcon: IoniconsName;
  satIcon2: IoniconsName;
  tone: string;
  tint: string;
}

const SLIDES: Slide[] = [
  {
    id: 1,
    titleKey: "onboarding.slide1Title",
    bodyKey: "onboarding.slide1Body",
    metricValue: "52k+",
    metricLabelKey: "onboarding.metricProducts",
    icon: "medkit",
    satIcon: "sparkles",
    satIcon2: "bag-handle-outline",
    tone: "#0E7E74",
    tint: "#E2F1EE",
  },
  {
    id: 2,
    titleKey: "onboarding.slide2Title",
    bodyKey: "onboarding.slide2Body",
    metricValue: "30–60",
    metricLabelKey: "onboarding.metricDelivery",
    icon: "flash",
    satIcon: "time",
    satIcon2: "navigate-outline",
    tone: "#2358D6",
    tint: "#E9EFFC",
  },
  {
    id: 3,
    titleKey: "onboarding.slide3Title",
    bodyKey: "onboarding.slide3Body",
    metricValue: "100%",
    metricLabelKey: "onboarding.metricQuality",
    icon: "shield-checkmark",
    satIcon: "ribbon",
    satIcon2: "checkmark-done-outline",
    tone: "#15803D",
    tint: "#E7F3EA",
  },
];

const SLIDE_COUNT = SLIDES.length;
const LAST_INDEX = SLIDE_COUNT - 1;

// ── Ambient rotating ring (always active) ────────────────────────────────
const AmbientRing = memo(function AmbientRing({
  reduced,
  tone,
}: {
  reduced: boolean;
  tone: string;
}) {
  const rotate = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    rotate.value = withRepeat(
      withTiming(360, { duration: 20000, easing: Easing.linear }),
      -1,
      false
    );
  }, [reduced, rotate]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        page.ambientRing,
        { borderColor: tone + "30" },
        ringStyle,
      ]}
    />
  );
});

// ── Individual slide page ───────────────────────────────────────────────
const SlidePage = memo(function SlidePage({
  slide,
  index,
  width,
  reduced,
  isActive,
  topPad,
  bottomPad,
}: {
  slide: Slide;
  index: number;
  width: number;
  reduced: boolean;
  isActive: boolean;
  topPad: number;
  bottomPad: number;
}) {
  const { t } = useTranslation();
  const appear = useSharedValue(reduced || isActive ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      appear.value = 1;
      return;
    }
    appear.value = isActive
      ? withSpring(1, { damping: 16, stiffness: 130, mass: 0.9 })
      : withTiming(0.85, { duration: 240 });
  }, [isActive, reduced, appear]);

  const tileAnim = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-4 + appear.value * 4}deg` },
      { scale: 0.88 + appear.value * 0.12 },
      { translateY: (1 - appear.value) * 18 },
    ],
    opacity: appear.value,
  }));

  const sat1Anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - appear.value) * 30 },
      { translateY: (1 - appear.value) * -20 },
      { scale: appear.value },
    ],
    opacity: appear.value,
  }));

  const sat2Anim = useAnimatedStyle(() => ({
    transform: [
      { translateX: (1 - appear.value) * -24 },
      { translateY: (1 - appear.value) * 24 },
      { scale: appear.value },
    ],
    opacity: appear.value,
  }));

  const statAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - appear.value) * 20 }],
    opacity: appear.value,
  }));

  return (
    <View style={[page.root, { width, paddingTop: topPad }]}>
      <View style={page.stage}>
        <View style={[page.stageWash, { backgroundColor: slide.tint }]} />
        <View style={page.stageGlow} />
        <AmbientRing reduced={reduced} tone={slide.tone} />
        <Animated.View
          style={[
            page.tile,
            { backgroundColor: slide.tone, borderColor: "rgba(255,255,255,0.22)" },
            tileAnim,
          ]}
        >
          <Ionicons name={slide.icon} size={64} color="#ffffff" />
        </Animated.View>
        <Animated.View style={[page.satellite, sat1Anim]}>
          <Ionicons name={slide.satIcon} size={22} color={slide.tone} />
        </Animated.View>
        <Animated.View style={[page.satellite2, sat2Anim]}>
          <Ionicons name={slide.satIcon2} size={18} color={slide.tone} />
        </Animated.View>
        <Animated.View
          style={[
            page.statChip,
            { flexDirection: flexRow(IS_RTL) },
            statAnim,
          ]}
        >
          <UIText
            style={[page.statValue, { writingDirection: "ltr" }]}
          >
            {slide.metricValue}
          </UIText>
          <UIText style={page.statLabel}>
            {t(slide.metricLabelKey)}
          </UIText>
        </Animated.View>
      </View>

      <View style={[page.panel, { paddingBottom: bottomPad }]}>
        <View style={[page.stepRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[page.stepDot, { backgroundColor: slide.tone }]} />
          <UIText style={page.step} accessibilityElementsHidden>
            {`0${slide.id} — 0${SLIDE_COUNT}`}
          </UIText>
        </View>
        <UIText style={page.title}>{t(slide.titleKey)}</UIText>
        <UIText style={page.body}>{t(slide.bodyKey)}</UIText>
      </View>
    </View>
  );
});

// ── Segment bar dot ──────────────────────────────────────────────────────
const Segment = memo(function Segment({
  active,
  reduced,
}: {
  active: boolean;
  reduced: boolean;
}) {
  const w = useSharedValue(active ? 32 : 12);
  useEffect(() => {
    w.value = reduced
      ? active
        ? 32
        : 12
      : withSpring(active ? 32 : 12, { damping: 18, stiffness: 220 });
  }, [active, reduced, w]);

  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Animated.View
      style={[
        chrome.segment,
        {
          backgroundColor: active ? kit.color.ink : kit.color.lineStrong,
        },
        style,
      ]}
    />
  );
});

// ── Main Onboarding Screen ───────────────────────────────────────────────
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const listRef = useRef<FlatList<Slide>>(null);

  const [index, setIndex] = useState(0);
  const finishingRef = useRef(false);
  const prevIndexRef = useRef(0);

  const compact = height < 720;
  const topPad = insets.top + 64;
  const bottomPad = Math.max(insets.bottom, 12) + 104;

  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewRef = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const rawI = viewableItems[0]?.index;
      if (rawI == null) return;
      setIndex(rawI);
      if (rawI !== prevIndexRef.current) {
        prevIndexRef.current = rawI;
        if (Platform.OS !== "web")
          Haptics.selectionAsync().catch(() => {});
      }
    }
  ).current;

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    router.replace("/(tabs)");
  }, [router]);

  const goTo = useCallback(
    (i: number) => {
      if (i < 0 || i >= SLIDE_COUNT) return;
      if (Platform.OS !== "web")
        Haptics.selectionAsync().catch(() => {});
      listRef.current?.scrollToOffset({
        offset: i * width,
        animated: true,
      });
    },
    [width]
  );

  const goNext = useCallback(() => {
    if (index < LAST_INDEX) goTo(index + 1);
    else void finish();
  }, [index, goTo, finish]);

  const renderItem = useCallback(
    ({ item, index: i }: ListRenderItemInfo<Slide>) => (
      <SlidePage
        slide={item}
        index={i}
        width={width}
        reduced={reduced}
        isActive={i === index}
        topPad={topPad}
        bottomPad={bottomPad}
      />
    ),
    [width, reduced, index, topPad, bottomPad]
  );

  const getItemLayout = useCallback(
    (_: unknown, i: number) => ({
      length: width,
      offset: width * i,
      index: i,
    }),
    [width]
  );

  const isLast = index === LAST_INDEX;

  const pulse = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  useEffect(() => {
    if (isLast && !reduced) {
      pulse.value = withRepeat(withSpring(1.3), -1, true);
      pulseOpacity.value = withRepeat(withTiming(0, { duration: 800 }), -1, true);
    } else {
      pulse.value = withTiming(1);
      pulseOpacity.value = withTiming(0.3);
    }
  }, [isLast, reduced, pulse, pulseOpacity]);

  const fabRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulseOpacity.value,
    borderColor: kit.color.inkFaint,
    borderWidth: 2,
  }));

  return (
    <View style={chrome.root}>
      <StatusBar style="dark" />

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => String(s.id)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onViewableItemsChanged={onViewRef}
        viewabilityConfig={viewConfig}
        initialScrollIndex={0}
        windowSize={SLIDE_COUNT}
        initialNumToRender={SLIDE_COUNT}
        maxToRenderPerBatch={SLIDE_COUNT}
      />

      <Animated.View
        entering={reduced ? undefined : FadeInDown.duration(380).delay(60)}
        style={[
          chrome.topRow,
          {
            top: insets.top + 10,
            flexDirection: flexRow(IS_RTL),
          },
        ]}
      >
        <View style={[chrome.brand, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={chrome.brandMark}>
            <AppLogo size="sm" />
          </View>
          <UIText style={chrome.brandName}>United Pharmacy</UIText>
        </View>

        <PressableScale
          onPress={() => void finish()}
          scaleTo={0.94}
          accessibilityRole="button"
          accessibilityLabel={t("onboarding.skipLabel")}
          style={chrome.skipChip}
        >
          <View
            style={[
              chrome.skipChipInner,
              { flexDirection: flexRow(IS_RTL) },
            ]}
          >
            <UIText style={chrome.skipChipText} numberOfLines={1}>
              {t("onboarding.skip")}
            </UIText>
            <Ionicons name="close" size={13} color={kit.color.inkFaint} />
          </View>
        </PressableScale>
      </Animated.View>

      <Animated.View
        entering={reduced ? undefined : FadeIn.duration(420).delay(260)}
        style={[
          chrome.controls,
          {
            bottom: Math.max(insets.bottom, 12) + 18,
            flexDirection: flexRow(IS_RTL),
          },
        ]}
      >
        <View
          style={[chrome.segments, { flexDirection: flexRow(IS_RTL) }]}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 1,
            max: SLIDE_COUNT,
            now: index + 1,
          }}
          accessibilityLabel={t("onboarding.slideProgress", {
            n: index + 1,
            total: SLIDE_COUNT,
          })}
        >
          {SLIDES.map((s, i) => (
            <Segment key={s.id} active={i === index} reduced={reduced} />
          ))}
        </View>

        <View style={chrome.fabWrapper}>
          {isLast && (
            <Animated.View style={[chrome.fabPulseRing, fabRingStyle]} />
          )}

          <PressableScale
            onPress={goNext}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={
              isLast ? t("onboarding.start") : t("onboarding.next")
            }
            style={[
              chrome.fab,
              { flexDirection: flexRow(IS_RTL) },
              isLast && chrome.fabWide,
              isLast && chrome.fabDeep,
              compact && chrome.fabCompact,
            ]}
          >
            {isLast && (
              <Animated.View
                entering={reduced ? undefined : FadeIn.duration(180)}
              >
                <UIText style={chrome.fabLabel}>
                  {t("onboarding.start")}
                </UIText>
              </Animated.View>
            )}
            <Ionicons
              name={isLast ? "checkmark" : FORWARD_CHEVRON}
              size={22}
              color={kit.color.onInk}
            />
          </PressableScale>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────
const chrome = StyleSheet.create({
  root: { flex: 1, backgroundColor: kit.color.canvas },
  topRow: {
    position: "absolute",
    start: 0,
    end: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: kit.sp(5),
  },
  brand: { alignItems: "center", gap: 10 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: kit.color.surface,
    borderWidth: 1,
    borderColor: kit.color.line,
  },
  brandName: {
    fontFamily: theme.fonts.black,
    fontSize: 13,
    lineHeight: 18,
    color: kit.color.ink,
    includeFontPadding: false,
  },
  skipChip: {
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.pill,
    borderWidth: 1,
    borderColor: kit.color.line,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...kit.shadow.raised,
  },
  skipChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  skipChipText: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    lineHeight: 20,
    color: kit.color.inkSoft,
    flexShrink: 0,
  },
  controls: {
    position: "absolute",
    start: 0,
    end: 0,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: kit.sp(6),
    minHeight: 60,
  },
  segments: { alignItems: "center", gap: 6 },
  segment: { height: 6, borderRadius: 3 },
  fabWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  fabPulseRing: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: kit.color.inkFaint,
  },
  fab: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: kit.color.ink,
    ...kit.shadow.floating,
  },
  fabWide: { paddingHorizontal: kit.sp(6) },
  fabCompact: { height: 54, minWidth: 54, borderRadius: 27 },
  fabDeep: { ...kit.shadow.deep },
  fabLabel: {
    fontFamily: theme.fonts.black,
    fontSize: 14,
    lineHeight: 20,
    color: kit.color.onInk,
    includeFontPadding: false,
  },
});

const page = StyleSheet.create({
  root: { flex: 1 },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stageWash: {
    position: "absolute",
    width: 350,
    height: 350,
    borderRadius: 175,
    opacity: 0.9,
  },
  stageGlow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  ambientRing: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderStyle: "solid",
    opacity: 0.5,
  },
  tile: {
    width: 140,
    height: 140,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    ...kit.shadow.deep,
  },
  satellite: {
    position: "absolute",
    top: "16%",
    end: "22%",
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: kit.color.surface,
    borderWidth: 1,
    borderColor: kit.color.line,
    ...kit.shadow.raised,
  },
  satellite2: {
    position: "absolute",
    bottom: "20%",
    start: "16%",
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: kit.color.surface,
    borderWidth: 1,
    borderColor: kit.color.line,
    ...kit.shadow.raised,
  },
  statChip: {
    position: "absolute",
    bottom: "10%",
    end: "12%",
    alignItems: "baseline",
    gap: 6,
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: kit.color.line,
    ...kit.shadow.raised,
  },
  statValue: {
    fontFamily: theme.fonts.black,
    fontSize: 20,
    lineHeight: 26,
    color: kit.color.ink,
    letterSpacing: -0.4,
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    lineHeight: 16,
    color: kit.color.inkSoft,
    includeFontPadding: false,
  },
  panel: {
    backgroundColor: kit.color.surface,
    borderTopStartRadius: kit.radius.sheet + 4,
    borderTopEndRadius: kit.radius.sheet + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
    paddingHorizontal: kit.sp(7),
    paddingTop: kit.sp(8),
    gap: kit.sp(3),
  },
  stepRow: { alignItems: "center", gap: 8 },
  stepDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  step: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    lineHeight: 16,
    color: kit.color.inkFaint,
    letterSpacing: 2,
    textAlign: TEXT_START,
    writingDirection: "ltr",
    includeFontPadding: false,
  },
  title: {
    fontFamily: theme.fonts.black,
    fontSize: 32,
    lineHeight: 39,
    color: kit.color.ink,
    textAlign: TEXT_START,
    letterSpacing: -0.5,
    includeFontPadding: false,
  },
  body: {
    fontFamily: theme.fonts.regular,
    fontSize: kit.type.body.fontSize,
    lineHeight: kit.type.body.lineHeight + 2,
    color: kit.color.inkSoft,
    textAlign: TEXT_START,
    includeFontPadding: false,
  },
});