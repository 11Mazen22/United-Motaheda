/**
 * DailyEdit — Editorial product trio (1 hero + 2 supporting).
 *
 * Pulls from the featured-products feed but presents it as a magazine spread,
 * not a flat carousel. The first product becomes a full-bleed horizontal
 * editorial card with image + descriptive body + CTA; products 2–3 sit
 * underneath as compact split-width cards.
 *
 * Self-contained: owns its own query subscription so the parent HomeScreen
 * never re-renders for this section.
 *
 *   ┌──────────────────────────────────────────┐
 *   │  EDITORIAL HERO          [image]  body   │  ← Product #1
 *   │                                          │
 *   ├─────────────────────┬────────────────────┤
 *   │   Product #2        │   Product #3       │  ← compact ProductCards
 *   └─────────────────────┴────────────────────┘
 */

import React, { memo, useCallback } from "react";
import { Dimensions, Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { ProductCard } from "@/components/ProductCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import { fetchFeaturedProducts, productKeys } from "@/features/products";
import { formatPrice } from "@/utils/format";
import type { NativeProduct } from "@/features/products";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const SCREEN_W = Dimensions.get("window").width;
const PAGE_H   = theme.layout.pagePaddingH;
const GAP      = 10;
// Two compact cards under the hero — split evenly
const COMPACT_W = Math.floor((SCREEN_W - PAGE_H * 2 - GAP) / 2);

const EDIT_LIMIT = 6;
const STALE_MS   = 90_000;

const COPY = IS_RTL
  ? {
      eyebrow:  "اختيار اليوم",
      title:    "مختارة بعناية",
      heroLead: "اختيار الصيدلي",
      shopNow:  "شاهد التفاصيل",
    }
  : {
      eyebrow:  "Today's Edit",
      title:    "Hand-picked for you",
      heroLead: "Pharmacist's choice",
      shopNow:  "See details",
    };

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DailyEditProps {
  lang:           "ar" | "en";
  onProductPress: (id: string) => void;
  onViewAll?:     () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const DailyEdit = memo(function DailyEdit({
  lang,
  onProductPress,
  onViewAll,
}: DailyEditProps) {
  const { data, isLoading } = useQuery<NativeProduct[]>({
    queryKey:  productKeys.featured(EDIT_LIMIT),
    queryFn:   () => fetchFeaturedProducts(EDIT_LIMIT),
    staleTime: STALE_MS,
    gcTime:    5 * 60_000,
  });

  const products = data ?? [];

  // Need at least 3 products to justify the editorial layout
  if (!isLoading && products.length < 3) return null;
  if (isLoading || products.length === 0) return null;

  const [hero, second, third] = products;

  return (
    <View style={sectionStyles.wrap}>
      <HomeSectionHeader
        eyebrow={COPY.eyebrow}
        title={COPY.title}
        icon="bookmark-outline"
        accent={kit.color.accentDeep}
        onMore={onViewAll}
      />

      <View style={s.body}>
        {/* Hero editorial card */}
        <EditorialHeroCard
          product={hero}
          lang={lang}
          onPress={() => onProductPress(hero.id)}
        />

        {/* Compact split row */}
        <View style={s.compactRow}>
          <View style={{ width: COMPACT_W }}>
            <ProductCard
              product={second}
              lang={lang}
              onPress={() => onProductPress(second.id)}
            />
          </View>
          <View style={{ width: COMPACT_W }}>
            <ProductCard
              product={third}
              lang={lang}
              onPress={() => onProductPress(third.id)}
            />
          </View>
        </View>
      </View>
    </View>
  );
});

// ─── EditorialHeroCard ───────────────────────────────────────────────────────

interface EditorialHeroCardProps {
  product: NativeProduct;
  lang:    "ar" | "en";
  onPress: () => void;
}

const EditorialHeroCard = memo(function EditorialHeroCard({
  product,
  lang,
  onPress,
}: EditorialHeroCardProps) {
  const displayName = lang === "ar" ? (product.nameAr ?? product.name) : (product.name ?? product.nameAr);
  const category    = product.categoryName ?? "";
  const isSale      = Boolean(product.isSale);
  const isNew       = Boolean(product.isNew);

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={displayName ?? ""}
      style={({ pressed }) => [s.heroCard, pressed && s.heroCardPressed]}>

      {/* Image side */}
      <View style={s.heroImageWrap}>
        {product.imageUrl ? (
          <Image
            source={{ uri: product.imageUrl }}
            style={s.heroImage}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <View style={s.heroImageEmpty}>
            <Ionicons name="medkit-outline" size={36} color={kit.color.inkFaint} />
          </View>
        )}
        {(isSale || isNew) && (
          <View style={[s.heroBadge, { backgroundColor: isSale ? kit.color.danger : kit.color.accentDeep }]}>
            <UIText style={s.heroBadgeText}>
              {isSale ? (IS_RTL ? "تخفيض" : "Sale") : (IS_RTL ? "جديد" : "New")}
            </UIText>
          </View>
        )}
      </View>

      {/* Body side */}
      <View style={s.heroBody}>
        <UIText style={s.heroEyebrow}>{COPY.heroLead}</UIText>
        <UIText style={s.heroName} numberOfLines={2}>
          {displayName}
        </UIText>
        {Boolean(category) && (
          <UIText style={s.heroCategory} numberOfLines={1}>
            {category}
          </UIText>
        )}

        <View style={s.heroFoot}>
          <UIText style={s.heroPrice}>{formatPrice(product.price)}</UIText>
          <View style={s.heroCta}>
            <UIText style={s.heroCtaText}>{COPY.shopNow}</UIText>
            <Ionicons name={FORWARD_CHEVRON} size={13} color={kit.color.onAccent} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  body: {
    paddingHorizontal: PAGE_H,
    gap:               GAP,
  },

  // ── Hero editorial card (1+2 layout top) ─────────────────────────────────
  heroCard: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "stretch",
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    minHeight:       160,
    ...kit.shadow.raised,
  },
  heroCardPressed: { opacity: 0.92 },

  heroImageWrap: {
    width:           140,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    padding:         kit.sp(2),
  },
  heroImage: {
    width:  "100%",
    height: "100%",
  },
  heroImageEmpty: {
    width:           "100%",
    height:          "100%",
    alignItems:      "center",
    justifyContent:  "center",
  },
  heroBadge: {
    position:          "absolute",
    top:               10,
    start:             10,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
  },
  heroBadgeText: {
    fontFamily:         theme.fonts.black,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.onAccent,
    letterSpacing:      0.6,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },

  heroBody: {
    flex:              1,
    paddingHorizontal: kit.sp(4),
    paddingVertical:   kit.sp(4),
    justifyContent:    "space-between",
    gap:               6,
  },
  heroEyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.8,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  heroName: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    lineHeight:         21,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  heroCategory: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  heroFoot: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            8,
    marginTop:      6,
  },
  heroPrice: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         22,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  heroCta: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 12,
    paddingVertical:   7,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentDeep,
  },
  heroCtaText: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.onAccent,
    includeFontPadding: false,
  },

  // ── Compact row underneath ───────────────────────────────────────────────
  compactRow: {
    flexDirection: flexRow(IS_RTL),
    gap:           GAP,
  },
});
