import React, { forwardRef, useEffect, useState } from "react";
import {
  ActivityIndicator,

  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type ImageSourcePropType,

  type PressableProps,
  type StyleProp,

  type TextInputProps,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { gradients, legacyColors } from "@pharmacy/design-tokens";
import { useTheme } from "../theme";
import { kit } from "../kit";

/** Colored ambient shadow used by `glow` — reads the brand/status color per theme so it never hardcodes a mode. */
function glowShadow(color: string): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.32, shadowRadius: 14 },
    android: { elevation: 8, shadowColor: color },
    default: {},
  }) ?? {};
}

export type TextVariant = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body" | "bodySm" | "caption" | "label" | "display" | "hero" | "screen-title" | "sheet-title" | "section-head" | "card-title" | "body-sm" | "eyebrow" | "badge" | "metric";
export type TextScale = keyof typeof kit.type;
export type TextWeight = "regular" | "medium" | "semibold" | "bold" | "extrabold" | "black";
export type TextColor = "primary" | "secondary" | "muted" | "tertiary" | "disabled" | "inverse" | "inverse-muted" | "brand" | "danger" | "warn" | "success" | "info";
export interface TextProps extends Omit<RNTextProps, "style"> {
  variant?: TextVariant;
  scale?: TextScale;
  color?: TextColor | string;
  weight?: TextWeight;
  align?: TextStyle["textAlign"] | "start" | "end";
  style?: StyleProp<TextStyle>;
}

const textMetrics: Record<TextVariant, { fontSize: number; lineHeight: number; weight: TextWeight }> = {
  h1: { fontSize: 32, lineHeight: 40, weight: "black" }, h2: { fontSize: 24, lineHeight: 32, weight: "bold" }, h3: { fontSize: 20, lineHeight: 28, weight: "bold" }, h4: { fontSize: 18, lineHeight: 26, weight: "bold" }, h5: { fontSize: 16, lineHeight: 24, weight: "bold" }, h6: { fontSize: 14, lineHeight: 20, weight: "bold" },
  display: { fontSize: 36, lineHeight: 40, weight: "black" }, hero: { fontSize: 32, lineHeight: 38, weight: "extrabold" }, "screen-title": { fontSize: 24, lineHeight: 30, weight: "extrabold" }, "sheet-title": { fontSize: 20, lineHeight: 26, weight: "extrabold" }, "section-head": { fontSize: 18, lineHeight: 24, weight: "extrabold" }, "card-title": { fontSize: 16, lineHeight: 22, weight: "bold" },
  body: { fontSize: 15, lineHeight: 21, weight: "regular" }, bodySm: { fontSize: 14, lineHeight: 20, weight: "regular" }, "body-sm": { fontSize: 14, lineHeight: 20, weight: "regular" }, caption: { fontSize: 12, lineHeight: 17, weight: "semibold" }, label: { fontSize: 14, lineHeight: 20, weight: "semibold" }, eyebrow: { fontSize: 11, lineHeight: 16, weight: "bold" }, badge: { fontSize: 11, lineHeight: 16, weight: "bold" }, metric: { fontSize: 28, lineHeight: 34, weight: "black" },
};
const fontFamily: Record<TextWeight, string> = { regular: "Cairo_400Regular", medium: "Cairo_400Regular", semibold: "Cairo_600SemiBold", bold: "Cairo_700Bold", extrabold: "Cairo_800ExtraBold", black: "Cairo_900Black" };

/** Theme-aware Cairo text with logical RTL alignment. */
export function Text({ variant = "body", scale, color = "primary", weight, align, style, ...props }: TextProps): React.ReactElement {
  const { theme, isRTL } = useTheme();
  const metric = scale ? kit.type[scale as keyof typeof kit.type] : textMetrics[variant];
  const resolvedWeight: TextWeight = weight ?? ("weight" in metric ? (metric as { weight: TextWeight }).weight : "regular");
  const semanticColors: Record<string, string> = {
    primary: theme.colors.text.primary, secondary: theme.colors.text.secondary, muted: theme.colors.text.muted, tertiary: theme.colors.text.muted,
    disabled: theme.colors.text.disabled, inverse: theme.colors.text.inverse, "inverse-muted": theme.colors.text.inverse,
    brand: theme.colors.brand.primary, danger: theme.colors.status.error, warn: theme.colors.status.warning, success: theme.colors.status.success, info: theme.colors.status.info,
  };
  const textAlign = align === "start" ? (isRTL ? "right" : "left") : align === "end" ? (isRTL ? "left" : "right") : align ?? (isRTL ? "right" : "left");
  return <RNText {...props} style={[styles.text, metric, { color: semanticColors[color] ?? color, fontFamily: fontFamily[resolvedWeight], textAlign, writingDirection: isRTL ? "rtl" : "ltr" }, style]} />;
}

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
  scaleFactor?: number;
  scaleTo?: number;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Accessible press target with a UI-thread spring scale and optional haptic. */
export function PressableScale({ scaleFactor = 0.97, scaleTo, haptic = false, onPress, onPressIn, onPressOut, disabled, style, ...props }: PressableScaleProps): React.ReactElement {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <AnimatedPressable {...props} disabled={disabled} accessibilityRole={props.accessibilityRole ?? "button"} accessibilityState={{ ...props.accessibilityState, disabled: !!disabled }} onPressIn={(event) => { scale.value = withSpring(scaleTo ?? scaleFactor); onPressIn?.(event); }} onPressOut={(event) => { scale.value = withSpring(1); onPressOut?.(event); }} onPress={(event) => { if (haptic) void Haptics.selectionAsync().catch(() => undefined); onPress?.(event); }} style={[style, animatedStyle]} />;
}

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
/** Restrained by design: "gradient"/"glass" are for brand hero moments and celebratory states, not a default reflex — see design-language A4. */
export type ButtonTone = "solid" | "gradient" | "glass";
export interface ButtonProps extends Omit<PressableScaleProps, "children" | "onPress"> {
  label?: string; title?: string; onPress: (event?: unknown) => void; variant?: ButtonVariant; size?: ButtonSize; tone?: ButtonTone; glow?: boolean; loading?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"]; iconEnd?: boolean; iconLeft?: React.ReactNode; iconRight?: React.ReactNode; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode;
  fullWidth?: boolean; full?: boolean; textStyle?: StyleProp<TextStyle>;
}

/** Enterprise action control. Supports both historical app prop names during migration. */
export function Button({ label, title, onPress, variant = "primary", size = "md", tone = "solid", glow = false, loading = false, disabled, icon, iconEnd, iconLeft, iconRight, leftIcon, rightIcon, fullWidth, full, style, textStyle, accessibilityLabel, ...props }: ButtonProps): React.ReactElement {
  const { theme, isRTL, isDark } = useTheme();
  const caption = label ?? title ?? "";
  const palette = {
    primary: [theme.colors.brand.primary, theme.colors.text.inverse, theme.colors.brand.primary], secondary: [theme.colors.brand.primaryLight, theme.colors.brand.primaryDark, theme.colors.brand.primaryLight],
    outline: ["transparent", theme.colors.brand.primary, theme.colors.brand.primary], ghost: ["transparent", theme.colors.brand.primary, "transparent"], danger: [theme.colors.status.error, theme.colors.text.inverse, theme.colors.status.error],
  }[variant];
  // Gradient tone only reads as intentional on the two variants that already carry a solid brand/status fill.
  const useGradient = tone === "gradient" && (variant === "primary" || variant === "danger");
  const useGlass = tone === "glass";
  const gradientColors = variant === "danger" ? gradients.error : gradients.brandPrimary;
  const glassTextColor = isDark ? theme.colors.text.inverse : theme.colors.text.primary;
  const contentColor = useGlass ? glassTextColor : palette[1];
  const namedIcon = icon ? <Ionicons name={icon} size={size === "lg" ? 20 : size === "sm" ? 16 : 18} color={contentColor} /> : null;
  const start = iconLeft ?? leftIcon ?? (!iconEnd ? namedIcon : null);
  const end = iconRight ?? rightIcon ?? (iconEnd ? namedIcon : null);
  const glowColor = variant === "danger" ? theme.colors.status.error : theme.colors.brand.primary;
  return <PressableScale {...props} haptic disabled={disabled || loading} onPress={() => onPress()} accessibilityLabel={accessibilityLabel ?? caption} accessibilityState={{ disabled: !!disabled || loading, busy: loading }} style={[styles.button, styles[`button_${size}`], useGradient || useGlass ? { borderColor: useGlass ? legacyColors.glassBorder : "transparent", overflow: "hidden" } : { backgroundColor: palette[0], borderColor: palette[2] }, useGlass && Platform.OS === "web" && { backgroundColor: `${theme.colors.canvas.surface}D9` }, { flexDirection: isRTL ? "row-reverse" : "row" }, glow && glowShadow(glowColor), (fullWidth || full) && styles.full, style]}>
    {useGradient ? <LinearGradient colors={gradientColors as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
    {useGlass && Platform.OS !== "web" ? <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
    {useGlass ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? legacyColors.glassDark : legacyColors.glass }]} /> : null}
    {loading ? <ActivityIndicator color={contentColor} /> : <>{start}<Text variant="label" align="center" style={[{ color: contentColor }, textStyle]}>{caption}</Text>{end}</>}
  </PressableScale>;
}

export type CardVariant = "default" | "elevated" | "raised" | "flat" | "outlined" | "filled" | "interactive";
/** "glass" is for surfaces genuinely sitting above imagery or a live surface (map controls, hero headers) — see design-language A4. */
export type CardSurface = "solid" | "glass";
export interface CardProps { children: React.ReactNode; variant?: CardVariant; padding?: number | "none" | "sm" | "md" | "lg"; elevation?: "none" | "sm" | "md" | "lg"; radius?: number; background?: string; surface?: CardSurface; onPress?: () => void; style?: StyleProp<ViewStyle>; accessibilityLabel?: string; }
const cardPadding = { none: 0, sm: 12, md: 16, lg: 20 } as const;

/** Theme surface with optional press behavior and elevation. */
export function Card({ children, variant = "default", padding = 16, elevation, radius = 16, background, surface = "solid", onPress, style, accessibilityLabel }: CardProps): React.ReactElement {
  const { theme, isDark } = useTheme();
  const resolvedPadding = typeof padding === "number" ? padding : cardPadding[padding];
  const elevationIndex = elevation === "lg" || variant === "raised" ? 3 : elevation === "md" || variant === "elevated" || variant === "interactive" ? 2 : elevation === "none" || variant === "flat" || variant === "outlined" ? 0 : 1;
  const isGlass = surface === "glass";
  const cardStyle: StyleProp<ViewStyle> = [styles.card, theme.shadows[elevationIndex], { borderRadius: radius, backgroundColor: isGlass ? (Platform.OS === "web" ? `${theme.colors.canvas.surface}D9` : "transparent") : (background ?? (variant === "filled" ? theme.colors.canvas.surfaceMuted : theme.colors.canvas.surface)), borderColor: isGlass ? legacyColors.glassBorder : theme.colors.border.default, borderWidth: isGlass ? StyleSheet.hairlineWidth : (variant === "outlined" || variant === "default" || variant === "flat" ? 1 : 0) }, style];
  const content = <>
    {isGlass && Platform.OS !== "web" ? <BlurView intensity={50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
    {isGlass ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? legacyColors.glassDark : legacyColors.glass }]} /> : null}
    <View style={{ padding: resolvedPadding }}>{children}</View>
  </>;
  return onPress ? <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel} style={cardStyle}>{content}</PressableScale> : <View style={cardStyle}>{content}</View>;
}
Card.padding = { sm: 12, md: 16, lg: 20, xl: 24 } as const;

export interface InputProps extends TextInputProps { label?: string; error?: string; hint?: string; prefixIcon?: React.ReactNode; suffixIcon?: React.ReactNode; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; clearButton?: boolean; password?: boolean; containerStyle?: StyleProp<ViewStyle>; required?: boolean; }

/** Labelled input with composed focus handlers, clear/password actions, and RTL icon order. */
export const Input = forwardRef<TextInput, InputProps>(function Input({ label, error, hint, prefixIcon, suffixIcon, leftIcon, rightIcon, clearButton, password, secureTextEntry, containerStyle, required, onFocus, onBlur, onChangeText, value, style, accessibilityLabel, ...props }, ref) {
  const { theme, isRTL } = useTheme();
  const [focused, setFocused] = useState(false); const [hidden, setHidden] = useState(password || secureTextEntry);
  const shake = useSharedValue(0); const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  useEffect(() => { if (error) shake.value = withSequence(withTiming(-5, { duration: 45 }), withRepeat(withTiming(5, { duration: 45 }), 3, true), withTiming(0, { duration: 45 })); }, [error, shake]);
  const prefix = prefixIcon ?? leftIcon; const suffix = suffixIcon ?? rightIcon;
  return <Animated.View style={[{ gap: 6 }, containerStyle, animatedStyle]}>{label ? <Text variant="label">{label}{required ? " *" : ""}</Text> : null}<View style={[styles.inputWrap, { borderColor: error ? theme.colors.status.error : focused ? theme.colors.border.focus : theme.colors.border.default, backgroundColor: theme.colors.canvas.surface, flexDirection: isRTL ? "row-reverse" : "row" }]}>{prefix}<TextInput ref={ref} {...props} value={value} secureTextEntry={hidden} accessibilityLabel={accessibilityLabel ?? label} accessibilityHint={error ?? hint} onChangeText={onChangeText} onFocus={(event) => { setFocused(true); onFocus?.(event); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }} placeholderTextColor={theme.colors.text.disabled} style={[styles.input, { color: theme.colors.text.primary, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }, style]} />{clearButton && value ? <Pressable accessibilityRole="button" accessibilityLabel="Clear input" onPress={() => onChangeText?.("")}><Ionicons name="close-circle" size={20} color={theme.colors.text.muted} /></Pressable> : null}{password ? <Pressable accessibilityRole="button" accessibilityLabel={hidden ? "Show password" : "Hide password"} onPress={() => setHidden((current) => !current)}><Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={theme.colors.text.muted} /></Pressable> : suffix}</View>{error || hint ? <Text variant="caption" color={error ? "danger" : "muted"} accessibilityLiveRegion={error ? "polite" : "none"}>{error ?? hint}</Text> : null}</Animated.View>;
});

export type BadgeVariant = "primary" | "success" | "warning" | "error" | "info" | "neutral" | "status";
export interface BadgeProps { label?: string; count?: number; variant?: BadgeVariant; dot?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string; }
/** Semantic badge; count zero is automatically hidden. */
export function Badge({ label, count, variant = "primary", dot, style, accessibilityLabel }: BadgeProps): React.ReactElement | null { const { theme, isRTL } = useTheme(); if (typeof count === "number" && count <= 0) return null; const color = variant === "success" ? theme.colors.status.success : variant === "warning" ? theme.colors.status.warning : variant === "error" ? theme.colors.status.error : variant === "info" ? theme.colors.status.info : variant === "neutral" ? theme.colors.text.muted : theme.colors.brand.primary; const display = count == null ? label : count > 99 ? "99+" : String(count); return <Animated.View accessibilityLabel={accessibilityLabel ?? display} style={[styles.badge, { backgroundColor: `${color}18`, flexDirection: isRTL ? "row-reverse" : "row" }, style]}>{dot ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}{display ? <Text variant="badge" align="center" style={{ color }}>{display}</Text> : null}</Animated.View>; }

export interface ChipProps { label: string; selected?: boolean; selectable?: boolean; dismissible?: boolean; icon?: React.ReactNode; onPress?: () => void; onDismiss?: () => void; style?: StyleProp<ViewStyle>; }
/** Selectable or dismissible compact action. */
export function Chip({ label, selected, selectable, dismissible, icon, onPress, onDismiss, style }: ChipProps): React.ReactElement { const { theme, isRTL } = useTheme(); return <PressableScale onPress={onPress} disabled={!onPress && !selectable} accessibilityRole={selectable ? "checkbox" : "button"} accessibilityState={{ selected, checked: selected }} style={[styles.chip, { backgroundColor: selected ? theme.colors.brand.primaryLight : theme.colors.canvas.surfaceMuted, borderColor: selected ? theme.colors.brand.primary : theme.colors.border.default, flexDirection: isRTL ? "row-reverse" : "row" }, style]}>{icon}<Text variant="caption" color={selected ? "brand" : "secondary"}>{label}</Text>{dismissible ? <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel={`Dismiss ${label}`}><Ionicons name="close" size={16} color={theme.colors.text.secondary} /></Pressable> : null}</PressableScale>; }

export interface AvatarProps { image?: ImageSourcePropType; initials?: string; size?: "sm" | "md" | "lg" | "xl" | number; status?: "online" | "offline" | string; accessibilityLabel?: string; }
/** Image avatar with initials fallback, loading skeleton, and status dot. */
export function Avatar({ image, initials = "", size = "md", status, accessibilityLabel }: AvatarProps): React.ReactElement { const { theme } = useTheme(); const px = typeof size === "number" ? size : { sm: 32, md: 44, lg: 64, xl: 96 }[size]; const [loaded, setLoaded] = useState(false); return <View accessibilityLabel={accessibilityLabel ?? initials} style={{ width: px, height: px }}>{image ? <Image source={image} onLoadEnd={() => setLoaded(true)} style={{ width: px, height: px, borderRadius: px / 2 }} /> : <View style={[styles.avatar, { width: px, height: px, borderRadius: px / 2, backgroundColor: theme.colors.brand.primaryLight }]}><Text variant="label" color="brand" align="center">{initials.slice(0, 2).toUpperCase()}</Text></View>}{image && !loaded ? <Skeleton variant="circle" width={px} height={px} style={StyleSheet.absoluteFill} /> : null}{status ? <View style={[styles.statusDot, { backgroundColor: status === "online" ? theme.colors.status.success : status === "offline" ? theme.colors.text.disabled : status }]} /> : null}</View>; }

export interface SkeletonProps { variant?: "rectangle" | "circle" | "text"; width?: number | `${number}%`; height?: number; borderRadius?: number; style?: StyleProp<ViewStyle>; }
/** Reanimated shimmer placeholder. */
export function Skeleton({ variant = "rectangle", width = "100%", height = variant === "text" ? 14 : 16, borderRadius, style }: SkeletonProps): React.ReactElement { const { theme } = useTheme(); const opacity = useSharedValue(0.35); useEffect(() => { opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true); return () => cancelAnimation(opacity); }, [opacity]); const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value })); return <Animated.View accessibilityLabel="Loading" style={[{ width, height, borderRadius: borderRadius ?? (variant === "circle" ? Number(height) / 2 : variant === "text" ? 4 : 8), backgroundColor: theme.colors.canvas.surfaceMuted }, animatedStyle, style]} />; }
export interface SkeletonCardProps { lines?: number; style?: StyleProp<ViewStyle>; }
export function SkeletonCard({ lines = 3, style }: SkeletonCardProps): React.ReactElement { return <Card style={style}><Skeleton height={120} /><View style={{ gap: 8, marginTop: 12 }}>{Array.from({ length: lines }, (_, index) => <Skeleton key={index} variant="text" width={index === lines - 1 ? "65%" : "100%"} />)}</View></Card>; }

export interface ProgressBarProps { value?: number; indeterminate?: boolean; color?: string; height?: number; accessibilityLabel?: string; }
/** Determinate or looping progress indicator. */
export function ProgressBar({ value = 0, indeterminate, color, height = 6, accessibilityLabel = "Progress" }: ProgressBarProps): React.ReactElement { const { theme, isRTL } = useTheme(); const progress = useSharedValue(0); useEffect(() => { progress.value = indeterminate ? withRepeat(withTiming(1, { duration: 1000 }), -1, false) : withTiming(Math.max(0, Math.min(1, value))); }, [indeterminate, progress, value]); const animatedStyle = useAnimatedStyle(() => ({ width: `${Math.max(indeterminate ? 25 : 0, progress.value * 100)}%`, transform: indeterminate ? [{ translateX: progress.value * 200 - 50 }] : [] })); return <View accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel} accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }} style={[styles.progressTrack, { height, backgroundColor: theme.colors.canvas.surfaceMuted, alignItems: isRTL ? "flex-end" : "flex-start" }]}><Animated.View style={[{ height: "100%", borderRadius: height / 2, backgroundColor: color ?? theme.colors.brand.primary }, animatedStyle]} /></View>; }

export interface StatusIndicatorProps { active?: boolean; pulse?: boolean; color?: string; label?: string; }
/** Online/offline dot with optional pulse. */
export function StatusIndicator({ active = false, pulse = false, color, label }: StatusIndicatorProps): React.ReactElement { const { theme, isRTL } = useTheme(); const opacity = useSharedValue(1); useEffect(() => { if (pulse) opacity.value = withRepeat(withTiming(0.25, { duration: 700 }), -1, true); return () => cancelAnimation(opacity); }, [opacity, pulse]); const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value })); const resolved = color ?? (active ? theme.colors.status.success : theme.colors.text.disabled); return <View accessibilityLabel={label ?? (active ? "Online" : "Offline")} style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", gap: 8 }}><Animated.View style={[styles.statusIndicator, { backgroundColor: resolved }, animatedStyle]} />{label ? <Text variant="caption">{label}</Text> : null}</View>; }

const styles = StyleSheet.create({
  text: { includeFontPadding: false, textAlignVertical: "center" },
  button: { minHeight: 48, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8 }, button_sm: { minHeight: 48, paddingHorizontal: 12 }, button_md: { minHeight: 48 }, button_lg: { minHeight: 56, paddingHorizontal: 24 }, full: { width: "100%", alignSelf: "stretch" },
  card: { overflow: "hidden" }, inputWrap: { minHeight: 48, borderWidth: 1, borderRadius: 12, alignItems: "center", paddingHorizontal: 12, gap: 8 }, input: { flex: 1, minHeight: 48, fontFamily: "Cairo_400Regular", fontSize: 14, paddingVertical: 0 },
  badge: { minHeight: 24, borderRadius: 9999, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", gap: 5 }, dot: { width: 7, height: 7, borderRadius: 4 }, chip: { minHeight: 48, borderRadius: 9999, borderWidth: 1, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", gap: 7 },
  avatar: { alignItems: "center", justifyContent: "center" }, statusDot: { position: "absolute", end: 0, bottom: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "white" },
  progressTrack: { width: "100%", borderRadius: 9999, overflow: "hidden" }, statusIndicator: { width: 10, height: 10, borderRadius: 5 },
});
