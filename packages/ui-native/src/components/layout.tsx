import React, { memo, useCallback } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, PressableScale, Text } from "./primitives";
import { useTheme } from "../theme";
import { Illustration, type IllustrationName } from "../illustrations";
import { LottieMoment, type LottieSource } from "../lottie";

export interface ScreenProps { children: React.ReactNode; safeArea?: boolean; edgeToEdge?: boolean; keyboardAvoiding?: boolean; scroll?: boolean; edgeTop?: boolean; edgeBottom?: boolean; background?: string; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; scrollProps?: Omit<ScrollViewProps, "children" | "contentContainerStyle">; }
/** Safe-area, scrolling, and keyboard-aware screen root. */
export function Screen({ children, safeArea = false, edgeToEdge = false, keyboardAvoiding = false, scroll = false, edgeTop = false, edgeBottom = false, background, style, contentStyle, scrollProps }: ScreenProps): React.ReactElement { const insets = useSafeAreaInsets(); const { theme } = useTheme(); const useTop = !edgeToEdge && (safeArea || edgeTop); const useBottom = !edgeToEdge && (safeArea || edgeBottom); let content: React.ReactNode = scroll ? <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} {...scrollProps} contentContainerStyle={contentStyle}>{children}</ScrollView> : <View style={[styles.flex, contentStyle]}>{children}</View>; if (keyboardAvoiding) content = <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>{content}</KeyboardAvoidingView>; return <View style={[styles.screen, { backgroundColor: background ?? theme.colors.canvas.background, paddingTop: useTop ? insets.top : 0, paddingBottom: useBottom ? insets.bottom : 0 }, style]}>{content}</View>; }

export interface EmptyStateProps { illustration?: React.ReactNode; illustrationName?: IllustrationName; lottieSource?: LottieSource; icon?: React.ComponentProps<typeof Ionicons>["name"]; title: string; subtitle?: string; action?: { label: string; onPress: () => void }; style?: StyleProp<ViewStyle>; }
/** Fade-in empty state with optional primary recovery action. `illustrationName`/`lottieSource` are shorthands over the bundled art system (A11); `illustration` still accepts any custom node; `icon` is a lightweight shorthand for a single muted Ionicon when a full illustration isn't warranted. */
export function EmptyState({ illustration, illustrationName, lottieSource, icon, title, subtitle, action, style }: EmptyStateProps): React.ReactElement {
  const { theme } = useTheme();
  const art = lottieSource
    ? <LottieMoment source={lottieSource} fallback={illustrationName ? <Illustration name={illustrationName} /> : illustration} />
    : illustration ?? (illustrationName ? <Illustration name={illustrationName} /> : icon ? <Ionicons name={icon} size={44} color={theme.colors.text.muted} /> : null);
  return <Animated.View entering={FadeIn} accessibilityLabel={title} style={[styles.state, style]}>{art}<Text variant="h3" align="center">{title}</Text>{subtitle ? <Text color="secondary" align="center">{subtitle}</Text> : null}{action ? <Button label={action.label} onPress={action.onPress} /> : null}</Animated.View>;
}

export interface ErrorStateProps { message: string; retry?: () => void | Promise<void>; details?: string; style?: StyleProp<ViewStyle>; }
/** Error message with an async retry button and live-region announcement. */
export function ErrorState({ message, retry, details, style }: ErrorStateProps): React.ReactElement { const [loading, setLoading] = React.useState(false); const handleRetry = async () => { if (!retry) return; setLoading(true); try { await retry(); } finally { setLoading(false); } }; return <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.state, style]}><Ionicons name="alert-circle-outline" size={40} color="#DC2626" /><Text variant="h3" align="center">{message}</Text>{details ? <Text color="secondary" align="center">{details}</Text> : null}{retry ? <Button title="Retry" loading={loading} onPress={handleRetry} /> : null}</View>; }

export interface SectionProps { title?: string; subtitle?: string; actionLabel?: string; onAction?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; }
export function Section({ title, subtitle, actionLabel, onAction, children, style }: SectionProps): React.ReactElement { return <View style={[{ gap: 12 }, style]}>{title || actionLabel ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><View style={{ flex: 1 }}>{title ? <Text variant="section-head">{title}</Text> : null}{subtitle ? <Text variant="caption" color="secondary">{subtitle}</Text> : null}</View>{actionLabel ? <Button label={actionLabel} variant="ghost" size="sm" onPress={onAction ?? (() => undefined)} /> : null}</View> : null}{children}</View>; }
export interface RowProps { children: React.ReactNode; gap?: number; align?: ViewStyle["alignItems"]; justify?: ViewStyle["justifyContent"]; reverse?: boolean; style?: StyleProp<ViewStyle>; }
export function Row({ children, gap = 8, align = "center", justify, reverse, style }: RowProps): React.ReactElement { return <View style={[{ flexDirection: reverse ? "row-reverse" : "row", gap, alignItems: align, justifyContent: justify }, style]}>{children}</View>; }
export function Stack({ children, gap = 8, style }: Pick<RowProps, "children" | "gap" | "style">): React.ReactElement { return <View style={[{ gap }, style]}>{children}</View>; }
export function Spacer({ size = 8 }: { size?: number }): React.ReactElement { return <View style={{ width: size, height: size }} />; }
export function LoadingOverlay({ visible = true, label = "Loading" }: { visible?: boolean; label?: string }): React.ReactElement | null { const { theme } = useTheme(); if (!visible) return null; return <View accessibilityLabel={label} accessibilityRole="progressbar" style={[StyleSheet.absoluteFill, styles.loading, { backgroundColor: theme.colors.canvas.overlay }]}><ActivityIndicator size="large" color={theme.colors.brand.primary} /></View>; }

export interface IconButtonProps { icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void; tone?: "surface" | "ink"; size?: number; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel: string; }
export function IconButton({ icon, onPress, tone = "surface", size = 48, disabled, style, accessibilityLabel }: IconButtonProps): React.ReactElement { const { theme } = useTheme(); const ink = tone === "ink"; return <PressableScale onPress={onPress} disabled={disabled} haptic scaleFactor={0.92} accessibilityLabel={accessibilityLabel} style={[styles.iconButton, { width: size, height: size, borderRadius: size / 2, backgroundColor: ink ? theme.colors.text.primary : theme.colors.canvas.surface, borderColor: theme.colors.border.default }, style]}><Ionicons name={icon} size={Math.round(size * 0.42)} color={disabled ? theme.colors.text.disabled : ink ? theme.colors.text.inverse : theme.colors.text.secondary} /></PressableScale>; }
export function MetaDot(): React.ReactElement { const { theme } = useTheme(); return <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.colors.text.muted }} />; }

export interface SegmentOption<T extends string> { value: T; label: string; icon?: React.ComponentProps<typeof Ionicons>["name"]; }
export interface SegmentedToggleProps<T extends string> { value: T; onChange: (value: T) => void; options: ReadonlyArray<SegmentOption<T>>; size?: "sm" | "md" | "lg"; disabled?: boolean; }
function SegmentedToggleInner<T extends string>({ value, onChange, options, size = "lg", disabled = false }: SegmentedToggleProps<T>): React.ReactElement { const { theme } = useTheme(); const handlePress = useCallback((next: T) => { if (disabled || next === value) return; void Haptics.selectionAsync().catch(() => undefined); onChange(next); }, [disabled, onChange, value]); return <View accessibilityRole="radiogroup" style={[styles.segmentTrack, { minHeight: size === "lg" ? 54 : size === "md" ? 48 : 42, backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default, flexDirection: "row", opacity: disabled ? 0.55 : 1 }]}>{options.map((option) => { const selected = option.value === value; return <PressableScale key={option.value} onPress={() => handlePress(option.value)} disabled={disabled} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ selected, disabled }} style={[styles.segment, selected && { backgroundColor: theme.colors.text.primary }]}>{option.icon ? <Ionicons name={option.icon} size={16} color={selected ? theme.colors.text.inverse : theme.colors.text.secondary} /> : null}<Text variant="caption" align="center" numberOfLines={1} adjustsFontSizeToFit style={{ color: selected ? theme.colors.text.inverse : theme.colors.text.secondary }}>{option.label}</Text></PressableScale>; })}</View>; }
export const SegmentedToggle = memo(SegmentedToggleInner) as typeof SegmentedToggleInner;

const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, state: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }, loading: { alignItems: "center", justifyContent: "center", zIndex: 999 }, iconButton: { minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1 }, segmentTrack: { width: "100%", padding: 3, borderRadius: 9999, borderWidth: 1, gap: 3 }, segment: { flex: 1, minHeight: 42, borderRadius: 9999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10 } });
