/**
 * ProductCard — 2026 Premium Redesign.
 *
 * Matches the reference image product cards exactly:
 *   • White card with 16px radius, soft shadow
 *   • Square image area (140pt) with contain fit, light-grey bg
 *   • Heart wishlist toggle — top-end corner, semi-transparent white circle
 *   • Sale/New/Bestseller pill badge — top-start corner (colour-coded)
 *   • Product name — bold Cairo, 2 lines
 *   • Price in brand teal + struck-through original
 *   • Circular teal add-to-cart button — bottom-end corner
 *   • Out-of-stock overlay
 *   • Spring press animation on the whole card
 *   • expo-image with blurhash placeholder
 *   • RTL-aware badge/heart corners
 *   • Full accessibility (WCAG AA)
 *
 * Memoised — only re-renders when product id, wishlist state, or lang changes.
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
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { Text as UIText }   from "@pharmacy/ui-native";
import { theme }             from "@pharmacy/design-tokens";
import { kit }               from "@pharmacy/ui-native";
import { isRtl, textAlignStart, flexRow } from "../utils/layout";
import { useCartStore }      from "../stores/cart";
import { useWishlistStore }  from "../stores/wishlist";
import type { NativeProduct } from "../features/products/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

const SPRING_IN  = { damping: 10, stiffness: 400 } as const;
const SPRING_OUT = { damping: 14, stiffness: 300 } as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardBadge = "sale" | "new" | "bestseller";

export interface ProductCardProps {
  product:          NativeProduct;
  lang?:            "ar" | "en";
  badge?:           CardBadge;
  discountPercent?: number;
  onPress?:         () => void;
  style?:           object;
}

// ─── HeartButton ─────────────────────────────────────────────────────────────

const HeartButton = memo(function HeartButton({
  product,
}: {
  product: NativeProduct;
}) {
  const items  = useWishlistStore((s: any) => s.items as string[]);
  const toggle = useWishlistStore((s: any) => s.toggle);
  const liked  = items.includes(product.id);

  const scale    = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(1.5, { damping: 5, stiffness: 500 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    toggle(product);
  }, [product, scale, toggle]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Remove from wishlist" : "Save to wishlist"}
      style={cs.heartBtn}
    >
      <Animated.View style={animStyle}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={16}
          color={liked ? "#EF4444" : kit.color.inkFaint}
        />
      </Animated.View>
    </Pressable>
  );
});

// ─── CardBadgeView ────────────────────────────────────────────────────────────

const CardBadgeView = memo(function CardBadgeView({
  type,
  percent,
}: {
  type:     CardBadge;
  percent?: number;
}) {
  const { t } = useTranslation();
  let label: string;
  let bg: string;

  switch (type) {
    case "sale":
      label = percent ? `-${percent}%` : t("product.sale");
      bg    = "#EF4444";
      break;
    case "new":
      label = t("product.new");
      bg    = kit.color.accentDeep;
      break;
    case "bestseller":
      label = t("product.bestseller");
      bg    = "#F59E0B";
      break;
  }

  return (
    <View style={[cs.badge, { backgroundColor: bg }]}>
      <UIText style={cs.badgeText}>{label}</UIText>
    </View>
  );
});

// ─── AddButton ───────────────────────────────────────────────────────────────

const AddButton = memo(function AddButton({
  product,
}: {
  product: NativeProduct;
}) {
  const addItem = useCartStore((s: any) => s.addItem);

  const scale    = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(0.85, { damping: 6, stiffness: 500 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    addItem(product, 1);
  }, [addItem, product, scale]);

  return (
    <Animated.View style={[cs.addBtn, animStyle]}>
      <Pressable
        onPress={handlePress}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Add to cart"
        style={cs.addBtnInner}
      >
        <Ionicons name="add" size={18} color="#FFFFFF" />
      </Pressable>
    </Animated.View>
  );
});

// ─── ProductCard ─────────────────────────────────────────────────────────────

export const ProductCard = memo(function ProductCard({
  product,
  lang = "ar",
  badge,
  discountPercent,
  onPress,
  style,
}: ProductCardProps) {
  const { t } = useTranslation();

  // ── Derived display values ──────────────────────────────────────────────
  const displayName = (
    lang === "en"
      ? (product.nameEn || product.nameAr || product.name)
      : (product.nameAr || product.nameEn || product.name)
  ) ?? "";

  const effectiveBadge: CardBadge | undefined =
    badge
    ?? (product.hasActivePromotion ? "sale"       : undefined)
    ?? (product.isNew              ? "new"        : undefined)
    ?? (product.isBestseller       ? "bestseller" : undefined);

  const effectiveDiscount =
    discountPercent != null
      ? discountPercent
      : product.discountPercent ?? undefined;

  const basePrice =
    product.hasActivePromotion && product.basePrice > product.price
      ? product.basePrice
      : null;

  // ── Card-level press animation ──────────────────────────────────────────
  const cardScale = useSharedValue(1);
  const cardAnim  = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const onPressIn  = useCallback(() => { cardScale.value = withSpring(0.97, SPRING_IN);  }, [cardScale]);
  const onPressOut = useCallback(() => { cardScale.value = withSpring(1.0, SPRING_OUT); }, [cardScale]);

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={displayName}
      style={cs.touchable}
    >
      <Animated.View style={[cs.card, style, cardAnim]}>

        {/* ── Image area ── */}
        <View style={cs.imgWrap}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={cs.img}
              placeholder={DEFAULT_BLURHASH}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
              accessibilityLabel={displayName}
            />
          ) : (
            <View style={cs.imgPlaceholder}>
              <Ionicons name="medkit-outline" size={32} color={kit.color.inkFaint} />
            </View>
          )}

          {/* Badge — top-start */}
          {effectiveBadge && (
            <CardBadgeView
              type={effectiveBadge}
              percent={effectiveDiscount}
            />
          )}

          {/* Heart — top-end */}
          <HeartButton product={product} />

          {/* Out of stock overlay */}
          {!product.inStock && (
            <View style={cs.oosOverlay}>
              <UIText style={cs.oosText}>{t("product.outOfStock")}</UIText>
            </View>
          )}
        </View>

        {/* ── Info area ── */}
        <View style={cs.info}>
          {/* Category eyebrow */}
          {Boolean(product.categoryName) && (
            <UIText numberOfLines={1} style={cs.category}>
              {lang === "en"
                ? (product.categoryNameEn || product.categoryName)
                : product.categoryName}
            </UIText>
          )}

          {/* Name */}
          <UIText numberOfLines={2} style={cs.name}>
            {displayName}
          </UIText>

          {/* Price row + add button */}
          <View style={cs.bottomRow}>
            <View style={cs.priceCol}>
              <UIText style={cs.price}>
                {product.price.toLocaleString("ar-EG")}
                {"  "}
                <UIText style={cs.currency}>{t("common.currency")}</UIText>
              </UIText>
              {basePrice !== null && (
                <UIText style={cs.originalPrice}>
                  {basePrice.toLocaleString("ar-EG")}
                </UIText>
              )}
            </View>

            {product.inStock && <AddButton product={product} />}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default ProductCard;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  return (
    <View style={[cs.card, cs.skeletonCard]}>
      <View style={[cs.imgWrap, cs.skeletonImg]} />
      <View style={cs.info}>
        <View style={cs.skeletonLine} />
        <View style={[cs.skeletonLine, cs.skeletonLineTall]} />
        <View style={[cs.skeletonLine, cs.skeletonLineShort]} />
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  // ── Card shell ──────────────────────────────────────────────────────────
  touchable: {
    flex:         1,
    borderRadius: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius:    16,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     "rgba(15,23,42,0.06)",
    flex:            1,
    // Soft shadow
    shadowColor:     "#0C2240",
    shadowOffset:    { width: 0, height: 3 },
    shadowOpacity:   0.07,
    shadowRadius:    10,
    elevation:       3,
  },

  // ── Image ───────────────────────────────────────────────────────────────
  imgWrap: {
    width:           "100%",
    height:          140,
    backgroundColor: "#F8FAFB",
  },
  img: {
    width:  "100%",
    height: "100%",
  },
  imgPlaceholder: {
    width:           "100%",
    height:          "100%",
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "#F1F5F9",
  },

  // ── Badge (top-start) ────────────────────────────────────────────────────
  badge: {
    position:          "absolute",
    top:               8,
    ...(IS_RTL ? { end: 8 } : { start: 8 }),
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      6,
  },
  badgeText: {
    color:              "#FFFFFF",
    fontSize:           9,
    lineHeight:         13,
    fontFamily:         theme.fonts.black,
    includeFontPadding: false,
  },

  // ── Heart (top-end) ──────────────────────────────────────────────────────
  heartBtn: {
    position:        "absolute",
    top:             8,
    ...(IS_RTL ? { start: 8 } : { end: 8 }),
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems:      "center",
    justifyContent:  "center",
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 1 },
    shadowOpacity:   0.08,
    shadowRadius:    3,
    elevation:       2,
  },

  // ── Out-of-stock overlay ─────────────────────────────────────────────────
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  oosText: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },

  // ── Info block ───────────────────────────────────────────────────────────
  info: {
    paddingHorizontal: 10,
    paddingTop:        10,
    paddingBottom:     12,
    gap:               4,
  },
  category: {
    fontFamily:         theme.fonts.regular,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  name: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Price row ────────────────────────────────────────────────────────────
  bottomRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    marginTop:      4,
  },
  priceCol: {
    flex:    1,
    gap:     2,
    minWidth: 0,
  },
  price: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         19,
    color:              kit.color.accentDeep,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  currency: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    color:              kit.color.inkFaint,
  },
  originalPrice: {
    fontFamily:          theme.fonts.regular,
    fontSize:            11,
    lineHeight:          15,
    color:               kit.color.inkFaint,
    textDecorationLine:  "line-through",
    textAlign:           TEXT_START,
    includeFontPadding:  false,
  },

  // ── Add-to-cart circular button ──────────────────────────────────────────
  addBtn: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: kit.color.accentDeep,
    overflow:        "hidden",
    shadowColor:     kit.color.accentDeep,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.30,
    shadowRadius:    6,
    elevation:       4,
  },
  addBtnInner: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
  },

  // ── Skeleton ─────────────────────────────────────────────────────────────
  skeletonCard: {
    shadowOpacity: 0,
    elevation:     0,
    borderColor:   "transparent",
  },
  skeletonImg: {
    backgroundColor: "#EEF2F7",
  },
  skeletonLine: {
    height:          12,
    borderRadius:    6,
    backgroundColor: "#EEF2F7",
    width:           "80%",
  },
  skeletonLineTall: {
    height: 16,
    width:  "60%",
  },
  skeletonLineShort: {
    width: "40%",
  },
});
