/**

 * DailyEdit — 2026 Premium Redesign ("الأكثر طلباً" / "مقترح لك").

 *

 * Matches the reference image product rail section:

 *   • Section header with icon + title + "عرض الكل"

 *   • Editorial 1-hero + 2-compact card layout for featured products

 *   • Hero card: full-bleed image, product name, price, CTA pill

 *   • Compact cards below in a 2-column row

 *   • Premium shadows, rounded corners, smooth press animations

 *

 * Self-contained query subscription — parent never re-renders for this section.

 */



import React, { memo, useCallback } from "react";

import {

  Platform,

  Pressable,

  StyleSheet,

  View,

} from "react-native";

import { Image } from "expo-image";

import { Ionicons } from "@expo/vector-icons";

import * as Haptics from "expo-haptics";

import Animated, {

  useAnimatedStyle,

  useSharedValue,

  withSpring,

useReducedMotion } from "react-native-reanimated";

import { useQuery } from "@tanstack/react-query";

import { useTranslation } from "react-i18next";

import { Text as UIText, CustomerUI } from "@pharmacy/ui-native";

import { theme } from "@pharmacy/design-tokens";

import { kit } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";

import { useScreenLayout } from "@/utils/responsive";

import { ProductCard } from "@/components/ProductCard";

import { HomeSectionHeader } from "./HomeSectionHeader";

import { sectionStyles } from "./home.styles";

import { fetchFeaturedProducts, productKeys } from "@/features/products";

import { formatPrice } from "@/utils/format";

import type { NativeProduct } from "@/features/products";



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



const GAP       = 12;

const STALE_MS  = 90_000;

const EDIT_LIMIT = 6;



const SPRING_IN  = { damping: 10, stiffness: 380 } as const;

const SPRING_OUT = { damping: 14, stiffness: 280 } as const;



// ─── Props ───────────────────────────────────────────────────────────────────



export interface DailyEditProps {

  lang:           "ar" | "en";

  onProductPress: (id: string) => void;

  onViewAll?:     () => void;

}



// ─── DailyEdit ───────────────────────────────────────────────────────────────



export const DailyEdit = memo(function DailyEdit({

  lang,

  onProductPress,

  onViewAll,

}: DailyEditProps) {

  const { t } = useTranslation();

  const { data, isLoading } = useQuery<NativeProduct[]>({

    queryKey:  productKeys.featured(EDIT_LIMIT),

    queryFn:   () => fetchFeaturedProducts(EDIT_LIMIT),

    staleTime: STALE_MS,

    gcTime:    5 * 60_000,

  });



  const { width, isTablet, pagePad } = useScreenLayout();



  const products = (data ?? []).filter((p) => p.imageUrl);



  if (isLoading) return (
    <View style={sectionStyles.root}>
      <HomeSectionHeader eyebrow="..." title="..." />
      <View style={{ paddingHorizontal: pagePad }}>
         <CustomerUI.Skeleton width="100%" height={240} borderRadius={16} />
      </View>
    </View>
  );

  if (products.length < 2) return null;



  const [hero, second, third, fourth] = products;

  const compactCount = isTablet && fourth ? 3 : 2;

  const compactW = Math.floor(

    (width - pagePad * 2 - GAP * (compactCount - 1)) / compactCount,

  );



  return (

    <View style={sectionStyles.wrap}>

      <HomeSectionHeader

        eyebrow={t("home.dailyEditEyebrow")}

        title={t("home.dailyEditTitle")}

        icon="bookmark-outline"

        accent={kit.color.accentDeep}

        onMore={onViewAll}

      />



      <View style={[s.body, { paddingHorizontal: pagePad }]}>

        {/* Hero editorial card */}

        <EditorialHeroCard

          product={hero}

          lang={lang}

          onPress={() => onProductPress(hero.id)}

        />



        {/* Compact split row */}

        {second && (

          <View style={s.compactRow}>

            <View style={{ width: compactW }}>

              <ProductCard

                product={second}

                lang={lang}

                onPress={() => onProductPress(second.id)}

              />

            </View>

            {third && (

              <View style={{ width: compactW }}>

                <ProductCard

                  product={third}

                  lang={lang}

                  onPress={() => onProductPress(third.id)}

                />

              </View>

            )}

            {isTablet && fourth && (

              <View style={{ width: compactW }}>

                <ProductCard

                  product={fourth}

                  lang={lang}

                  onPress={() => onProductPress(fourth.id)}

                />

              </View>

            )}

          </View>

        )}

      </View>

    </View>

  );

});



// ─── EditorialHeroCard ────────────────────────────────────────────────────────



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

  const { t } = useTranslation();



  const displayName =

    lang === "ar"

      ? (product.nameAr ?? product.name)

      : (product.name ?? product.nameAr);



  const isSale = product.hasActivePromotion;

  const isNew  = Boolean(product.isNew);



  const scale    = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({

    transform: [{ scale: scale.value }],

  }));



  const handlePressIn  = useCallback(() => { scale.value = withSpring(0.97, SPRING_IN);  }, [scale]);

  const handlePressOut = useCallback(() => { scale.value = withSpring(1.0, SPRING_OUT); }, [scale]);



  const handlePress = useCallback(() => {

    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});

    onPress();

  }, [onPress]);



  return (

    <Pressable

      onPress={handlePress}

      onPressIn={handlePressIn}

      onPressOut={handlePressOut}

      accessibilityRole="button"

      accessibilityLabel={displayName ?? ""}

    >

      <Animated.View style={[s.heroCard, animStyle]}>

        {/* Image side */}

        <View style={s.heroImageWrap}>

          {product.imageUrl ? (

            <Image

              source={{ uri: product.imageUrl }}

              style={s.heroImage}

              contentFit="contain"

              transition={200}

              placeholder="L6PZfSi_.AyE_3t7t7R**0o#DgR4"

            />

          ) : (

            <View style={s.heroImageEmpty}>

              <Ionicons name="medkit-outline" size={36} color={kit.color.inkFaint} />

            </View>

          )}

          {(isSale || isNew) && (

            <View

              style={[

                s.heroBadge,

                {

                  backgroundColor: isSale

                    ? kit.color.danger

                    : kit.color.accentDeep,

                },

              ]}

            >

              <UIText style={s.heroBadgeText}>

                {isSale ? t("common.sale") : t("common.new")}

              </UIText>

            </View>

          )}

        </View>



        {/* Body side */}

        <View style={s.heroBody}>

          <UIText style={s.heroEyebrow}>{t("home.dailyEditHeroLead")}</UIText>

          <UIText style={s.heroName} numberOfLines={2}>

            {displayName}

          </UIText>

          {Boolean(product.categoryName) && (

            <UIText style={s.heroCategory} numberOfLines={1}>

              {product.categoryName}

            </UIText>

          )}

          <View style={s.heroFoot}>

            <UIText style={s.heroPrice}>{formatPrice(product.price)}</UIText>

            <View style={s.heroCta}>

              <UIText style={s.heroCtaText}>{t("home.dailyEditShopNow")}</UIText>

              <Ionicons

                name={FORWARD_CHEVRON}

                size={12}

                color={kit.color.onAccent}

              />

            </View>

          </View>

        </View>

      </Animated.View>

    </Pressable>

  );

});



// ─── Styles ──────────────────────────────────────────────────────────────────



const s = StyleSheet.create({

  body: {

    gap: GAP,

  },



  // ── Hero editorial card ─────────────────────────────────────────────────

  heroCard: {

    flexDirection:   flexRow(IS_RTL),

    alignItems:      "stretch",

    backgroundColor: "#FFFFFF",

    borderRadius:    20,

    borderWidth:     1,

    borderColor:     "rgba(15,23,42,0.06)",

    overflow:        "hidden",

    minHeight:       160,

    shadowColor:     "#0C2240",

    shadowOffset:    { width: 0, height: 4 },

    shadowOpacity:   0.08,

    shadowRadius:    16,

    elevation:       4,

  },



  heroImageWrap: {

    width:           148,

    backgroundColor: kit.color.well,

    alignItems:      "center",

    justifyContent:  "center",

    padding:         12,

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

    color:              "#FFFFFF",

    letterSpacing:      0.6,

    textTransform:      "uppercase",

    includeFontPadding: false,

  },



  heroBody: {

    flex:              1,

    paddingHorizontal: 16,

    paddingVertical:   16,

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

    lineHeight:         22,

    color:              kit.color.ink,

    letterSpacing:      -0.3,

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

    marginTop:      4,

  },

  heroPrice: {

    fontFamily:         theme.fonts.black,

    fontSize:           18,

    lineHeight:         24,

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

    color:              "#FFFFFF",

    includeFontPadding: false,

  },



  // ── Compact row ─────────────────────────────────────────────────────────

  compactRow: {

    flexDirection: flexRow(IS_RTL),

    gap:           GAP,

  },

});

