/**
 * ProductCard — V3 Elite Redesign (2026)
 *
 * Features:
 *   • expo-image with blurhash placeholder for instant perceived load
 *   • Animated heart wishlist toggle (spring scale burst)
 *   • Pill badge: sale % / new / bestseller — colour-coded
 *   • Stacked price + struck-through original price when on discount
 *   • Circular add-to-cart button with haptic feedback + optimistic update
 *   • Out-of-stock frosted overlay with text
 *   • AR / EN display name — resolved from product data
 *   • RTL-aware absolute positioning (badge top-start, heart top-end)
 *   • WCAG AA: all text ≥ 4.5:1, touch targets ≥ 44 pt (heart hitSlop)
 *   • Memoized: only re-renders when product id, wishlist state, or lang changes
 *
 * Used by:
 *   ProductGrid, FlashSaleSection, RecentlyViewedCarousel, FeaturedSection
 */

import React, { memo, useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Image }       from "expo-image";
import { Ionicons }    from "@expo/vector-icons";
import * as Haptics    from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Text as UIText }  from "../shared/ui/Text";
import { theme }            from "../shared/theme";
import { kit }              from "../shared/kit";
import { isRtl }            from "../utils/layout";
import { useCartStore }     from "../stores/cart";
import { useWishlistStore } from "../stores/wishlist";
import type { NativeProduct } from "../features/products/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const IS_RTL = isRtl();

/**
 * Generic blue-tinted blurhash that matches the app's cyan brand.
 * Replace with per-product blurhash from your DB for production.
 */
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardBadge = "sale" | "new" | "bestseller";

export interface ProductCardProps {
  product:          NativeProduct;
  /** Display language — selects nameAr vs nameEn */
  lang?:            "ar" | "en";
  /** Explicit badge override — otherwise auto-resolved from product flags */
  badge?:           CardBadge;
  /** Explicit discount percentage — shown inside the badge and as strikethrough */
  discountPercent?: number;
  onPress?:         () => void;
  /** Extra style passed to the root Pressable (e.g. width from a carousel) */
  style?:           object;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Animated wishlist heart button */
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
    // Spring burst: scale up then snap back
    scale.value = withSpring(1.4, { damping: 5, stiffness: 500 }, () => {
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
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Remove from wishlist" : "Save to wishlist"}
      style={cs.heartBtn}
    >
      <Animated.View style={animStyle}>
        <Ionicons
          name={liked ? "heart" : "heart-outline"}
          size={17}
          color={liked ? kit.color.danger : kit.color.inkFaint}
        />
      </Animated.View>
    </Pressable>
  );
});

/** Pill badge (sale / new / bestseller) */
const CardBadgeView = memo(function CardBadgeView({
  type,
  percent,
}: {
  type:     CardBadge;
  percent?: number;
}) {
  let label: string;
  let bg: string;

  switch (type) {
    case "sale":
      label = percent ? `-${percent}%` : "Sale";
      bg    = kit.color.danger;
      break;
    case "new":
      label = "جديد";
      bg    = kit.color.accentDeep;
      break;
    case "bestseller":
      label = "الأكثر مبيعاً";
      bg    = kit.color.warn;
      break;
  }

  return (
    <View style={[cs.badge, { backgroundColor: bg }]}>
      <UIText style={cs.badgeText}>{label}</UIText>
    </View>
  );
});

/** Circular add-to-cart button */
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
    scale.value = withSpring(0.88, { damping: 8, stiffness: 500 }, () => {
      scale.value = withSpring(1, { damping: 10, stiffness: 300 });
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
        <Ionicons name="add" size={18} color={kit.color.onInk} />
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
  // ── Derived display values ──────────────────────────────────────────────

  const displayName = (
    lang === "en"
      ? (product.nameEn || product.nameAr || product.name)
      : (product.nameAr || product.nameEn || product.name)
  ) ?? "";

  // Resolve effective badge from explicit prop → product flags
  const effectiveBadge: CardBadge | undefined =
    badge
    ?? (product.isSale        ? "sale"        : undefined)
    ?? (product.isNew         ? "new"         : undefined)
    ?? (product.isBestseller  ? "bestseller"  : undefined);

  const effectiveDiscount =
    discountPercent != null
      ? discountPercent
      : product.discountPercent ?? undefined;

  const showDiscount = (effectiveDiscount ?? 0) > 0;

  const originalPrice = showDiscount && effectiveDiscount
    ? Math.round(product.price / (1 - effectiveDiscount / 100))
    : null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={displayName}
      style={({ pressed }) => [cs.card, style, pressed && cs.cardPressed]}
    >
      {/* ── Image block ───────────────────────────────── */}
      <View style={cs.imgWrap}>
        <Image
          source={product.imageUrl ? { uri: product.imageUrl } : undefined}
          style={cs.img}
          placeholder={DEFAULT_BLURHASH}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          accessibilityLabel={displayName}
        />

        {/* Badge — top-start corner */}
        {effectiveBadge && (
          <CardBadgeView
            type={effectiveBadge}
            percent={effectiveDiscount ?? undefined}
          />
        )}

        {/* Heart — top-end corner */}
        <HeartButton product={product} />

        {/* Out-of-stock overlay */}
        {!product.inStock && (
          <View style={cs.oosOverlay}>
            <UIText style={cs.oosText}>{"نفد المخزون"}</UIText>
          </View>
        )}
      </View>

      {/* ── Info block ────────────────────────────────── */}
      <View style={cs.info}>
        {/* Category eyebrow */}
        {Boolean(product.categoryName) && (
          <UIText numberOfLines={1} style={cs.category}>
            {lang === "en" ? (product.categoryNameEn || product.categoryName) : product.categoryName}
          </UIText>
        )}

        {/* Name */}
        <UIText numberOfLines={2} style={cs.name}>
          {displayName}
        </UIText>

        {/* Price row + add-to-cart */}
        <View style={cs.bottomRow}>
          <View style={cs.priceCol}>
            <UIText style={cs.price}>
              {product.price.toLocaleString("ar-EG")}
              {"  "}
              <UIText style={cs.currency}>{"ج.م"}</UIText>
            </UIText>

            {originalPrice !== null && (
              <UIText style={cs.original}>
                {originalPrice.toLocaleString("ar-EG")}
              </UIText>
            )}
          </View>

          {/* Add-to-cart only when in stock */}
          {product.inStock && <AddButton product={product} />}
        </View>
      </View>
    </Pressable>
  );
});

export default ProductCard;

// ─── Skeleton (for loading states) ───────────────────────────────────────────

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

// ─── Styles ──────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  // ── Card shell ─────────────────────────────────────────────────────────
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.card,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    flex:            1,
  },
  cardPressed: {
    opacity: 0.88,
  },

  // ── Image ──────────────────────────────────────────────────────────────
  imgWrap: {
    width:           "100%",
    height:          140,
    backgroundColor: kit.color.well,
  },
  img: {
    width:  "100%",
    height: "100%",
  },

  // ── Badge (top-start) ──────────────────────────────────────────────────
  badge: {
    position:          "absolute",
    top:               8,
    // RTL: badge on right edge; LTR: badge on left edge
    ...(IS_RTL ? { right: 8 } : { left: 8 }),
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
  },
  badgeText: {
    color:              "#fff",
    fontSize:           9,
    lineHeight:         13,
    fontFamily:         theme.fonts.bold,
    includeFontPadding: false,
  },

  // ── Heart (top-end) ────────────────────────────────────────────────────
  heartBtn: {
    position:        "absolute",
    top:             6,
    // RTL: left edge; LTR: right edge
    ...(IS_RTL ? { left: 6 } : { right: 6 }),
    width:           30,
    height:          30,
    borderRadius:    15,
    backgroundColor: "rgba(255,255,255,0.90)",
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Out-of-stock overlay ───────────────────────────────────────────────
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.70)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  oosText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },

  // ── Info block ─────────────────────────────────────────────────────────
  info: {
    paddingHorizontal: 10,
    paddingTop:        8,
    paddingBottom:     10,
    gap:               3,
  },
  category: {
    fontFamily:         theme.fonts.regular,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    textAlign:          IS_RTL ? "right" : "left",
    includeFontPadding: false,
  },
  name: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    textAlign:          IS_RTL ? "right" : "left",
    includeFontPadding: false,
  },

  // ── Price row ──────────────────────────────────────────────────────────
  bottomRow: {
    flexDirection:  IS_RTL ? "row-reverse" : "row",
    alignItems:     "flex-end",
    justifyContent: "space-between",
    marginTop:      4,
  },
  priceCol: {
    gap: 1,
  },
  price: {
    fontFamily:         theme.fonts.black,
    fontSize:           15,
    lineHeight:         20,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  currency: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    color:              kit.color.inkSoft,
  },
  original: {
    fontFamily:         theme.fonts.regular,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    textDecorationLine: "line-through",
    includeFontPadding: false,
  },

  // ── Add-to-cart button ─────────────────────────────────────────────────
  addBtn: {
    width:  30,
    height: 30,
  },
  addBtnInner: {
    flex:            1,
    borderRadius:    15,
    backgroundColor: kit.color.accentDeep,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Skeleton ───────────────────────────────────────────────────────────
  skeletonCard: {
    borderColor: "transparent",
  },
  skeletonImg: {
    backgroundColor: kit.color.well,
  },
  skeletonLine: {
    height:          12,
    borderRadius:    6,
    backgroundColor: kit.color.well,
    marginVertical:  2,
  },
  skeletonLineTall: {
    height: 16,
  },
  skeletonLineShort: {
    width: "55%",
  },
});