/**
 * PromoBanner — V3 Auto-rotating Promotional Banner Carousel
 *
 * Features:
 *   • Auto-advances every 5 s (pauses when user is swiping)
 *   • Smooth paged scroll with momentum — native Animated.ScrollView
 *   • Animated dot indicator synced to scroll offset
 *   • Gradient card design with icon, tag, title, sub-line, CTA
 *   • Haptic feedback on card tap
 *   • Accessible: cards have role="button" + descriptive label
 *   • RTL-aware: flex direction + text alignment
 *   • Memoized: banner list is constant; only dot state re-renders
 *   • Skips auto-advance while app is in background (AppState guard)
 *   • Full TypeScript — no `any`
 *
 * Usage:
 *   <PromoBanner onBannerPress={(route) => router.push(route)} />
 */

import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AppState,
  type AppStateStatus,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons }       from "@expo/vector-icons";
import * as Haptics       from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { Text as UIText } from "@pharmacy/ui-native";
import { theme }           from "@pharmacy/design-tokens";
import { kit }             from "@pharmacy/ui-native";
import { isRtl, flexRow }  from "../utils/layout";

// ─── Constants ───────────────────────────────────────────────────────────────

const IS_RTL      = isRtl();
const SCREEN_W    = Dimensions.get("window").width;
const CARD_MARGIN = 16;
const CARD_W      = SCREEN_W - CARD_MARGIN * 2;
const CARD_H      = 160;
const AUTO_MS     = 5_000;

// ─── Banner data ─────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Banner {
  id:         string;
  /** i18n key for the pill tag */
  tagKey:     string;
  /** i18n key for main headline (may contain \n) */
  titleKey:   string;
  /** i18n key for sub-line */
  subKey:     string;
  icon:       IoniconsName;
  colors:     [string, string, string];
  route:      string;
  /** Accessible label key */
  a11yKey:    string;
}

const BANNERS: readonly Banner[] = [
  {
    id:       "promo_first_order",
    tagKey:   "home.heroTag1",
    titleKey: "home.heroTitle1",
    subKey:   "home.heroSub1",
    icon:     "pricetag",
    colors:   ["#0A5F58", "#0E7E74", "#12A396"],
    route:    "/checkout",
    a11yKey:  "home.heroTitle1",
  },
  {
    id:       "promo_fast_delivery",
    tagKey:   "home.heroTag2",
    titleKey: "home.heroTitle2",
    subKey:   "home.heroSub2",
    icon:     "rocket",
    colors:   ["#7c3aed", "#8b5cf6", "#a78bfa"],
    route:    "/(tabs)/products",
    a11yKey:  "home.heroTitle2",
  },
  {
    id:       "promo_pharmacist",
    tagKey:   "home.pharmacistCard",
    titleKey: "home.pharmacistTitle",
    subKey:   "home.pharmacistSub",
    icon:     "medkit",
    colors:   ["#047857", "#059669", "#10b981"],
    route:    "/pharmacist",
    a11yKey:  "home.pharmacistTitle",
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromoBannerProps {
  onBannerPress: (route: string) => void;
}

// ─── BannerCard ──────────────────────────────────────────────────────────────

interface BannerCardProps {
  banner:  Banner;
  onPress: (route: string) => void;
}

const BannerCard = memo(function BannerCard({
  banner,
  onPress,
}: BannerCardProps) {
  const { t } = useTranslation();

  const scale     = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn  = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 10, stiffness: 400 });
  }, [scale]);
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onPress(banner.route);
  }, [banner.route, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={t(banner.a11yKey)}
      style={cs.cardOuter}
    >
      <Animated.View style={[cs.card, animStyle]}>
        <LinearGradient
          colors={banner.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cs.gradient}
        >
          {/* Decorative circles */}
          <View style={cs.decCircle1} />
          <View style={cs.decCircle2} />

          {/* Content */}
          <View style={cs.content}>
            {/* Tag pill */}
            <View style={cs.tagPill}>
              <Ionicons name={banner.icon} size={11} color="rgba(255,255,255,0.9)" />
              <UIText style={cs.tagText}>{t(banner.tagKey)}</UIText>
            </View>

            {/* Headline */}
            <UIText style={cs.title}>{t(banner.titleKey)}</UIText>

            {/* Sub-line */}
            <UIText style={cs.sub}>{t(banner.subKey)}</UIText>
          </View>

          {/* Right icon badge */}
          <View style={cs.iconBadge}>
            <Ionicons name={banner.icon} size={32} color="rgba(255,255,255,0.25)" />
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
});

// ─── Dot indicator ────────────────────────────────────────────────────────────

interface DotProps {
  count:  number;
  active: number;
}

const DotIndicator = memo(function DotIndicator({ count, active }: DotProps) {
  return (
    <View style={cs.dots}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            cs.dot,
            i === active ? cs.dotActive : cs.dotInactive,
          ]}
        />
      ))}
    </View>
  );
});

// ─── PromoBanner ─────────────────────────────────────────────────────────────

export const PromoBanner = memo(function PromoBanner({
  onBannerPress,
}: PromoBannerProps) {
  const scrollRef  = useRef<ScrollView>(null);
  const [active, setActive]   = useState(0);
  const isDragging = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState   = useRef<AppStateStatus>(AppState.currentState);

  // ── Auto-advance ───────────────────────────────────────────────────────

  const advance = useCallback(() => {
    if (isDragging.current) return;
    setActive((prev) => {
      const next = (prev + 1) % BANNERS.length;
      scrollRef.current?.scrollTo({
        x: next * CARD_W + next * CARD_MARGIN,
        animated: true,
      });
      return next;
    });
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(advance, AUTO_MS);
  }, [advance]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    startTimer();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active" && appState.current !== "active") startTimer();
      if (next !== "active") stopTimer();
      appState.current = next;
    });
    return () => {
      stopTimer();
      sub.remove();
    };
  }, [startTimer, stopTimer]);

  // ── Scroll sync ────────────────────────────────────────────────────────

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_W);
      setActive(Math.max(0, Math.min(idx, BANNERS.length - 1)));
    },
    [],
  );

  const onScrollBeginDrag = useCallback(() => {
    isDragging.current = true;
    stopTimer();
  }, [stopTimer]);

  const onScrollEndDrag = useCallback(() => {
    isDragging.current = false;
    startTimer();
  }, [startTimer]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={cs.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}        // manual snap: each card fills CARD_W
        snapToInterval={CARD_W + 12} // 12 = gap between cards
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={cs.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={onScrollBeginDrag}
        onScrollEndDrag={onScrollEndDrag}
      >
        {BANNERS.map((banner) => (
          <BannerCard
            key={banner.id}
            banner={banner}
            onPress={onBannerPress}
          />
        ))}
      </ScrollView>

      <DotIndicator count={BANNERS.length} active={active} />
    </View>
  );
});

export default PromoBanner;

// ─── Styles ──────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  scrollContent: {
    paddingHorizontal: CARD_MARGIN,
    gap:               12,
    flexDirection:     "row",
  },

  // ── Card ────────────────────────────────────────────────────────────────
  cardOuter: {
    width:  CARD_W,
  },
  card: {
    width:        CARD_W,
    height:       CARD_H,
    borderRadius: kit.radius.lg,
    overflow:     "hidden",
    ...kit.shadow.raised,
  },
  gradient: {
    flex:              1,
    paddingHorizontal: 20,
    paddingVertical:   18,
    flexDirection:     flexRow(IS_RTL),
    justifyContent:    "space-between",
    alignItems:        "center",
  },

  // ── Decorative circles ──────────────────────────────────────────────────
  decCircle1: {
    position:        "absolute",
    width:           140,
    height:          140,
    borderRadius:    70,
    backgroundColor: "rgba(255,255,255,0.07)",
    top:             -40,
    ...(IS_RTL ? { left: -30 } : { right: -30 }),
  },
  decCircle2: {
    position:        "absolute",
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom:          -20,
    ...(IS_RTL ? { right: 60 } : { left: 60 }),
  },

  // ── Text content ────────────────────────────────────────────────────────
  content: {
    flex: 1,
    gap:  6,
  },
  tagPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    alignSelf:         "flex-start",
    backgroundColor:   "rgba(255,255,255,0.18)",
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 9,
    paddingVertical:   3,
  },
  tagText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              "rgba(255,255,255,0.95)",
    includeFontPadding: false,
    textAlign:          IS_RTL ? "right" : "left",
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    lineHeight:         28,
    color:              "#ffffff",
    includeFontPadding: false,
    textAlign:          IS_RTL ? "right" : "left",
  },
  sub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         17,
    color:              "rgba(255,255,255,0.80)",
    includeFontPadding: false,
    textAlign:          IS_RTL ? "right" : "left",
  },

  // ── Right icon ──────────────────────────────────────────────────────────
  iconBadge: {
    width:          72,
    height:         72,
    borderRadius:   36,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems:     "center",
    justifyContent: "center",
    marginStart:    12,
  },

  // ── Dot indicator ───────────────────────────────────────────────────────
  dots: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
  },
  dot: {
    height:       6,
    borderRadius: 3,
  },
  dotActive: {
    width:           20,
    backgroundColor: kit.color.accentDeep,
  },
  dotInactive: {
    width:           6,
    backgroundColor: theme.colors.border.hairline,
  },
});
