/**
 * Product Detail — hero-tier screen (A3): full-bleed image with glass
 * floating controls, gradient sticky CTA, and a brief "added" confirmation
 * beat on add-to-cart (A14's idle → pressed → adding → added → cart flow).
 */
import React, { useMemo, useEffect, useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { Text, Button, Badge, Skeleton, EmptyState, useTheme } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";

import { useProduct } from "@/features/products/hooks/useProduct";
import { useRelatedProducts } from "@/features/recommendations/hooks/useRelatedProducts";
import { useRecentlyViewedStore } from "@/features/products/stores/recentlyViewedStore";
import { useCartStore, type CartState, type CartItem } from "@/stores/cart";
import { useWishlistStore, type WishlistState } from "@/stores/wishlist";
import type { NativeProduct } from "@/services/productsApi";
import { ProductCard } from "@/components/ProductCard";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const BACK_ICON = IS_RTL ? "chevron-forward" : "chevron-back";
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

function RelatedProductsSection({ productId }: { productId: string }) {
  const { data, isLoading } = useRelatedProducts(productId);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  if (isLoading) return <Skeleton width="100%" height={200} />;
  if (!data || data.length === 0) return null;

  return (
    <View style={styles.relatedSection}>
      <Text variant="h4" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, paddingHorizontal: 20, marginBottom: 16 }}>
        {t("product.related")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScroll}>
        {data.map(p => (
          <View key={p.id} style={{ width: 160 }}>
            <ProductCard
              product={p}
              onPress={() => router.push(`/(customer)/(shop)/product/${p.id}`)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();

  const { data: product, isLoading, isError } = useProduct(id);
  const [justAdded, setJustAdded] = useState(false);

  const pushRecentlyViewed = useRecentlyViewedStore(s => s.push);
  useEffect(() => {
    if (product) pushRecentlyViewed({
      id: product.id,
      name: product.nameAr || product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    });
  }, [product, pushRecentlyViewed]);

  const items = useCartStore((s: CartState) => s.items);
  const addItem = useCartStore((s: CartState) => s.addItem);
  const updateQuantity = useCartStore((s: CartState) => s.updateQty);
  const removeItem = useCartStore((s: CartState) => s.removeItem);

  const cartItem = useMemo(() => items.find((i: CartItem) => i.productId === id), [items, id]);
  const qty = cartItem ? cartItem.quantity : 0;

  const wishlistItems = useWishlistStore((s: WishlistState) => s.items);
  const toggleWishlist = useWishlistStore((s: WishlistState) => s.toggle);
  const liked = wishlistItems.some((p: NativeProduct) => p.id === id);

  const handleAdd = useCallback(() => {
    if (!product) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addItem(product, 1);
    setJustAdded(true);
  }, [product, addItem]);

  useEffect(() => {
    if (!justAdded) return;
    const timer = setTimeout(() => setJustAdded(false), 900);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const handleIncrement = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    updateQuantity(id, qty + 1);
  }, [updateQuantity, id, qty]);

  const handleDecrement = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    if (qty > 1) updateQuantity(id, qty - 1);
    else removeItem(id);
  }, [updateQuantity, removeItem, id, qty]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.colors.canvas.surface }]} accessibilityRole="button" accessibilityLabel={t("common.back")}>
            <Ionicons name={BACK_ICON} size={24} color={theme.colors.text.primary} />
          </Pressable>
        </View>
        <Skeleton width="100%" height={300} />
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton width="80%" height={24} />
          <Skeleton width="40%" height={24} />
        </View>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.colors.canvas.surface }]} accessibilityRole="button" accessibilityLabel={t("common.back")}>
            <Ionicons name={BACK_ICON} size={24} color={theme.colors.text.primary} />
          </Pressable>
        </View>
        <EmptyState
          illustrationName="empty"
          title={t("product.notFound")}
          action={{ label: t("common.back"), onPress: () => router.back() }}
        />
      </View>
    );
  }

  const name = (i18n.language === "en" ? (product.nameEn || product.nameAr || product.name) : (product.nameAr || product.nameEn || product.name)) ?? "";
  const categoryName = (i18n.language === "en" ? (product.categoryNameEn || product.categoryName) : product.categoryName) ?? "";
  const hasDiscount = product.hasActivePromotion && product.basePrice > product.price;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Hero image with glass floating controls */}
        <View style={[styles.heroWrap, { backgroundColor: theme.colors.canvas.surfaceMuted, paddingTop: insets.top }]}>
          <View style={styles.navBarAbs}>
            <GlassIconButton icon={BACK_ICON} isDark={isDark} onPress={() => router.back()} accessibilityLabel={t("common.back")} />
            <GlassIconButton
              icon={liked ? "heart" : "heart-outline"}
              isDark={isDark}
              tint={liked ? theme.colors.status.error : undefined}
              onPress={() => toggleWishlist(product)}
              accessibilityLabel={t("product.wishlist", "Wishlist")}
            />
          </View>

          {product.isBestseller && (
            <View style={[styles.bestsellerBadge, { start: 16 }]}>
              <Badge label={t("product.bestseller", "Bestseller")} variant="primary" />
            </View>
          )}

          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={styles.heroImg}
              contentFit="contain"
              placeholder={DEFAULT_BLURHASH}
              transition={300}
            />
          ) : (
            <View style={[styles.heroImg, styles.center]}>
              <Ionicons name="medkit-outline" size={64} color={theme.colors.text.muted} />
            </View>
          )}
        </View>

        {/* Identity & pricing */}
        <View style={[styles.contentBlock, { backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
          <Text variant="eyebrow" style={{ color: theme.colors.brand.primary, textAlign: TEXT_START, marginBottom: 8 }}>
            {categoryName.toUpperCase()}
          </Text>

          <Text variant="h2" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, marginBottom: 12 }}>
            {name}
          </Text>

          {typeof product.ratingAvg === "number" && product.ratingCount ? (
            <View style={[styles.ratingRow, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="star" size={14} color={theme.colors.status.warning} />
              <Text variant="caption" style={{ color: theme.colors.text.secondary }}>
                {product.ratingAvg.toFixed(1)} · {t("product.ratingsCount", { count: product.ratingCount })}
              </Text>
            </View>
          ) : null}

          <View style={[styles.priceRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Text variant="h2" style={{ color: theme.colors.text.primary }}>{product.price} {t("common.currency")}</Text>
            {hasDiscount && (
              <Text variant="body" style={{ color: theme.colors.text.muted, textDecorationLine: "line-through" }}>
                {product.basePrice.toLocaleString("ar-EG")}
              </Text>
            )}
            {product.discountPercent != null && product.discountPercent > 0 && (
              <Badge label={`-${product.discountPercent}%`} variant="error" />
            )}
          </View>
        </View>

        {/* Stock */}
        <View style={styles.contentPad}>
          <View style={[
            styles.statusBox,
            { flexDirection: flexRow(IS_RTL), backgroundColor: product.inStock ? `${theme.colors.status.success}1A` : `${theme.colors.status.error}1A` },
          ]}>
            <Ionicons
              name={product.inStock ? "checkmark-circle" : "close-circle"}
              size={20}
              color={product.inStock ? theme.colors.status.success : theme.colors.status.error}
            />
            <Text variant="label" style={{ color: product.inStock ? theme.colors.status.success : theme.colors.status.error }}>
              {product.inStock ? t("product.inStock") : t("product.outOfStock")}
            </Text>
          </View>
        </View>

        <RelatedProductsSection productId={product.id} />
      </ScrollView>

      {/* Sticky purchase bar */}
      <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.stickyBar, theme.shadows[3], { backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default, paddingBottom: insets.bottom || 16 }]}>
        {!product.inStock ? (
          <Button label={t("product.outOfStock")} onPress={() => {}} variant="secondary" size="lg" disabled fullWidth />
        ) : justAdded ? (
          <Animated.View entering={FadeIn.duration(150)} style={[styles.cartBtn, { backgroundColor: theme.colors.status.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.text.inverse} />
            <Text variant="label" style={{ color: theme.colors.text.inverse }}>{t("product.addedToCart")}</Text>
          </Animated.View>
        ) : qty === 0 ? (
          <Button
            label={`${t("product.addToCart")} · ${product.price} ${t("common.currency")}`}
            onPress={handleAdd}
            size="lg"
            tone="gradient"
            glow
            fullWidth
            icon="cart-outline"
          />
        ) : (
          <View style={[styles.stepperWrap, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable onPress={handleDecrement} style={[styles.stepBtn, { backgroundColor: theme.colors.canvas.surfaceMuted }]} accessibilityRole="button" accessibilityLabel={qty === 1 ? t("product.remove", "Remove") : t("product.decrease", "Decrease quantity")}>
              <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={24} color={theme.colors.text.primary} />
            </Pressable>
            <View style={styles.qtyBox}>
              <Text variant="caption" style={{ color: theme.colors.text.muted }}>{t("product.inCart")}</Text>
              <Text variant="h3" style={{ color: theme.colors.text.primary }}>{qty}</Text>
            </View>
            <Pressable onPress={handleIncrement} style={[styles.stepBtn, { backgroundColor: theme.colors.canvas.surfaceMuted }]} accessibilityRole="button" accessibilityLabel={t("product.increase", "Increase quantity")}>
              <Ionicons name="add" size={24} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function GlassIconButton({ icon, isDark, tint, onPress, accessibilityLabel }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  isDark: boolean;
  tint?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.glassBtn} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      <BlurView intensity={50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
      <Ionicons name={icon} size={22} color={tint ?? theme.colors.text.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: flexRow(IS_RTL) },
  navBarAbs: { position: "absolute", top: 16, left: 16, right: 16, zIndex: 10, flexDirection: flexRow(IS_RTL), justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  bestsellerBadge: { position: "absolute", top: 64, zIndex: 10 },
  heroWrap: { width: "100%", height: 350, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden", marginBottom: 16 },
  heroImg: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  contentBlock: { padding: 20, borderBottomWidth: 1, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 16 },
  contentPad: { paddingHorizontal: 20, paddingBottom: 16 },
  ratingRow: { alignItems: "center", gap: 6, marginBottom: 12 },
  priceRow: { alignItems: "center", gap: 12 },
  statusBox: { alignItems: "center", padding: 12, borderRadius: 12, gap: 8 },
  relatedSection: { paddingVertical: 24 },
  relatedScroll: { paddingHorizontal: 20, gap: 16 },
  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  cartBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", height: 56, borderRadius: 28, gap: 8 },
  stepperWrap: { alignItems: "center", justifyContent: "space-between", height: 56 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  qtyBox: { alignItems: "center", justifyContent: "center" },
});
