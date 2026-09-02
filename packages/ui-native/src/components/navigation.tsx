import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

// Local & Theme Imports
import { legacyColors } from "@pharmacy/design-tokens";
import { Text } from "./primitives";
import { useTheme } from "../theme";

// ── Types & Interfaces ──────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export interface TabBarItemConfig {
  name: string;
  icon: { active: IoniconsName; inactive: IoniconsName };
  label: string;
  badge?: number | boolean;
}

export interface AnimatedTabBarProps extends BottomTabBarProps {
  items: ReadonlyArray<TabBarItemConfig>;
  barHeight?: number;
  style?: StyleProp<ViewStyle>;
}

export interface ScreenHeaderAction {
  icon: IoniconsName;
  onPress: () => void;
  badge?: number;
  accessibilityLabel?: string;
}

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: ScreenHeaderAction;
  trailing?: React.ReactNode;
  align?: "center" | "start";
  backStyle?: "flat" | "floating";
  transparent?: boolean;
  style?: StyleProp<ViewStyle>;
}

interface TabTone {
  active: string;
  inactive: string;
  surface: string;
  error: string;
  inverse: string;
}

// ── Animation Constants ─────────────────────────────────────────────────────

const SPRING = { damping: 20, stiffness: 300, mass: 0.6 } as const;
const PILL_SPRING = { damping: 18, stiffness: 220, mass: 0.7 } as const;
const PRESS_SPRING = { damping: 16, stiffness: 400, mass: 0.5 } as const;

// ── Sub-Components ──────────────────────────────────────────────────────────

const TabBarIcon = React.memo(({ item, focused, tone }: { item: TabBarItemConfig; focused: boolean; tone: TabTone }) => {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, progress]);

  const iconAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.9, 1], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [0, -2], Extrapolation.CLAMP) },
    ],
  }));

  const labelAnim = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP),
  }));

  const dotAnim = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scaleX: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1], Extrapolation.CLAMP) }],
  }));

  const color = focused ? tone.active : tone.inactive;
  const showDotBadge = item.badge === true;
  const showCountBadge = typeof item.badge === "number" && item.badge > 0;
  const displayBadgeCount = (item.badge as number) > 9 ? "9+" : item.badge;

  return (
    <View style={navStyles.iconWrap}>
      {showDotBadge && (
        <View style={[navStyles.badgeDot, { backgroundColor: tone.active, borderColor: tone.surface }]} />
      )}
      
      <Animated.View style={iconAnim}>
        <Ionicons name={focused ? item.icon.active : item.icon.inactive} size={22} color={color} />
      </Animated.View>
      
      <Animated.View style={labelAnim}>
        <Text variant="caption" numberOfLines={1} style={{ color }}>
          {item.label}
        </Text>
      </Animated.View>
      
      <Animated.View style={[navStyles.activeDot, dotAnim, { backgroundColor: tone.active }]} />
      
      {showCountBadge && (
        <View style={[navStyles.badgeCount, { backgroundColor: tone.error, borderColor: tone.surface }]}>
          <Text style={[navStyles.badgeCountText, { color: tone.inverse }]}>{displayBadgeCount}</Text>
        </View>
      )}
    </View>
  );
});
TabBarIcon.displayName = "TabBarIcon";

const TabPressable = React.memo(({ onPress, onLayout, children, ...rest }: Omit<React.ComponentProps<typeof Pressable>, "children" | "onLayout"> & { onLayout?: (e: LayoutChangeEvent) => void; children: React.ReactNode }) => {
  const pressScale = useSharedValue(1);
  const pressAnim = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));

  const handlePressIn = useCallback(() => { pressScale.value = withSpring(0.88, PRESS_SPRING); }, [pressScale]);
  const handlePressOut = useCallback(() => { pressScale.value = withSpring(1, PRESS_SPRING); }, [pressScale]);

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onLayout={onLayout}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={pressAnim}>{children}</Animated.View>
    </Pressable>
  );
});
TabPressable.displayName = "TabPressable";

// ── Main Components ─────────────────────────────────────────────────────────

export function AnimatedTabBar({ state, navigation, items, barHeight, style }: AnimatedTabBarProps): React.ReactElement {
  const { theme, isDark, isRTL } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const isTablet = width >= 600;
  const resolvedBarHeight = barHeight ?? (isTablet ? 72 : Platform.OS === "ios" ? 82 : 64);
  const paddingBottom = Math.max(insets.bottom, isTablet ? 8 : 6);

  const [barWidth, setBarWidth] = useState(0);

  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  const pillOpacity = useSharedValue(0);
  const orderedRoutesRef = useRef<typeof state.routes>([]);

  // Memoized routing and theme data to prevent unnecessary re-renders
  const byName = useMemo(() => new Map(items.map((item) => [item.name, item])), [items]);

  const orderedRoutes = useMemo(() => {
    const routes = state.routes.filter((route) => byName.has(route.name));
    orderedRoutesRef.current = routes;
    return routes;
  }, [state.routes, byName]);

  const tone: TabTone = useMemo(() => ({
    active: theme.colors.brand.primary,
    inactive: theme.colors.text.muted,
    surface: theme.colors.canvas.surface,
    error: theme.colors.status?.error ?? "#EF4444",
    inverse: theme.colors.text?.inverse ?? "#FFFFFF",
  }), [theme]);

  const handleTabPress = useCallback((routeKey: string, routeName: string, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      navigation.navigate(routeName);
    }
  }, [navigation]);

  // Pill slot is computed purely from item count + measured bar width, never
  // from each item's own onLayout — every item is flex:1 (uniform width),
  // so the slot math is exact, and onLayout's reported x/width turned out
  // to be unreliable under native RTL mirroring (it reports each item's
  // position in *declared* order, not its actual mirrored screen position).
  // The pill's own base anchor mattered just as much: `left:0` on this
  // absolutely-positioned pill was itself being mirrored under forceRTL, so
  // translateX(0) (the active-tab-0 case) landed at the *physical right*
  // edge instead of the left — confirmed live via logcat (slot math was
  // always correct; only the rendered position was wrong) and fixed by
  // anchoring with `right:0` instead, which pairs correctly with a
  // physical-pixel translateX.
  // barWidth is measured off navStyles.inner's own onLayout, which reports
  // that View's full border-box width — including its own paddingHorizontal
  // (isTablet ? 24 : 8). The tab items are normal-flow children, so they're
  // inset by that padding on each side; the pill is `position:"absolute"`,
  // which is positioned relative to the parent's border-box edges and does
  // NOT get inset by the parent's own padding. Left uncorrected, the two
  // coordinate systems disagree by exactly `barPaddingH`, which reads as
  // the pill sitting a few px off — "leaning" — rather than centered under
  // its tab.
  const barPaddingH = isTablet ? 24 : 8;

  useEffect(() => {
    if (barWidth <= 0) return;
    const renderIndex = orderedRoutesRef.current.findIndex((r) => r.key === state.routes[state.index]?.key);
    if (renderIndex < 0) return;

    const count = orderedRoutesRef.current.length || 1;
    const contentWidth = Math.max(0, barWidth - barPaddingH * 2);
    const slotW = contentWidth / count;
    const slot = isRTL ? count - 1 - renderIndex : renderIndex;
    const targetX = barPaddingH + slot * slotW;

    const isFirstPaint = pillW.value === 0;
    pillX.value = isFirstPaint ? targetX : withSpring(targetX, PILL_SPRING);
    pillW.value = isFirstPaint ? slotW : withSpring(slotW, PILL_SPRING);
    pillOpacity.value = withTiming(1, { duration: 200 });
  }, [state.index, state.routes, barWidth, isRTL, barPaddingH, pillX, pillW, pillOpacity]);

  const pillAnim = useAnimatedStyle(() => ({
    opacity: pillOpacity.value * 0.14,
    width: pillW.value,
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View style={[
      navStyles.outer,
      theme.shadows[2],
      // A themed, fully-opaque base color underneath the blur on every
      // platform — not just web. expo-blur's Android BlurView frequently
      // doesn't actually blur anything on real devices (a known limitation
      // on many GPU/OS combinations) and instead paints a generic grey
      // fallback that ignores the app's theme entirely, which is exactly
      // what made the whole bar "literally grey" in dark mode. With a
      // correct theme.colors.canvas.surface base already in place, that
      // fallback (or a genuinely working blur) only ever layers subtly on
      // top instead of being the sole source of color.
      { backgroundColor: theme.colors.canvas.surface },
      { paddingBottom },
      style
    ]}>
      {/* Clip blur layers so they don't bleed past the bar bounds */}
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} pointerEvents="none">
        {Platform.OS !== "web" && (
          <>
            <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? legacyColors.glassDark : legacyColors.glass }]} />
          </>
        )}
      </View>
      
      <View pointerEvents="none" style={[navStyles.topHairline, { backgroundColor: theme.colors.border.default }]} />

      <View
        style={[navStyles.inner, { height: resolvedBarHeight, paddingHorizontal: isTablet ? 24 : 8 }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >

        <Animated.View pointerEvents="none" style={[navStyles.pill, pillAnim, { backgroundColor: tone.active }]} />
        
        {orderedRoutes.map((route) => {
          const item = byName.get(route.name)!;
          const realIndex = state.routes.findIndex((entry) => entry.key === route.key);
          const focused = state.index === realIndex;
          
          return (
            <TabPressable
              key={route.key}
              onPress={() => handleTabPress(route.key, route.name, focused)}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: focused }}
              style={navStyles.item}
            >
              <TabBarIcon item={item} focused={focused} tone={tone} />
            </TabPressable>
          );
        })}
      </View>
    </View>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightAction,
  trailing,
  align = "center",
  backStyle = "flat",
  transparent,
  style,
}: ScreenHeaderProps): React.ReactElement {
  const { theme, isRTL } = useTheme();
  const { t } = useTranslation();

  const backIcon: IoniconsName = isRTL ? "chevron-forward" : "chevron-back";
  const isStart = align === "start";
  const isFloating = backStyle === "floating";
  const textAlign = isStart ? (isRTL ? "right" : "left") : "center";

  return (
    <View
      style={[
        navStyles.headerContainer,
        !transparent && { backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default },
        style,
      ]}
    >
      <View style={[navStyles.headerSide, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        {onBack && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={onBack}
            hitSlop={8}
            style={[
              navStyles.headerIconButton,
              isFloating && {
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: theme.colors.canvas.surface,
                borderWidth: 1,
                borderColor: theme.colors.border.default,
                ...theme.shadows[1],
              },
            ]}
          >
            <Ionicons name={backIcon} size={isFloating ? 18 : 24} color={theme.colors.text.primary} />
          </Pressable>
        )}
      </View>
      
      <View style={[navStyles.headerCenter, isStart && navStyles.headerCenterStart]}>
        <Text variant="h4" align={textAlign} numberOfLines={1}>{title}</Text>
        {subtitle && (
          <Text variant="caption" color="secondary" align={textAlign} numberOfLines={1}>{subtitle}</Text>
        )}
      </View>

      <View style={[trailing ? navStyles.headerSideAuto : navStyles.headerSide, { alignItems: isRTL ? "flex-start" : "flex-end" }]}>
        {trailing ? (
          trailing
        ) : rightAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel ?? "Action"}
            onPress={rightAction.onPress}
            hitSlop={8}
            style={navStyles.headerIconButton}
          >
            <Ionicons name={rightAction.icon} size={24} color={theme.colors.text.primary} />
            {rightAction.badge != null && rightAction.badge > 0 && (
              <View style={[navStyles.badgeCount, { top: 2, end: 2, backgroundColor: theme.colors.status?.error ?? "#EF4444" }]}>
                <Text style={[navStyles.badgeCountText, { color: theme.colors.text?.inverse ?? "#FFFFFF" }]}>
                  {rightAction.badge > 99 ? "99+" : rightAction.badge}
                </Text>
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const navStyles = StyleSheet.create({
  // overflow:visible so the box-shadow / elevation is not clipped.
  // The blur and glass tint layers are still clipped to their own bounds
  // via their own styles — they don't need the outer View to clip them.
  outer: { width: "100%", overflow: "visible" },
  topHairline: { height: StyleSheet.hairlineWidth, position: "absolute", top: 0, left: 0, right: 0, zIndex: 2 },
  inner: { flexDirection: "row", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  item: { flex: 1, minWidth: 44, maxWidth: 120, height: "100%", alignItems: "center", justifyContent: "center", paddingTop: 2 },
  pill: { position: "absolute", right: 0, top: 6, bottom: 6, borderRadius: 18 },
  iconWrap: { alignItems: "center", justifyContent: "center", gap: 3 },
  activeDot: { marginTop: 2, width: 16, height: 3, borderRadius: 2 },
  badgeDot: { position: "absolute", top: -2, end: -6, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, zIndex: 1 },
  badgeCount: { position: "absolute", top: -4, end: "22%", minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2 },
  badgeCountText: { fontSize: 9, lineHeight: 11, fontWeight: "700", textAlign: "center" },
  headerContainer: { flexDirection: "row", height: 56, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  headerSide: { width: 48, justifyContent: "center" },
  // A custom `trailing` node is usually a text action ("Mark all read"),
  // which cannot survive the fixed 48px icon-sized slot -- it wrapped into
  // a clipped one-word-per-line column. Size to content instead, keeping
  // 48 as the floor so a bare icon still balances the back button.
  headerSideAuto: { minWidth: 48, flexShrink: 0, justifyContent: "center" },
  headerCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 8 },
  headerCenterStart: { alignItems: "flex-start" },
  headerIconButton: { padding: 8 },
});