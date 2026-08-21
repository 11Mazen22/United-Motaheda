/**

 * CategoryCard — pill (horizontal strip) + grid (Shop tab) variants.

 *

 * Redesign (2026 visual pass):

 *   • Pill: clean surface card (no more noisy gradient), 48pt height,

 *     accent-tinted emoji disc, Cairo_700Bold label, optional count badge

 *     anchored to the trailing edge. Forced LTR-row by direction-aware

 *     flexRow() — works in both languages.

 *   • Grid: tall Flexbox column card. 60pt accent-tinted icon well at

 *     top, name + count stack, chevron pinned to the bottom *leading*

 *     edge via row-reverse trick. Strong elevation/shadow per platform.

 *   • All text routed through the `Text` atom with weight props so Cairo

 *     cannot be lost on re-render.

 *   • textAlign migrated from hardcoded "right" to textAlignStart(IS_RTL).

 *   • Chevron flips via FORWARD_CHEVRON (already RTL-aware constant).

 */



import React, { memo, useCallback } from "react";

import { Pressable, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import Animated, {

  useAnimatedStyle,

  useSharedValue,

  withSpring,

} from "react-native-reanimated";



import { Text as UIText } from "@pharmacy/ui-native";

import { kit } from "@pharmacy/ui-native";

import {

  isRtl,

  flexRow,

  textAlignStart,

  FORWARD_CHEVRON,

} from "../utils/layout";

import type { NativeCategory } from "../features/products/types";



// ─── Palette ─────────────────────────────────────────────────────────────────



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



const PALETTE: { accent: string; tint: string }[] = [

  { accent: kit.color.accentDeep, tint: kit.color.accentTint },

  { accent: kit.color.warn,       tint: kit.color.warnTint },

  { accent: kit.color.success,    tint: kit.color.successTint },

  { accent: "#db2777",            tint: "#fdf2f8" },

  { accent: "#7c3aed",            tint: "#f5f3ff" },

  { accent: "#0284c7",            tint: "#e0f2fe" },

  { accent: "#d97706",            tint: "#fffbeb" },

  { accent: "#16a34a",            tint: "#f0fdf4" },

  { accent: "#dc2626",            tint: "#fef2f2" },

  { accent: "#0ea5e9",            tint: "#f0f9ff" },

];



function paletteFor(idx: number) {

  return PALETTE[Math.abs(idx) % PALETTE.length];

}



// ─── Emoji map ───────────────────────────────────────────────────────────────



const EMOJI_MAP: Record<string, string> = {

  "العناية بالشعر":                  "💆",

  "العناية بالبشرة":                 "✨",

  "مستحضرات التجميل والمكياج":       "💄",

  "العناية بالفم والأسنان":           "🦷",

  "العطور والروائح":                  "🌸",

  "الإسعافات الأولية والمطهرات":      "🩹",

  "الفيتامينات والمكملات الغذائية":   "💊",

  "المستلزمات الطبية":                "🩺",

  "الرعاية الصحية العامة":            "❤️",

  "العناية بالجسم":                   "🧴",

  "العناية بالعيون":                  "👁️",

  "صحة المرأة":                       "🌷",

  "الأطفال والرضع":                   "👶",

  "أدوية":                            "💊",

  "العناية بالرجل":                   "🪒",

  "الأم والطفل":                      "🤱",

  "التغذية الطبية":                   "🥗",

};



export function emojiFor(name: string): string {

  return EMOJI_MAP[name] ?? "🏥";

}



function formatCount(n: number): string {

  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;

  return String(n);

}



// ─── Props ───────────────────────────────────────────────────────────────────



export interface CategoryCardProps {

  category:    NativeCategory;

  gradientIdx: number;

  lang:        "ar" | "en";

  variant?:    "pill" | "grid" | "pastel";

  onPress:     () => void;

  active?:     boolean;

}



const SPRING_IN  = { damping: 10, stiffness: 380 } as const;

const SPRING_OUT = { damping: 14, stiffness: 280 } as const;



// ═══════════════════════════════════════════════════════════════════════════════

// CategoryCard

// ═══════════════════════════════════════════════════════════════════════════════



export const CategoryCard = memo(function CategoryCard({

  category,

  gradientIdx,

  lang,

  variant = "pill",

  onPress,

  active = false,

}: CategoryCardProps) {

  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({

    transform: [{ scale: scale.value }],

  }));



  const onPressIn  = useCallback(() => { scale.value = withSpring(0.95, SPRING_IN); },  [scale]);

  const onPressOut = useCallback(() => { scale.value = withSpring(1.0,  SPRING_OUT); }, [scale]);



  const { accent, tint } = paletteFor(gradientIdx);

  const displayName      = lang === "en" ? (category.nameEn || category.name) : (category.name || category.nameEn);

  const emoji            = emojiFor(category.name);

  const showCount        = category.count > 0;



  // ── Pill variant — horizontal strip on Home ──────────────────────────────



  if (variant === "pill") {

    return (

      <Pressable

        onPress={onPress}

        onPressIn={onPressIn}

        onPressOut={onPressOut}

        accessibilityRole="button"

        accessibilityLabel={displayName}

        hitSlop={4}>

        <Animated.View

          style={[

            cs.pill,

            active && [cs.pillActive, { borderColor: accent, backgroundColor: tint }],

            animStyle,

          ]}>

          <View style={[cs.pillEmojiDisc, { backgroundColor: tint, borderColor: accent + "33" }]}>

            <UIText style={cs.pillEmoji}>{emoji}</UIText>

          </View>



          <UIText

            weight="bold"

            numberOfLines={1}

            style={[cs.pillLabel, active && { color: accent }]}>

            {displayName}

          </UIText>



          {showCount && (

            <View style={[cs.pillCount, { backgroundColor: accent + "14" }]}>

              <UIText weight="black" style={[cs.pillCountText, { color: accent }]}>

                {formatCount(category.count)}

              </UIText>

            </View>

          )}

        </Animated.View>

      </Pressable>

    );

  }



  // ── Grid variant — Shop tab "جميع الأقسام" ──────────────────────────────



  return (

    <Pressable

      onPress={onPress}

      onPressIn={onPressIn}

      onPressOut={onPressOut}

      accessibilityRole="button"

      accessibilityLabel={displayName}

      style={cs.gridOuter}>

      <Animated.View style={[cs.gridCard, animStyle]}>



        {/* 5pt identity stripe */}

        <View style={[cs.stripe, { backgroundColor: accent }]} />



        <View style={cs.gridBody}>

          {/* Icon well — sits at the top */}

          <View style={[cs.iconWell, { backgroundColor: tint, borderColor: accent + "22" }]}>

            <UIText style={cs.gridEmoji}>{emoji}</UIText>

          </View>



          {/* Name — flex:1 so it pushes the footer down */}

          <UIText

            weight="black"

            numberOfLines={2}

            style={cs.gridName}>

            {displayName}

          </UIText>



          {/* Footer: count + chevron at the bottom *leading* edge */}

          {/*

            We use flexRow(IS_RTL) which yields "row" in RTL (forceRTL active)

            so the chevron renders on the visual left (RTL leading) and the

            count on the visual right. FORWARD_CHEVRON already picks the

            correct glyph per direction.

          */}

          <View style={[cs.gridFoot, { flexDirection: flexRow(IS_RTL) }]}>

            <View style={[cs.chevronWell, { backgroundColor: accent + "12" }]}>

              <Ionicons name={FORWARD_CHEVRON} size={14} color={accent} />

            </View>

            {showCount && (

              <UIText weight="bold" style={cs.gridCount}>

                {formatCount(category.count)}{lang === "ar" ? " منتج" : " items"}

              </UIText>

            )}

          </View>

        </View>



      </Animated.View>

    </Pressable>

  );

});



export default CategoryCard;



// ─── Skeletons ───────────────────────────────────────────────────────────────



export const CategoryCardSkeleton = memo(function CategoryCardSkeleton() {

  return <View style={cs.pillSkeleton} />;

});



export const CategoryGridSkeleton = memo(function CategoryGridSkeleton() {

  return (

    <View style={cs.gridOuter}>

      <View style={[cs.gridCard, cs.skeletonCard]}>

        <View style={cs.skeletonStripe} />

        <View style={cs.gridBody}>

          <View style={cs.skeletonIcon} />

          <View style={cs.skeletonLine} />

          <View style={[cs.skeletonLine, cs.skeletonShort]} />

        </View>

      </View>

    </View>

  );

});



// ═══════════════════════════════════════════════════════════════════════════════

// Styles

// ═══════════════════════════════════════════════════════════════════════════════



const cs = StyleSheet.create({

  // ── Pill (horizontal strip) ────────────────────────────────────────────────

  pill: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               10,

    width:             172,

    height:            56,

    paddingHorizontal: 14,

    paddingEnd:        16,

    borderRadius:      kit.radius.pill,

    backgroundColor:   kit.color.surface,

    borderWidth:       1,

    borderColor:       kit.color.line,

    ...kit.shadow.raised,

  },

  pillActive: {

    borderWidth: 1.5,

    ...kit.shadow.glow,

  },

  pillEmojiDisc: {

    width:          36,

    height:         36,

    borderRadius:   18,

    alignItems:     "center",

    justifyContent: "center",

    borderWidth:    1,

    flexShrink:     0,

  },

  pillEmoji: {

    fontSize:   18,

    lineHeight: 22,

  },

  pillLabel: {

    flex:               1,

    fontSize:           13,

    lineHeight:         18,

    color:              kit.color.ink,

    textAlign:          TEXT_START,

    includeFontPadding: false,

    letterSpacing:      -0.1,

  },

  pillCount: {

    paddingHorizontal: 9,

    paddingVertical:   3,

    borderRadius:      999,

    minWidth:          28,

    alignItems:        "center",

    justifyContent:    "center",

    flexShrink:        0,

  },

  pillCountText: {

    fontSize:           10,

    lineHeight:         14,

    letterSpacing:      0.3,

    includeFontPadding: false,

  },

  pillSkeleton: {

    width:           172,

    height:          56,

    borderRadius:    kit.radius.pill,

    backgroundColor: kit.color.well,

    ...kit.shadow.raised,

  },



  // ── Grid card (Shop tab) ──────────────────────────────────────────────────

  gridOuter: {

    width: "100%",

  },

  gridCard: {

    backgroundColor: kit.color.surface,

    borderRadius:    kit.radius.lg,

    borderWidth:     1,

    borderColor:     kit.color.line,

    overflow:        "hidden",

    minHeight:       170,

    ...kit.shadow.raised,

  },

  stripe: {

    height: 5,

    width:  "100%",

  },

  gridBody: {

    padding: 16,

    gap:     12,

    flex:    1,

  },

  iconWell: {

    width:          60,

    height:         60,

    borderRadius:   20,

    alignItems:     "center",

    justifyContent: "center",

    borderWidth:    1,

  },

  gridEmoji: {

    fontSize:   28,

    lineHeight: 34,

  },

  gridName: {

    fontSize:           15,

    lineHeight:         21,

    color:              kit.color.ink,

    letterSpacing:      -0.2,

    textAlign:          TEXT_START,

    includeFontPadding: false,

    flexGrow:           1,

  },

  gridFoot: {

    alignItems:     "center",

    justifyContent: "space-between",

    gap:            8,

    marginTop:      4,

  },

  chevronWell: {

    width:          28,

    height:         28,

    borderRadius:   10,

    alignItems:     "center",

    justifyContent: "center",

    flexShrink:     0,

  },

  gridCount: {

    fontSize:           11,

    lineHeight:         15,

    color:              kit.color.inkFaint,

    letterSpacing:      0.3,

    textAlign:          TEXT_START,

    includeFontPadding: false,

    flexShrink:         1,

  },



  // ── Grid skeleton ─────────────────────────────────────────────────────────

  skeletonCard: {

    borderColor: "transparent",

  },

  skeletonStripe: {

    height:          5,

    backgroundColor: kit.color.well,

  },

  skeletonIcon: {

    width:           60,

    height:          60,

    borderRadius:    20,

    backgroundColor: kit.color.well,

  },

  skeletonLine: {

    height:          11,

    borderRadius:    6,

    backgroundColor: kit.color.well,

  },

  skeletonShort: {

    width: "55%",

  },

});

