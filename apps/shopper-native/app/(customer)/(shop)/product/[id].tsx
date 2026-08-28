/**
 * Product Detail — hero-tier screen: full-bleed image with glass floating
 * controls, gradient sticky CTA, and a brief "added" confirmation beat on
 * add-to-cart (idle → pressed → adding → added → cart flow).
 *
 * The "Verified & Listed" section below renders copy (sealVerified,
 * clinProfileTitle, clinAttestation, detailsEyebrow, code/barcode/category/
 * nameEnLabel) that already existed, fully translated, in both locale files
 * but was never wired into any screen — a real, legitimate pharmacist-
 * verification claim this business can back, not invented copy.
 */
import React, { useMemo, useEffect, useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, Platform, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { Text, Button, Badge, Skeleton, EmptyState, useTheme } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";

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
const LOW_STOCK_THRESHOLD = 5;

function RelatedProductsSection({ productId }: { productId: string }) {
  const { data, isLoading } = useRelatedProducts(productId);
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { pagePad } = useScreenLayout();

  if (isLoading) return <Skeleton width="100%" height={200} />;
  if (!data || data.length === 0) return null;

  return (
    <View style={styles.relatedSection}>
      <Text variant="h4" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, paddingHorizontal: pagePad, marginBottom: 16 }}>
        {t("product.related")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.relatedScroll, { paddingHorizontal: pagePad }]}>
        {data.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.duration(340).delay(Math.min(i, 6) * 45).springify()} style={{ width: 160 }}>
            <ProductCard
              product={p}
              onPress={() => router.push(`/(customer)/(shop)/product/${p.id}`)}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const TRUST_ITEMS = [
  { key: "trustFastDelivery", icon: "bicycle-outline" as const },
  { key: "trustOriginal", icon: "ribbon-outline" as const },
  { key: "trustReturns", icon: "arrow-undo-outline" as const },
];

function TrustRow() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.trustRow, { flexDirection: flexRow(IS_RTL) }]}>
      {TRUST_ITEMS.map((item) => (
        <View key={item.key} style={[styles.trustItem, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
          <Ionicons name={item.icon} size={18} color={theme.colors.brand.primary} />
          <Text variant="caption" numberOfLines={2} style={{ color: theme.colors.text.secondary, textAlign: "center", marginTop: 6 }}>
            {t(`product.${item.key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function VerifiedDetailsSection({ product }: { product: NativeProduct }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const rotate = useSharedValue(0);

  const toggle = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    rotate.value = withTiming(expanded ? 0 : 1, { duration: 220 });
    setExpanded((e) => !e);
  }, [expanded, rotate]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value * 180}deg` }],
  }));

  const rows: Array<[string, string]> = [
    [t("product.code"), product.code || "—"],
    [t("product.barcode"), product.barcode || "—"],
    [t("product.category"), product.categoryName || "—"],
    ...(product.nameEn ? ([[t("product.nameEnLabel"), product.nameEn]] as Array<[string, string]>) : []),
  ];

  return (
    <View style={[styles.verifiedCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
      <View style={[styles.verifiedHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[styles.verifiedSealWrap, { backgroundColor: theme.colors.brand.primaryLight }]}>
          <Ionicons name="shield-checkmark" size={20} color={theme.colors.brand.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.verifiedTitleRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Text variant="label" numberOfLines={1} style={{ flexShrink: 1, minWidth: 0, color: theme.colors.text.primary, textAlign: TEXT_START }}>
              {t("product.clinProfileTitle")}
            </Text>
            <View style={{ flexShrink: 0 }}>
              <Badge label={t("product.sealVerified")} variant="success" />
            </View>
          </View>
          <Text variant="caption" style={{ color: theme.colors.text.muted, textAlign: TEXT_START, marginTop: 3 }}>
            {t("product.clinAttestation")}
          </Text>
        </View>
      </View>

      <Pressable onPress={toggle} style={[styles.verifiedToggle, { flexDirection: flexRow(IS_RTL), borderTopColor: theme.colors.border.default }]} accessibilityRole="button">
        <Text variant="caption" style={{ color: theme.colors.brand.primary, fontWeight: "700" }}>
          {expanded ? t("product.clinCollapse") : t("product.clinExpandAll")}
        </Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={16} color={theme.colors.brand.primary} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.verifiedDetails}>
          <Text variant="eyebrow" style={{ color: theme.colors.text.muted, textAlign: TEXT_START, marginBottom: 8 }}>
            {t("product.detailsEyebrow")}
          </Text>
          {rows.map(([label, value]) => (
            <View key={label} style={[styles.detailRow, { flexDirection: flexRow(IS_RTL), borderTopColor: theme.colors.border.default }]}>
              <Text variant="caption" style={{ color: theme.colors.text.muted }}>{label}</Text>
              <Text variant="caption" style={{ color: theme.colors.text.primary, fontWeight: "700" }}>{value}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { theme, isDark } = useTheme();
  const lang = i18n.language === "en" ? "en" as const : "ar" as const;

  const { data: product, isLoading, isError } = useProduct(id);
  const [justAdded, setJustAdded] = useState(false);
  const { pagePad } = useScreenLayout();

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
  const isLowStock = product.inStock && product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;
  const topBadge: { label: string; variant: "error" | "primary" | "info" } | null =
    hasDiscount && product.discountPercent ? { label: `-${product.discountPercent}%`, variant: "error" }
    : product.isBestseller ? { label: t("product.bestseller", "Bestseller"), variant: "primary" }
    : product.isNew ? { label: t("product.new"), variant: "info" }
    : null;

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

          {topBadge && (
            <View style={[styles.topBadge, { start: 16 }]}>
              <Badge label={topBadge.label} variant={topBadge.variant} />
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

          <LinearGradient
            colors={["transparent", theme.isDark ? "rgba(11,18,16,0.35)" : "rgba(250,248,244,0.5)"]}
            style={styles.heroFade}
            pointerEvents="none"
          />
        </View>

        {/* Identity & pricing */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.contentBlock, { backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default, paddingHorizontal: pagePad }]}>
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
            <Text variant="h2" style={{ color: theme.colors.text.primary }}>{formatPrice(product.price, lang)}</Text>
            {hasDiscount && (
              <Text variant="body" style={{ color: theme.colors.text.muted, textDecorationLine: "line-through" }}>
                {formatPrice(product.basePrice, lang)}
              </Text>
            )}
          </View>

          {isLowStock && (
            <View style={[styles.lowStockPill, { flexDirection: flexRow(IS_RTL), backgroundColor: `${theme.colors.status.warning}1A` }]}>
              <Ionicons name="flame-outline" size={13} color={theme.colors.status.warning} />
              <Text variant="caption" style={{ color: theme.colors.status.warning, fontWeight: "700" }}>
                {t("product.stockCount", { count: product.stock })}
              </Text>
            </View>
          )}
        </Animated.View>

        <View style={[styles.contentPad, { paddingHorizontal: pagePad }]}>
          <TrustRow />
        </View>

        {/* Stock */}
        <View style={[styles.contentPad, { paddingHorizontal: pagePad }]}>
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

        <View style={[styles.contentPad, { paddingHorizontal: pagePad }]}>
          <VerifiedDetailsSection product={product} />
        </View>

        <RelatedProductsSection productId={product.id} />
      </ScrollView>

      {/* Sticky purchase bar */}
      <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.stickyBar, theme.shadows[3], { backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default, paddingBottom: insets.bottom || 16, paddingHorizontal: pagePad }]}>
        {!product.inStock ? (
          <Button label={t("product.outOfStock")} onPress={() => {}} variant="secondary" size="lg" disabled fullWidth />
        ) : justAdded ? (
          <Animated.View entering={FadeIn.duration(150)} style={[styles.cartBtn, { backgroundColor: theme.colors.status.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.text.inverse} />
            <Text variant="label" style={{ color: theme.colors.text.inverse }}>{t("product.addedToCart")}</Text>
          </Animated.View>
        ) : qty === 0 ? (
          <Button
            label={t("product.addWithPrice", { price: formatPrice(product.price, lang) })}
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
              <Text variant="caption" style={{ color: theme.colors.text.muted }}>{t("product.inCartAddMore")}</Text>
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
    <Pressable onPress={onPress} style={[styles.glassBtn, Platform.OS === "web" && { backgroundColor: `${theme.colors.canvas.surface}D9` }]} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {Platform.OS !== "web" && <BlurView intensity={50} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
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
  topBadge: { position: "absolute", top: 64, zIndex: 10 },
  heroWrap: { width: "100%", height: 350, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: "hidden", marginBottom: 16 },
  heroImg: { width: "100%", height: "100%" },
  heroFade: { position: "absolute", start: 0, end: 0, bottom: 0, height: 60 },
  center: { alignItems: "center", justifyContent: "center" },
  contentBlock: { padding: 20, borderBottomWidth: 1, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 16 },
  contentPad: { paddingHorizontal: 20, paddingBottom: 16 },
  ratingRow: { alignItems: "center", gap: 6, marginBottom: 12 },
  priceRow: { alignItems: "center", gap: 12 },
  lowStockPill: { alignSelf: "flex-start", alignItems: "center", gap: 5, marginTop: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  trustRow: { gap: 10 },
  trustItem: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderRadius: 14 },
  statusBox: { alignItems: "center", padding: 12, borderRadius: 12, gap: 8 },
  verifiedCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  verifiedHeader: { alignItems: "flex-start", gap: 12, padding: 16 },
  verifiedSealWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  verifiedTitleRow: { alignItems: "center", gap: 8 },
  verifiedToggle: { alignItems: "center", justifyContent: "center", gap: 6, borderTopWidth: 1, paddingVertical: 12 },
  verifiedDetails: { paddingHorizontal: 16, paddingBottom: 14 },
  detailRow: { alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingVertical: 9 },
  relatedSection: { paddingVertical: 24 },
  relatedScroll: { paddingHorizontal: 20, gap: 16 },
  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1 },
  cartBtn: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", height: 56, borderRadius: 28, gap: 8 },
  stepperWrap: { alignItems: "center", justifyContent: "space-between", height: 56 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  qtyBox: { alignItems: "center", justifyContent: "center" },
});
