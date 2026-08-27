import React, { useCallback, useEffect } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
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
} from "react-native-reanimated";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { legacyColors } from "@pharmacy/design-tokens";
import { Text } from "./primitives";
import { useTheme } from "../theme";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const SPRING = { damping: 20, stiffness: 300, mass: 0.6 } as const;

export interface TabBarItemConfig {
  /** Must match the expo-router route/screen name. */
  name: string;
  icon: { active: IoniconsName; inactive: IoniconsName };
  /** Already resolved/translated by the caller — this component doesn't own copy. */
  label: string;
  /** number = count badge (0/undefined hides it), true = plain dot badge. */
  badge?: number | boolean;
}

export interface AnimatedTabBarProps extends BottomTabBarProps {
  items: ReadonlyArray<TabBarItemConfig>;
  barHeight?: number;
  style?: StyleProp<ViewStyle>;
}

interface TabTone { active: string; inactive: string; surface: string }

function TabBarIcon({ item, focused, tone }: { item: TabBarItemConfig; focused: boolean; tone: TabTone }): React.ReactElement {
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => { progress.value = withSpring(focused ? 1 : 0, SPRING); }, [focused, progress]);

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

  return (
    <View style={navStyles.iconWrap}>
      {showDotBadge ? <View style={[navStyles.badgeDot, { backgroundColor: tone.active, borderColor: tone.surface }]} /> : null}
      <Animated.View style={iconAnim}>
        <Ionicons name={focused ? item.icon.active : item.icon.inactive} size={22} color={color} />
      </Animated.View>
      <Animated.View style={labelAnim}>
        <Text variant="caption" numberOfLines={1} style={{ color }}>{item.label}</Text>
      </Animated.View>
      <Animated.View style={[navStyles.activeDot, dotAnim, { backgroundColor: tone.active }]} />
      {showCountBadge ? (
        <View style={navStyles.badgeCount}>
          <Text style={navStyles.badgeCountText}>{(item.badge as number) > 9 ? "9+" : item.badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Shared bottom tab bar — Reanimated spring icon/label motion, an animated
 * underline dot, glass backing, RTL-aware route ordering, and theme-driven
 * colors (reads useTheme() only; never device color scheme directly, which
 * previously let tab bars disagree with the rest of the app on light/dark).
 * Used by every persona/app's tab navigation via `tabBar={(props) => ...}`.
 */
export function AnimatedTabBar({ state, navigation, items, barHeight, style }: AnimatedTabBarProps): React.ReactElement {
  const { theme, isRTL, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const barH = barHeight ?? (isTablet ? 72 : Platform.OS === "ios" ? 82 : 64);

  const onPress = useCallback((routeKey: string, routeName: string, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      navigation.navigate(routeName);
    }
  }, [navigation]);

  const byName = new Map(items.map((item) => [item.name, item]));
  const visibleRoutes = state.routes.filter((route) => byName.has(route.name));
  const orderedRoutes = isRTL ? [...visibleRoutes].reverse() : visibleRoutes;

  const tone: TabTone = {
    active: theme.colors.brand.primary,
    inactive: theme.colors.text.muted,
    surface: theme.colors.canvas.surface,
  };

  return (
    <View style={[navStyles.outer, theme.shadows[2], Platform.OS === "web" && { backgroundColor: theme.colors.canvas.surface }, { paddingBottom: Math.max(insets.bottom, isTablet ? 8 : 6) }, style]}>
      {Platform.OS !== "web" && (
        <>
          <BlurView intensity={60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? legacyColors.glassDark : legacyColors.glass }]} />
        </>
      )}
      <View pointerEvents="none" style={[navStyles.topHairline, { backgroundColor: theme.colors.border.default }]} />
      <View style={[navStyles.inner, { height: barH, paddingHorizontal: isTablet ? 24 : 8 }]}>
        {orderedRoutes.map((route) => {
          const item = byName.get(route.name)!;
          const realIndex = state.routes.findIndex((entry) => entry.key === route.key);
          const focused = state.index === realIndex;
          return (
            <Pressable
              key={route.key}
              onPress={() => onPress(route.key, route.name, focused)}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: focused }}
              style={navStyles.item}
            >
              <TabBarIcon item={item} focused={focused} tone={tone} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
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
  /** Omit to hide the back button entirely. The canonical header never
   *  navigates on its own (this package has no expo-router dependency) —
   *  callers (or a persona wrapper) always supply the handler. */
  onBack?: () => void;
  /** A single structured icon+badge action on the trailing edge. */
  rightAction?: ScreenHeaderAction;
  /** A free-form trailing slot for cases rightAction's single-icon shape
   *  can't express. Takes precedence over rightAction if both are given. */
  trailing?: React.ReactNode;
  /** "center" (default) for hero/functional screens; "start" for dense
   *  operational screens (pharmacist/driver) where the title reads better
   *  aligned with body content below it. */
  align?: "center" | "start";
  /** "flat" (default) is an icon-only touch target on a plain/bordered
   *  surface. "floating" is an elevated circular chip — driver's treatment,
   *  giving operational screens a touch more physical presence. */
  backStyle?: "flat" | "floating";
  transparent?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Shared in-content header — all three personas set headerShown:false
 *  globally and build headers per-screen from this one implementation.
 *  RTL-correct back chevron via useTheme().isRTL. */
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
  const backIcon: IoniconsName = isRTL ? "chevron-forward" : "chevron-back";
  const isStart = align === "start";
  const isFloating = backStyle === "floating";

  return (
    <View
      style={[
        navStyles.headerContainer,
        { flexDirection: isRTL ? "row-reverse" : "row" },
        !transparent && { backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default },
        style,
      ]}
    >
      <View style={[navStyles.headerSide, { alignItems: isRTL ? "flex-end" : "flex-start" }]}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
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
        ) : null}
      </View>
      <View style={[navStyles.headerCenter, isStart && navStyles.headerCenterStart]}>
        <Text variant="h4" align={isStart ? (isRTL ? "right" : "left") : "center"} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text variant="caption" color="secondary" align={isStart ? (isRTL ? "right" : "left") : "center"} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[navStyles.headerSide, { alignItems: isRTL ? "flex-start" : "flex-end" }]}>
        {trailing ? trailing : rightAction ? (
          <Pressable accessibilityRole="button" accessibilityLabel={rightAction.accessibilityLabel ?? "Action"} onPress={rightAction.onPress} hitSlop={8} style={navStyles.headerIconButton}>
            <Ionicons name={rightAction.icon} size={24} color={theme.colors.text.primary} />
            {rightAction.badge != null && rightAction.badge > 0 ? (
              <View style={[navStyles.badgeCount, { top: 2, end: 2 }, { backgroundColor: theme.colors.status.error }]}>
                <Text style={navStyles.badgeCountText}>{rightAction.badge > 99 ? "99+" : rightAction.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const navStyles = StyleSheet.create({
  outer: { width: "100%", overflow: "hidden" },
  topHairline: { height: StyleSheet.hairlineWidth, position: "absolute", top: 0, left: 0, right: 0 },
  inner: { flexDirection: "row", alignItems: "center" },
  item: { flex: 1, minWidth: 44, maxWidth: 120, height: "100%", alignItems: "center", justifyContent: "center", paddingTop: 2 },
  iconWrap: { alignItems: "center", justifyContent: "center", gap: 3 },
  activeDot: { marginTop: 2, width: 16, height: 3, borderRadius: 2 },
  badgeDot: { position: "absolute", top: -2, end: -6, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, zIndex: 1 },
  badgeCount: { position: "absolute", top: -4, end: "22%", minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2, borderColor: "#FFFFFF" },
  badgeCountText: { color: "#FFFFFF", fontSize: 9, lineHeight: 11, fontWeight: "700", textAlign: "center" },
  headerContainer: { height: 56, alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  headerSide: { width: 48, justifyContent: "center" },
  headerCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 8 },
  headerCenterStart: { alignItems: "flex-start" },
  headerIconButton: { padding: 8 },
});
