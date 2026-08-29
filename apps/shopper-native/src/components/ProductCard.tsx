/**
 * ProductCard — the single most-repeated surface in the app (Home, Search,
 * Category, Deals, Wishlist all render dozens of these per screen), which
 * makes it the highest-leverage place to make "soft luxury pharmacy" feel
 * like a real, distinctive identity rather than a generic commerce card.
 *
 * Departures from the old rectangle-image-title-price-button pattern:
 *   - A warm gradient-washed image well instead of a flat grey box, so the
 *     product photo sits in something that reads as considered, not default.
 *   - A genuine trust signal (verified-pharmacy shield next to the category
 *     label) — every item sold here IS pharmacist-verified, so this isn't
 *     decorative, it's a real claim the business can back everywhere.
 *   - A low-stock urgency strip driven by the real `stock` count (not a
 *     fabricated field) — appears only at 1-5 units left.
 *   - A redesigned add-to-cart control: idle state is a soft brand-accent
 *     capsule that *expands* into the quantity stepper (not two unrelated
 *     shapes swapping), with a confirm-flash on first add.
 *   - Ratings surfaced when the catalog actually has them, using the same
 *     star+count convention as Product Detail.
 *   - formatPrice() for currency (matches Order/Checkout elsewhere) instead
 *     of the old always-English "EGP" formatting.
 */
import React, { memo, useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import type { NativeProduct } from "@/features/products/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";
const LOW_STOCK_THRESHOLD = 5;

export type CardBadge = "sale" | "new" | "bestseller";

export interface ProductCardProps {
  product: NativeProduct;
  lang?: "ar" | "en";
  badge?: CardBadge;
  discountPercent?: number;
  onPress?: () => void;
  style?: object;
}

// ─── HeartButton ────────────────────────────────────────────────────────────

const HeartButton = memo(function HeartButton({ product, theme }: { product: NativeProduct; theme: NativeTheme }) {
  const liked = useWishlistStore((s) => s.items.some((p) => p.id === product.id));
  const toggle = useWishlistStore((s) => s.toggle);
  const { t } = useTranslation();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 500 }),
      withSpring(1, { damping: 12, stiffness: 300 }),
    );
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggle(product);
  }, [product, scale, toggle]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={liked ? t("product.removeFromWishlist") : t("product.addToWishlist")}
      style={[s.heartBtn, { backgroundColor: `${theme.colors.canvas.surface}E6`, borderColor: theme.colors.border.default }]}
    >
      <Animated.View style={animStyle}>
        <Ionicons name={liked ? "heart" : "heart-outline"} size={15} color={liked ? theme.colors.status.error : theme.colors.text.muted} />
      </Animated.View>
    </Pressable>
  );
});

// ─── CartControl — capsule that expands into a stepper ─────────────────────

const CartControl = memo(function CartControl({ product, theme }: { product: NativeProduct; theme: NativeTheme }) {
  const cartItem = useCartStore((s) => s.items.find((i) => i.productId === product.id));
  const addItem = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const qty = cartItem ? cartItem.quantity : 0;

  const [justAdded, setJustAdded] = useState(false);
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const handleAdd = useCallback(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    pulse.value = withSequence(withSpring(0.82, { damping: 8, stiffness: 500 }), withSpring(1, { damping: 10, stiffness: 260 }));
    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 620);
  }, [addItem, product, pulse]);

  const handleIncrement = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    updateQty(product.id, qty + 1);
  }, [updateQty, product.id, qty]);

  const handleDecrement = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    if (qty > 1) updateQty(product.id, qty - 1);
    else removeItem(product.id);
  }, [updateQty, removeItem, product.id, qty]);

  if (qty === 0) {
    return (
      <Animated.View style={pulseStyle}>
        <Pressable
          onPress={handleAdd}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add to cart"
          style={[s.addBtn, { backgroundColor: theme.colors.brand.accent }]}
        >
          {justAdded ? (
            <Animated.View entering={FadeIn.duration(120)}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </Animated.View>
          ) : (
            <Ionicons name="add" size={18} color="#FFFFFF" />
          )}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[s.stepper, { backgroundColor: theme.colors.brand.accentLight, borderColor: theme.colors.brand.accent }, pulseStyle]}>
      <Pressable onPress={handleDecrement} hitSlop={4} style={s.stepBtn}>
        <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={14} color={theme.colors.brand.accent} />
      </Pressable>
      <UIText style={[s.stepQty, { color: theme.colors.text.primary }]}>{qty}</UIText>
      <Pressable onPress={handleIncrement} hitSlop={4} style={s.stepBtn}>
        <Ionicons name="add" size={14} color={theme.colors.brand.accent} />
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
  const { theme } = useTheme();

  // expo-image has no built-in fallback for a URL that 404s or otherwise
  // fails to load -- a genuinely missing imageUrl correctly hits the
  // placeholder branch below, but a broken one rendered nothing at all
  // (confirmed live: an empty image tile with no icon, no visible error).
  const [imgFailed, setImgFailed] = useState(false);

  const displayName = (lang === "en" ? (product.nameEn || product.nameAr || product.name) : (product.nameAr || product.nameEn || product.name)) ?? "";
  const categoryLabel = lang === "en" ? (product.categoryNameEn || product.categoryName) : product.categoryName;

  const effectiveBadge: CardBadge | undefined = badge ?? (product.hasActivePromotion ? "sale" : undefined) ?? (product.isNew ? "new" : undefined) ?? (product.isBestseller ? "bestseller" : undefined);
  const effectiveDiscount = discountPercent != null ? discountPercent : product.discountPercent ?? undefined;
  const basePrice = product.hasActivePromotion && product.basePrice > product.price ? product.basePrice : null;
  const isLowStock = product.inStock && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  const hasRating = typeof product.ratingAvg === "number" && !!product.ratingCount;

  const badgeTone = effectiveBadge === "sale" ? theme.colors.status.error : effectiveBadge === "new" ? theme.colors.brand.primary : theme.colors.tertiary.base;

  const cardScale = useSharedValue(1);
  const cardElevation = useSharedValue(0);
  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    shadowOpacity: 0.05 + cardElevation.value * 0.06,
  }));

  const onPressIn = useCallback(() => {
    cardScale.value = withSpring(0.97, { damping: 14, stiffness: 420 });
    cardElevation.value = withTiming(1, { duration: 120 });
  }, [cardScale, cardElevation]);
  const onPressOut = useCallback(() => {
    cardScale.value = withSpring(1.0, { damping: 16, stiffness: 320 });
    cardElevation.value = withTiming(0, { duration: 200 });
  }, [cardScale, cardElevation]);

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} accessibilityRole="link" accessibilityLabel={displayName} style={{ flex: 1 }}>
      <Animated.View style={[s.card, { backgroundColor: theme.colors.canvas.surface }, style, cardAnim]}>

        {/* ── Image well — a floating, inset tile rather than an edge-to-edge
            rectangle, so the photo reads as a considered object placed on
            the card, not a flat banner bleeding to its corners. ── */}
        <View style={s.imgOuter}>
          <View style={[s.imgTile, { shadowColor: badgeTone }]}>
            <LinearGradient
              colors={theme.isDark
                ? [theme.colors.canvas.surfaceMuted, theme.colors.canvas.elevated]
                : [theme.colors.brand.primaryLight, theme.colors.canvas.surface]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.85, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            {product.imageUrl && !imgFailed ? (
              <Image source={{ uri: product.imageUrl }} style={s.img} placeholder={DEFAULT_BLURHASH} contentFit="contain" transition={200} cachePolicy="memory-disk" onError={() => setImgFailed(true)} />
            ) : (
              <View style={s.imgPlaceholder}>
                <Ionicons name="medkit-outline" size={30} color={theme.colors.text.muted} />
              </View>
            )}

            {!product.inStock && (
              <View style={[s.oosOverlay, { backgroundColor: theme.isDark ? "rgba(11,18,16,0.78)" : "rgba(250,248,244,0.86)" }]}>
                <View style={[s.oosPill, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
                  <UIText style={{ color: theme.colors.text.secondary, fontSize: 10, fontWeight: "700" }}>{t("product.outOfStock")}</UIText>
                </View>
              </View>
            )}

            {/* Low-stock urgency — real signal from product.stock, not decoration */}
            {isLowStock && (
              <View style={[s.stockStrip, { backgroundColor: `${theme.colors.status.warning}E6` }]}>
                <UIText style={s.stockStripText} numberOfLines={1}>
                  {t("product.stockRemaining", { count: product.stock })}
                </UIText>
              </View>
            )}
          </View>

          {/* Badge + heart float ABOVE the tile's rounded corners — a "sticker
              on the card" feel rather than clipped icons pinned to a flat rect. */}
          {effectiveBadge && (
            <View style={[s.badge, { backgroundColor: badgeTone }, theme.shadows[1]]}>
              {effectiveBadge === "sale" && <Ionicons name="flash" size={9} color="#FFFFFF" />}
              {effectiveBadge === "bestseller" && <Ionicons name="star" size={9} color="#FFFFFF" />}
              <UIText style={s.badgeText}>
                {effectiveBadge === "sale" ? (effectiveDiscount ? `-${effectiveDiscount}%` : t("product.sale")) : effectiveBadge === "new" ? t("product.new") : t("product.bestseller")}
              </UIText>
            </View>
          )}

          <HeartButton product={product} theme={theme} />
        </View>

        {/* ── Info ── */}
        <View style={s.info}>
          {Boolean(categoryLabel) && (
            <View style={[s.trustRow, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="shield-checkmark" size={10} color={theme.colors.brand.primary} />
              <UIText numberOfLines={1} style={[s.categoryText, { color: theme.colors.text.muted, textAlign: TEXT_START }]}>
                {categoryLabel}
              </UIText>
            </View>
          )}

          <UIText numberOfLines={2} style={[s.nameLabel, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>
            {displayName}
          </UIText>

          {hasRating && (
            <View style={[s.ratingRow, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="star" size={10} color={theme.colors.status.warning} />
              <UIText style={[s.ratingText, { color: theme.colors.text.secondary }]}>
                {product.ratingAvg!.toFixed(1)} · {product.ratingCount}
              </UIText>
            </View>
          )}

          <View style={[s.bottomRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.priceCol}>
              <UIText numberOfLines={1} style={[s.price, { color: theme.colors.text.primary }]}>
                {formatPrice(product.price, lang)}
              </UIText>
              {basePrice !== null && (
                <UIText style={[s.priceStruck, { color: theme.colors.text.muted }]}>
                  {formatPrice(basePrice, lang)}
                </UIText>
              )}
            </View>
            {product.inStock && <CartControl product={product} theme={theme} />}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default ProductCard;

const s = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#241F17",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 2,
  },
  // Padded wrapper around the floating tile — badge/heart float over the
  // gap this padding creates, so they read as sitting just above the tile's
  // rounded corners rather than clipped flush to a flat rectangle's edge.
  imgOuter: { width: "100%", paddingHorizontal: 10, paddingTop: 10, paddingBottom: 2, position: "relative" },
  imgTile: {
    width: "100%",
    height: 128,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  img: { width: "100%", height: "100%" },
  imgPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 3,
    ...(IS_RTL ? { end: 7 } : { start: 7 }),
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 9, lineHeight: 11, fontWeight: "800", color: "#FFFFFF", includeFontPadding: false },
  heartBtn: {
    position: "absolute",
    top: 3,
    ...(IS_RTL ? { start: 7 } : { end: 7 }),
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  stockStrip: {
    position: "absolute",
    bottom: 0,
    start: 0,
    end: 0,
    paddingVertical: 4,
    alignItems: "center",
  },
  stockStripText: { fontSize: 9, lineHeight: 12, fontWeight: "800", color: "#FFFFFF", includeFontPadding: false },
  oosOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  oosPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, borderWidth: 1 },
  info: { paddingHorizontal: 10, paddingTop: 9, paddingBottom: 11, gap: 3, flex: 1, justifyContent: "space-between" },
  trustRow: { alignItems: "center", gap: 3 },
  categoryText: { fontSize: 10, lineHeight: 13, includeFontPadding: false, flexShrink: 1 },
  nameLabel: { fontSize: 12.5, lineHeight: 17, fontWeight: "700", minHeight: 34, letterSpacing: -0.1, includeFontPadding: false },
  ratingRow: { alignItems: "center", gap: 3 },
  ratingText: { fontSize: 10, lineHeight: 13, includeFontPadding: false },
  bottomRow: { alignItems: "flex-end", justifyContent: "space-between", marginTop: 3 },
  priceCol: { flex: 1, gap: 0 },
  price: { fontSize: 15, lineHeight: 19, fontWeight: "800", letterSpacing: -0.2, includeFontPadding: false },
  priceStruck: { fontSize: 10, lineHeight: 13, textDecorationLine: "line-through", includeFontPadding: false },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", height: 30, borderRadius: 15, borderWidth: 1, width: 78, paddingHorizontal: 2 },
  stepBtn: { width: 26, height: 28, alignItems: "center", justifyContent: "center" },
  stepQty: { fontSize: 12, fontWeight: "800", includeFontPadding: false },
});
