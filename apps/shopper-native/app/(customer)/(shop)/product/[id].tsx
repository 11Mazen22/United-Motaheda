/**
 * Product Detail Page — Commerce-focused redesign.
 */
import React, { useMemo, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView, Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { CustomerUI } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";

import { useProduct } from "@/features/products/hooks/useProduct";
import { useRelatedProducts } from "@/features/recommendations/hooks/useRelatedProducts";
import { useRecentlyViewedStore } from "@/features/products/stores/recentlyViewedStore";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { ProductCard } from "@/components/ProductCard";

const IS_RTL = isRtl();
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

function RelatedProductsSection({ productId }: { productId: string }) {
  const { data, isLoading } = useRelatedProducts(productId);
  const theme = CustomerUI.useCustomerTheme();
  const { t } = useTranslation();
  const router = useRouter();

  if (isLoading) return <CustomerUI.Skeleton width="100%" height={200} />;
  if (!data || data.length === 0) return null;

  return (
    <View style={styles.relatedSection}>
      <CustomerUI.Typography variant="h4" weight="bold" color={theme.colors.ink} style={styles.sectionTitle}>
        {t("product.related")}
      </CustomerUI.Typography>
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
  const theme = CustomerUI.useCustomerTheme();

  const { data: product, isLoading, isError } = useProduct(id);

  const pushRecentlyViewed = useRecentlyViewedStore(s => s.push);
  useEffect(() => {
    if (product) pushRecentlyViewed({
      id: product.id,
      name: product.nameAr || product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    });
  }, [product, pushRecentlyViewed]);

  const items = useCartStore((s: any) => s.items);
  const addItem = useCartStore((s: any) => s.addItem);
  const updateQuantity = useCartStore((s: any) => s.updateQuantity);
  const removeItem = useCartStore((s: any) => s.removeItem);

  const cartItem = useMemo(() => items.find((i: any) => i.productId === id), [items, id]);
  const qty = cartItem ? cartItem.quantity : 0;

  const wishlistItems = useWishlistStore((s: any) => s.items as string[]);
  const toggleWishlist = useWishlistStore((s: any) => s.toggle);
  const liked = wishlistItems.includes(id ?? "");

  const handleAdd = useCallback(() => {
    if (!product) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addItem(product, 1);
  }, [product, addItem]);

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
      <View style={[styles.container, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={28} color={theme.colors.ink} />
          </Pressable>
        </View>
        <CustomerUI.Skeleton width="100%" height={300} />
        <View style={{ padding: 16, gap: 12 }}>
          <CustomerUI.Skeleton width="80%" height={24} />
          <CustomerUI.Skeleton width="40%" height={24} />
        </View>
      </View>
    );
  }

  if (isError || !product) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas, paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={28} color={theme.colors.ink} />
          </Pressable>
        </View>
        <CustomerUI.EmptyState
          icon="alert-circle-outline"
          title={t("product.notFound")}
          actionLabel={t("common.back")}
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const name = (i18n.language === "en" ? (product.nameEn || product.nameAr || product.name) : (product.nameAr || product.nameEn || product.name)) ?? "";
  const categoryName = (i18n.language === "en" ? (product.categoryNameEn || product.categoryName) : product.categoryName) ?? "";
  const hasDiscount = product.hasActivePromotion && product.basePrice > product.price;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas }]}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Product Image */}
        <View style={[styles.heroWrap, { backgroundColor: theme.colors.surface, paddingTop: insets.top }]}>
          <View style={styles.navBarAbs}>
            <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.colors.background }]}>
              <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={24} color={theme.colors.ink} />
            </Pressable>
            <Pressable onPress={() => toggleWishlist(product)} style={[styles.backBtn, { backgroundColor: theme.colors.background }]}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={24} color={liked ? theme.colors.danger : theme.colors.ink} />
            </Pressable>
          </View>

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
              <Ionicons name="medkit-outline" size={64} color={theme.colors.inkFaint} />
            </View>
          )}
        </View>

        {/* Product Identity & Pricing */}
        <View style={[styles.contentBlock, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.line }]}>
          <CustomerUI.Typography variant="caption" color={theme.colors.accent} weight="bold" style={styles.catLabel}>
            {categoryName.toUpperCase()}
          </CustomerUI.Typography>

          <CustomerUI.Typography variant="h3" weight="black" color={theme.colors.ink} style={styles.title}>
            {name}
          </CustomerUI.Typography>

          <View style={styles.priceRow}>
            <CustomerUI.Price amount={product.price} size="lg" />
            {hasDiscount && (
              <CustomerUI.Typography variant="body" color={theme.colors.inkSoft} style={styles.strike}>
                {product.basePrice.toLocaleString("ar-EG")}
              </CustomerUI.Typography>
            )}
            {product.discountPercent != null && product.discountPercent > 0 && (
              <CustomerUI.Badge variant="danger" label={`-${product.discountPercent}%`} />
            )}
          </View>
        </View>

        {/* Stock & Availability */}
        <View style={styles.contentPad}>
          <View style={[styles.statusBox, { backgroundColor: product.inStock ? theme.colors.successTint : theme.colors.dangerTint }]}>
            <Ionicons name={product.inStock ? "checkmark-circle" : "close-circle"} size={20} color={product.inStock ? theme.colors.success : theme.colors.danger} />
            <CustomerUI.Typography variant="body" weight="bold" color={product.inStock ? theme.colors.success : theme.colors.danger}>
              {product.inStock ? t("product.inStock") : t("product.outOfStock")}
            </CustomerUI.Typography>
          </View>
        </View>

        {/* Related Products */}
        <RelatedProductsSection productId={product.id} />
      </ScrollView>

      {/* Sticky Purchase Bar */}
      <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.stickyBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.line, paddingBottom: insets.bottom || 16 }]}>
        {!product.inStock ? (
          <CustomerUI.Button label={t("product.outOfStock")} variant="secondary" size="lg" disabled />
        ) : qty === 0 ? (
          <Pressable onPress={handleAdd} style={[styles.cartBtn, { backgroundColor: theme.colors.accent }]}>
            <Ionicons name="cart-outline" size={20} color="#fff" />
            <CustomerUI.Typography variant="body" weight="bold" color="#fff">{t("product.addToCart")} · {product.price} {t("common.currency")}</CustomerUI.Typography>
          </Pressable>
        ) : (
          <View style={styles.stepperWrap}>
            <Pressable onPress={handleDecrement} style={[styles.stepBtn, { backgroundColor: theme.colors.background }]}>
              <Ionicons name={qty === 1 ? "trash-outline" : "remove"} size={24} color={theme.colors.ink} />
            </Pressable>
            <View style={styles.qtyBox}>
              <CustomerUI.Typography variant="body" color={theme.colors.inkSoft}>{t("product.inCart")}</CustomerUI.Typography>
              <CustomerUI.Typography variant="h3" weight="black" color={theme.colors.ink}>{qty}</CustomerUI.Typography>
            </View>
            <Pressable onPress={handleIncrement} style={[styles.stepBtn, { backgroundColor: theme.colors.background }]}>
              <Ionicons name="add" size={24} color={theme.colors.ink} />
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: flexRow(IS_RTL) },
  navBarAbs: { position: "absolute", top: 16, left: 16, right: 16, zIndex: 10, flexDirection: flexRow(IS_RTL), justifyContent: "space-between" },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  heroWrap: { width: "100%", height: 350, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden", marginBottom: 16 },
  heroImg: { width: "100%", height: "100%" },
  center: { alignItems: "center", justifyContent: "center" },
  contentBlock: { padding: 20, borderBottomWidth: 1, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 16 },
  contentPad: { paddingHorizontal: 20, paddingBottom: 16 },
  catLabel: { marginBottom: 8, letterSpacing: 1 },
  title: { marginBottom: 16, textAlign: textAlignStart(IS_RTL) },
  priceRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
  strike: { textDecorationLine: "line-through" },
  statusBox: { flexDirection: flexRow(IS_RTL), alignItems: "center", padding: 12, borderRadius: 12, gap: 8 },
  relatedSection: { paddingVertical: 24 },
  sectionTitle: { paddingHorizontal: 20, marginBottom: 16, textAlign: textAlignStart(IS_RTL) },
  relatedScroll: { paddingHorizontal: 20, gap: 16 },
  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
  cartBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", height: 56, borderRadius: 28, gap: 8 },
  stepperWrap: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", height: 56 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  qtyBox: { alignItems: "center", justifyContent: "center" },
});
