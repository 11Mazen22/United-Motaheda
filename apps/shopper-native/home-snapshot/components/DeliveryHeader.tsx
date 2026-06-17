/**
 * DeliveryHeader — Elite 2026 redesign.
 *
 * Soft teal→canvas gradient hero: gives the home screen depth without
 * going back to the dark navy era. Highlights strip below the greeting
 * (three semantic metric pills) creates a "smart dashboard" impression.
 * Notification bell slot added (optional prop — skipped when unset).
 *
 * Performance contract kept: memo'd, no entrance animations, stable callbacks.
 */

import React, { memo, useMemo } from "react";
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "../shared/ui/Text";
import { theme } from "../shared/theme";
import { AppLogo } from "../shared/components/AppLogo";
import { flexRow, isRtl, textAlignStart } from "../utils/layout";
import { kit } from "../shared/kit";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// Time-of-day icon
function getTimeIcon(): React.ComponentProps<typeof Ionicons>["name"] {
	const h = new Date().getHours();
	if (h >= 5  && h < 12) return "sunny-outline";
	if (h >= 12 && h < 18) return "partly-sunny-outline";
	return "moon-outline";
}

// Module-level metric pills — no re-allocation per render
const METRIC_PILLS = [
	{ icon: "shield-checkmark" as const, labelKey: "home.metricOriginal", tint: kit.color.accentTint, color: kit.color.accentDeep },
	{ icon: "flash"            as const, labelKey: "home.metricFast",     tint: kit.color.warnTint,   color: kit.color.warn       },
	{ icon: "medical"          as const, labelKey: "home.metricSupport",  tint: kit.color.successTint, color: kit.color.success   },
] as const;

interface DeliveryHeaderProps {
	insets:          { top: number };
	user:            { name?: string | null } | null;
	cartCount:       number;
	onCartPress:     () => void;
	onSearchPress:   () => void;
	onNotifPress?:   () => void;
}

export const DeliveryHeader = memo(function DeliveryHeader({
	insets,
	user,
	cartCount,
	onCartPress,
	onSearchPress,
	onNotifPress,
}: DeliveryHeaderProps) {
	const { t }  = useTranslation();
	const router = useRouter();

	const timeIcon = useMemo(() => getTimeIcon(), []);

	const greeting = user?.name
		? t("home.greeting",      { name: user.name.split(" ")[0] })
		: t("home.greetingGuest");

	return (
		<View style={[s.header, { paddingTop: insets.top + 14 }]}>

			{/* ── Top bar: brand ←→ (notifications + cart) ── */}
			<View style={s.topBar}>
				<View style={s.logoWrap}>
					<AppLogo size={40} />
				</View>
				<View style={s.topActions}>
					{onNotifPress && (
						<Pressable
							onPress={() => {
								if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
								onNotifPress();
							}}
							accessibilityRole="button"
							accessibilityLabel={t("profile.notifications")}
							style={s.actionBtn}>
							<Ionicons name="notifications-outline" size={19} color={kit.color.inkSoft} />
						</Pressable>
					)}
					<Pressable
						onPress={() => {
							if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
							onCartPress();
						}}
						accessibilityRole="button"
						accessibilityLabel={t("tabs.cart")}
						style={s.cartBtn}>
						<Ionicons name="bag-outline" size={19} color={kit.color.inkSoft} />
						{cartCount > 0 && (
							<View style={s.cartBadge}>
								<UIText style={s.cartBadgeText}>{cartCount > 9 ? "9+" : cartCount}</UIText>
							</View>
						)}
					</Pressable>
				</View>
			</View>

			{/* ── Headline + highlights strip ── */}
			<View style={s.headingStack}>
				<View style={s.greetingRow}>
					<View style={s.greetingIconWrap}>
						<Ionicons name={timeIcon} size={12} color={kit.color.accentDeep} />
					</View>
					<UIText style={s.greetingText}>{greeting}</UIText>
				</View>

				<UIText style={s.heroTitle}>{t("home.heroTaglineTitle")}</UIText>
				<UIText style={s.heroSub}>{t("home.heroTaglineSub")}</UIText>

				{/* Smart-dashboard metric strip */}
				<View style={s.metricRow}>
					{METRIC_PILLS.map((pill) => (
						<View key={pill.labelKey} style={[s.metricPill, { backgroundColor: pill.tint }]}>
							<Ionicons name={pill.icon} size={11} color={pill.color} />
							<UIText style={[s.metricText, { color: pill.color }]}>
								{t(pill.labelKey)}
							</UIText>
						</View>
					))}
				</View>
			</View>

			{/* ── Search pill — floating, routes to search tab ── */}
			<Pressable
				onPress={onSearchPress}
				accessibilityRole="button"
				accessibilityLabel={t("search.placeholder")}
				style={s.searchBar}>
				<View style={s.searchIconWrap}>
					<Ionicons name="search" size={17} color={kit.color.inkFaint} />
				</View>
				<UIText style={s.searchPlaceholder} numberOfLines={1}>
					{t("search.placeholder")}
				</UIText>
				<View style={[s.searchBadge, { backgroundColor: kit.color.accent }]}>
					<Ionicons name="sparkles" size={13} color={kit.color.onInk} />
				</View>
			</Pressable>

			{/* ── Quick-access chips ── */}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={s.chipScroll}
				contentContainerStyle={s.chipRow}>

				<Pressable
					onPress={() => router.push("/deals")}
					style={[s.chip, { backgroundColor: kit.color.dangerTint }]}
					accessibilityRole="button">
					<Ionicons name="flame" size={13} color={kit.color.danger} />
					<UIText numberOfLines={1} style={[s.chipText, { color: kit.color.danger }]}> 
						{t("home.flashTitle")}
					</UIText>
				</Pressable>

				<Pressable
					onPress={() => router.push("/featured")}
					style={[s.chip, { backgroundColor: kit.color.warnTint }]}
					accessibilityRole="button">
					<Ionicons name="star" size={13} color={kit.color.warn} />
					<UIText numberOfLines={1} style={[s.chipText, { color: kit.color.warn }]}> 
						{t("home.featuredTitle")}
					</UIText>
				</Pressable>

				<Pressable
					onPress={() => router.push("/(tabs)/meds" as Parameters<typeof router.push>[0])}
					style={[s.chip, { backgroundColor: kit.color.accentTint }]}
					accessibilityRole="button">
					<Ionicons name="medical-outline" size={13} color={kit.color.accentDeep} />
					<UIText numberOfLines={1} style={[s.chipText, { color: kit.color.accentDeep }]}> 
						{t("home.qaRx")}
					</UIText>
				</Pressable>

				<Pressable
					onPress={() => router.push("/(tabs)/products")}
					style={[s.chip, s.chipNeutral]}
					accessibilityRole="button">
					<Ionicons name="grid-outline" size={13} color={kit.color.inkSoft} />
					<UIText numberOfLines={1} style={[s.chipText, { color: kit.color.inkSoft }]}> 
						{t("products.allProducts")}
					</UIText>
				</Pressable>
			</ScrollView>
		</View>
	);
});

const s = StyleSheet.create({
	header: {
		backgroundColor:   kit.color.canvas,
		paddingBottom:     kit.sp(5),
		paddingHorizontal: theme.layout.pagePaddingH,
	},

	// ── Top bar ──
	topBar: {
		flexDirection:  flexRow(IS_RTL),
		alignItems:     "center",
		justifyContent: "space-between",
		marginBottom:   kit.sp(5),
	},
	logoWrap: {
		width:           48,
		height:          48,
		borderRadius:    16,
		backgroundColor: kit.color.surface,
		borderWidth:     1,
		borderColor:     kit.color.line,
		alignItems:      "center",
		justifyContent:  "center",
		overflow:        "hidden",
		...kit.shadow.raised,
	},
	topActions: {
		flexDirection: flexRow(IS_RTL),
		alignItems:    "center",
		gap:           8,
	},
	actionBtn: {
		width:           44,
		height:          44,
		borderRadius:    22,
		backgroundColor: kit.color.surface,
		borderWidth:     1,
		borderColor:     kit.color.line,
		alignItems:      "center",
		justifyContent:  "center",
	},
	cartBtn: {
		width:           44,
		height:          44,
		borderRadius:    22,
		backgroundColor: kit.color.surface,
		borderWidth:     1,
		borderColor:     kit.color.line,
		alignItems:      "center",
		justifyContent:  "center",
	},
	cartBadge: {
		position:          "absolute",
		top:               -4,
		end:               -4,
		backgroundColor:   kit.color.accent,
		borderRadius:      9,
		minWidth:          18,
		height:            18,
		alignItems:        "center",
		justifyContent:    "center",
		paddingHorizontal: 4,
		borderWidth:       1.5,
		borderColor:       kit.color.canvas,
	},
	cartBadgeText: {
		color:              kit.color.onInk,
		fontSize:           9,
		lineHeight:         12,
		fontFamily:         theme.fonts.black,
		includeFontPadding: false,
		textAlign:          "center",
	},

	// ── Heading + highlights strip ──
	headingStack: {
		gap:          kit.sp(2),
		marginBottom: kit.sp(5),
	},
	greetingRow: {
		flexDirection: flexRow(IS_RTL),
		alignItems:    "center",
		gap:           8,
	},
	greetingIconWrap: {
		width:           26,
		height:          26,
		borderRadius:    9,
		alignItems:      "center",
		justifyContent:  "center",
		backgroundColor: kit.color.accentTint,
	},
	greetingText: {
		fontFamily:         theme.fonts.bold,
		fontSize:           12,
		lineHeight:         18,
		color:              kit.color.inkSoft,
		textAlign:          TEXT_START,
		includeFontPadding: false,
	},
	heroTitle: {
		fontFamily:         theme.fonts.black,
		fontSize:           kit.type.display.fontSize,
		lineHeight:         kit.type.display.lineHeight,
		color:              kit.color.ink,
		textAlign:          TEXT_START,
		includeFontPadding: false,
	},
	heroSub: {
		fontFamily:         theme.fonts.regular,
		fontSize:           13,
		lineHeight:         20,
		color:              kit.color.inkSoft,
		textAlign:          TEXT_START,
		includeFontPadding: false,
	},
	metricRow: {
		flexDirection: flexRow(IS_RTL),
		flexWrap:      "wrap",
		gap:           8,
		marginTop:     kit.sp(1),
	},
	metricPill: {
		flexDirection:     flexRow(IS_RTL),
		alignItems:        "center",
		gap:               5,
		paddingHorizontal: 10,
		paddingVertical:   5,
		borderRadius:      kit.radius.pill,
	},
	metricText: {
		fontFamily:         theme.fonts.bold,
		fontSize:           10,
		lineHeight:         15,
		includeFontPadding: false,
	},

	// ── Search pill ──
	searchBar: {
		flexDirection:     flexRow(IS_RTL),
		alignItems:        "center",
		gap:               4,
		height:            60,
		paddingHorizontal: 8,
		backgroundColor:   kit.color.surface,
		borderRadius:      kit.radius.pill,
		borderWidth:       1,
		borderColor:       kit.color.line,
		...kit.shadow.floating,
	},
	searchIconWrap: {
		width:  40,
		height: 40,
		alignItems:      "center",
		justifyContent:  "center",
	},
	searchPlaceholder: {
		flex:               1,
		fontSize:           14,
		lineHeight:         20,
		fontFamily:         theme.fonts.semibold,
		color:              kit.color.inkFaint,
		textAlign:          TEXT_START,
		includeFontPadding: false,
	},
	searchBadge: {
		width:          44,
		height:         44,
		borderRadius:   22,
		alignItems:     "center",
		justifyContent: "center",
	},

	// ── Quick-access chips ──
	chipScroll: { marginTop: kit.sp(3) },
	chipRow: {
		flexDirection: flexRow(IS_RTL),
		alignItems:    "center",
		gap:           8,
	},
	chip: {
		flexDirection:     flexRow(IS_RTL),
		alignItems:        "center",
		gap:               6,
		height:            40,
		borderRadius:      kit.radius.pill,
		paddingHorizontal: 14,
	},
	chipNeutral: {
		backgroundColor: kit.color.surface,
		borderWidth:     1,
		borderColor:     kit.color.line,
	},
	chipText: {
		fontFamily:         theme.fonts.bold,
		fontSize:           12,
		lineHeight:         18,
		includeFontPadding: false,
	},
});