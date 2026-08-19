/**
 * ProductCard — 2026 Premium Redesign (Phase 3).
 *
 * One canonical ProductCard system serving Home, Search, Category, and Explore.
 * Features:
 *  - Quantity stepper transition when added to cart
 *  - Full Light/Dark mode support via `useLuxuryTheme`
 *  - Accessibility, Haptics, Reanimated layout transitions
 *  - React.memo optimization
 */
import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { CustomerUI } from "@pharmacy/ui-native";
import { isRtl, flexRow } from "@/utils/layout";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import type { NativeProduct } from "@/features/products/types";

const IS_RTL = isRtl();
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

export type CardBadge = "sale" | "new" | "bestseller";

export interface ProductCardProps {
  product: NativeProduct;
  lang?: "ar" | "en";
  badge?: CardBadge;
  discountPercent?: number;
  onPress?: () => void;
  style?: object;
}

// ─── HeartButton ───
const HeartButton = memo(function HeartButton({ product }: { product: NativeProduct }) {
  const liked = useWishlistStore((s: any) => (s.items as string[]).includes(product.id));
  const toggle = useWishlistStore((s: any) => s.toggle);
  const theme = CustomerUI.useLuxuryTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSpring(1.5, { damping: 5, stiffness: 500 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
    });
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    toggle(product);
  }, [product, scale, toggle]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Remove from wishlist" : "Save to wishlist"}
      style={[styles.heartBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }]}
    >
      <Animated.View style={animStyle}>
        <Ionicons name={liked ? "heart" : "heart-outline"} size={16} color={liked ? "#EF4444" : theme.colors.inkFaint} />
      </Animated.View>
    </Pressable>
  );
});

// ─── CartControl ───
const CartControl = memo(function CartControl({ product }: { product: NativeProduct }) {
  const cartItem = useCartStore((s: any) => s.items.find((i: any) => i.productId === product.id));
  const addItem = useCartStore((s: any) => s.addItem);
  const updateQuantity = useCartStore((s: any) => s.updateQuantity);
  const removeItem = useCartStore((s: any) => s.removeItem);
  const theme = CustomerUI.useLuxuryTheme();

  const cartItem = items.find((i: any) => i.productId === product.id);
  const qty = cartItem ? cartItem.quantity : 0;
  
  const scale = useSharedValue(1);

  const handleAdd = useCallback(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    scale.value = withSpring(0.85, { damping: 6, stiffness: 500 }, () => { scale.value = withSpring(1); });
    addItem(product, 1);
  }, [addItem, product, scale]);

  const handleIncrement = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    updateQuantity(product.id, qty + 1);
  }, [updateQuantity, product.id, qty]);

  const handleDecrement = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    if (qty > 1) {
      updateQuantity(product.id, qty - 1);
    } else {
      removeItem(product.id);
    }
  }, [updateQuantity, removeItem, product.id, qty]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (qty === 0) {
    return (
      <Animated.View style={[styles.addBtn, { backgroundColor: theme.colors.accent }, animStyle]}>
        <Pressable onPress={handleAdd} hitSlop={6} accessibilityRole="button" accessibilityLabel="Add to cart" style={styles.addBtnInner}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.stepper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.accent }, animStyle]}>
      <Pressable onPress={handleDecrement} style={styles.stepBtn}>
        <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={16} color={theme.colors.accent} />
      </Pressable>
      <CustomerUI.Typography variant="bodySm" weight="bold" color={theme.colors.ink}>
        {qty}
      </CustomerUI.Typography>
      <Pressable onPress={handleIncrement} style={styles.stepBtn}>
        <Ionicons name="add" size={16} color={theme.colors.accent} />
      </Pressable>
    </Animated.View>
  );
});

// ─── ProductCard ───
export const ProductCard = memo(function ProductCard({
  product,
  lang = "ar",
  badge,
  discountPercent,
  onPress,
  style,
}: ProductCardProps) {
  const { t } = useTranslation();
  const theme = CustomerUI.useLuxuryTheme();

  const displayName = (lang === "en" ? (product.nameEn || product.nameAr || product.name) : (product.nameAr || product.nameEn || product.name)) ?? "";
  
  const effectiveBadge: CardBadge | undefined = badge ?? (product.hasActivePromotion ? "sale" : undefined) ?? (product.isNew ? "new" : undefined) ?? (product.isBestseller ? "bestseller" : undefined);
  const effectiveDiscount = discountPercent != null ? discountPercent : product.discountPercent ?? undefined;
  const basePrice = product.hasActivePromotion && product.basePrice > product.price ? product.basePrice : null;

  const cardScale = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));

  const onPressIn = useCallback(() => { cardScale.value = withSpring(0.97, { damping: 10, stiffness: 400 }); }, [cardScale]);
  const onPressOut = useCallback(() => { cardScale.value = withSpring(1.0, { damping: 14, stiffness: 300 }); }, [cardScale]);

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} accessibilityRole="button" accessibilityLabel={displayName} style={{ flex: 1 }}>
      <Animated.View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.line }, style, cardAnim]}>
        
        {/* Image Area */}
        <View style={[styles.imgWrap, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFB' }]}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.img} placeholder={DEFAULT_BLURHASH} contentFit="contain" transition={200} cachePolicy="memory-disk" />
          ) : (
            <View style={styles.imgPlaceholder}>
              <Ionicons name="medkit-outline" size={32} color={theme.colors.inkFaint} />
            </View>
          )}

          {/* Badge */}
          {effectiveBadge && (
            <View style={[styles.badge, { backgroundColor: effectiveBadge === 'sale' ? theme.colors.danger : effectiveBadge === 'new' ? theme.colors.accent : '#F59E0B' }]}>
              <CustomerUI.Typography variant="caption" weight="bold" color="#FFF" style={{ fontSize: 9 }}>
                {effectiveBadge === 'sale' ? (effectiveDiscount ? `-${effectiveDiscount}%` : t("product.sale")) : effectiveBadge === 'new' ? t("product.new") : t("product.bestseller")}
              </CustomerUI.Typography>
            </View>
          )}

          {/* Heart */}
          <HeartButton product={product} />

          {/* Out of stock */}
          {!product.inStock && (
            <View style={[styles.oosOverlay, { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.75)' }]}>
              <CustomerUI.Typography variant="caption" weight="bold" color={theme.colors.ink}>{t("product.outOfStock")}</CustomerUI.Typography>
            </View>
          )}
        </View>

        {/* Info Area */}
        <View style={styles.info}>
          {Boolean(product.categoryName) && (
            <CustomerUI.Typography variant="caption" color={theme.colors.inkFaint} numberOfLines={1}>
              {lang === "en" ? (product.categoryNameEn || product.categoryName) : product.categoryName}
            </CustomerUI.Typography>
          )}
          <CustomerUI.Typography variant="bodySm" weight="bold" color={theme.colors.ink} numberOfLines={2} style={styles.nameLabel}>
            {displayName}
          </CustomerUI.Typography>

          <View style={styles.bottomRow}>
            <View style={styles.priceCol}>
              <CustomerUI.Price amount={product.price} size="md" />
              {basePrice !== null && (
                <CustomerUI.Typography variant="caption" color={theme.colors.inkFaint} style={{ textDecorationLine: 'line-through' }}>
                  {basePrice.toLocaleString("ar-EG")}
                </CustomerUI.Typography>
              )}
            </View>
            {product.inStock && <CartControl product={product} />}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

export default ProductCard;

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 16, overflow: "hidden", borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  imgWrap: { width: "100%", height: 140 },
  img: { width: "100%", height: "100%" },
  imgPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 8, ...(IS_RTL ? { end: 8 } : { start: 8 }), paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  heartBtn: { position: "absolute", top: 8, ...(IS_RTL ? { start: 8 } : { end: 8 }), width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  oosOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  info: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 12, gap: 4, flex: 1, justifyContent: 'space-between' },
  nameLabel: { minHeight: 40 },
  bottomRow: { flexDirection: flexRow(IS_RTL), alignItems: "flex-end", justifyContent: "space-between", marginTop: 4 },
  priceCol: { flex: 1, gap: 2 },
  addBtn: { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  addBtnInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  stepper: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", height: 32, borderRadius: 16, borderWidth: 1, width: 80 },
  stepBtn: { width: 28, height: 30, alignItems: "center", justifyContent: "center" },
});
