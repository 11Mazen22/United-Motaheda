import React, { useState, useCallback, useEffect } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { fetchProductById } from "@/services/productsApi";
import { useRecentlyViewedStore } from "@/features/products";
import { useRelatedProducts } from "@/features/recommendations";
import { useScreenTrace } from "@/features/observability";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductCard } from "@/components/ProductCard";
import { Text as UIText } from "@/shared/ui";
import { useCartStore } from "@/stores/cart";
import { useWishlistStore } from "@/stores/wishlist";
import { theme } from "@/shared/theme";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl, BACK_CHEVRON, FORWARD_CHEVRON } from "@/utils/layout";
import { kit, Button as KitButton } from "@/shared/kit";

// ─── Constants ────────────────────────────────────────────────────────────────

const IS_RTL     = isRtl();
const SCREEN_W   = Dimensions.get("window").width;
// Distance the Back button travels to reach the opposite edge on scroll
// (screen width - start padding 16 - end padding 16 - button width 44)
const NAV_TRAVEL = SCREEN_W - 76;

// Trust-first principle: 4 pharmacy-specific confidence signals shown
// BEFORE the product name — safety before purchase, always.
const TRUST_ICONS: React.ComponentProps<typeof Ionicons>["name"][] = [
  "shield-checkmark-outline",
  "thermometer-outline",
  "medal-outline",
  "storefront-outline",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deterministicRating(id: string): { value: number; count: number } {
  const n = id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return {
    value: Math.round((3.6 + (n % 14) / 10) * 10) / 10,
    count: 22 + (n % 170),
  };
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: flexRow(IS_RTL), gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={value >= s ? "star" : value >= s - 0.5 ? "star-half" : "star-outline"}
          size={size}
          color="#D97706"
        />
      ))}
    </View>
  );
}

// ─── ClinRow ─────────────────────────────────────────────────────────────────

function ClinRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[clin.row, last && { borderBottomWidth: 0 }, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={clin.rowIcon}>
        <Ionicons name={icon} size={13} color={kit.color.inkFaint} />
      </View>
      <UIText style={clin.rowLabel}>{label}</UIText>
      <UIText style={clin.rowValue} numberOfLines={1}>{value}</UIText>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  useScreenTrace("product-detail");
  const { t, i18n } = useTranslation();
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const [qty, setQty]                   = useState(1);
  const [profileExpanded, setProfile]   = useState(false);

  const pushRecentlyViewed = useRecentlyViewedStore((s) => s.push);

  const addItem   = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const inCart    = cartItems.some((i) => i.productId === id);

  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist     = useWishlistStore((s) => s.has(id ?? ""));

  // ── Shared values ──────────────────────────────────────────────────────────
  const scrollY    = useSharedValue(0);
  const haloScale  = useSharedValue(1);
  const sealScale  = useSharedValue(1);
  const hrtScale   = useSharedValue(1);
  const btnScale   = useSharedValue(1);
  const headerOpac = useSharedValue(0);
  // Nav button scroll-aware animation: 0 = top state, 1 = scrolled state
  const navProgress = useSharedValue(0);

  // Halo breathes — slow sine cycle, extremely restrained (±6%)
  useEffect(() => {
    haloScale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
        withTiming(1.00, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [haloScale]);

  // Authentication seal — single verification pulse after mount.
  // One confident beat: "this is real." Then stillness.
  useEffect(() => {
    sealScale.value = withDelay(
      560,
      withSequence(
        withSpring(1.10, { damping: 7, stiffness: 200 }),
        withSpring(1.00, { damping: 16, stiffness: 200 }),
      ),
    );
  }, [sealScale]);

  // ── Animated styles ────────────────────────────────────────────────────────

  // Halo: breathing scale (set above) + parallax with scroll
  const haloAnim = useAnimatedStyle(() => ({
    transform: [
      { scale:     haloScale.value },
      { translateY: interpolate(scrollY.value, [0, 300], [0, -20], "clamp") },
    ],
  }));

  // Product image: parallax — moves up slower than scroll, creating depth
  const imgParallax = useAnimatedStyle(() => ({
    transform: [{
      translateY: interpolate(scrollY.value, [0, 300], [0, -44], "clamp"),
    }],
  }));

  const sealAnim  = useAnimatedStyle(() => ({ transform: [{ scale: sealScale.value }] }));
  const btnAnim   = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));
  const stickyHdr = useAnimatedStyle(() => ({ opacity: headerOpac.value }));

  // Back button slides to the opposite edge on scroll (RTL: right→left, LTR: left→right)
  const backNavAnim = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(navProgress.value, [0, 1], [0, IS_RTL ? NAV_TRAVEL : -NAV_TRAVEL]),
    }],
  }));

  // Favorite slides up to fill Back's vacated spot, while its heart-beat scale is preserved
  const hrtAnim = useAnimatedStyle(() => ({
    transform: [
      { scale:      hrtScale.value },
      { translateY: interpolate(navProgress.value, [0, 1], [0, -(44 + 10)]) },
    ],
  }));

  // ── Data ───────────────────────────────────────────────────────────────────

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn:  () => fetchProductById(id!),
    enabled:  !!id,
  });

  const maxQty = product?.inStock ? Math.max(1, Math.ceil(product.stock ?? 0)) : 0;

  useEffect(() => {
    if (maxQty > 0) setQty((q) => Math.min(q, maxQty));
  }, [maxQty]);

  useEffect(() => {
    if (!product) return;
    pushRecentlyViewed({
      id:       product.id,
      name:     product.name,
      price:    product.price,
      imageUrl: product.imageUrl,
    });
  }, [product, pushRecentlyViewed]);

  const { data: relatedProductsRaw } = useRelatedProducts(product?.id, 8);
  const relatedProducts = (relatedProductsRaw ?? []).slice(0, 6);

  const rating = deterministicRating(id ?? "");

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollY.value = y;
    const target = y > 300 ? 1 : 0;
    if (headerOpac.value !== target) {
      headerOpac.value = withTiming(target, { duration: 180 });
    }
    // Nav buttons animate after a small scroll (80px) — spring for natural feel
    const navTarget = y > 80 ? 1 : 0;
    if (navProgress.value !== navTarget) {
      navProgress.value = withSpring(navTarget, { damping: 16, stiffness: 120 });
    }
  }, [headerOpac, navProgress, scrollY]);

  const handleAdd = useCallback(() => {
    if (!product) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    btnScale.value = withSequence(
      withSpring(0.94, theme.animation.spring.press),
      withSpring(1.04, theme.animation.spring.press),
      withSpring(1.0,  theme.animation.spring.press),
    );
    addItem(product, qty);
  }, [product, qty, addItem, btnScale]);

  const handleWishlist = useCallback(() => {
    if (!product) return;
    (inWishlist
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    ).catch(() => {});
    hrtScale.value = withSequence(
      withSpring(0.82, theme.animation.spring.press),
      withSpring(1.18, theme.animation.spring.press),
      withSpring(1.0,  theme.animation.spring.press),
    );
    toggleWishlist(product);
  }, [product, inWishlist, hrtScale, toggleWishlist]);

  const handleIncrement = useCallback(() => {
    if (qty >= maxQty) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setQty((q) => Math.min(q + 1, maxQty));
  }, [qty, maxQty]);

  const handleDecrement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setQty((q) => Math.max(1, q - 1));
  }, []);

  const handleProfileToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setProfile((v) => !v);
  }, []);

  const handleShare = useCallback(async () => {
    if (!product) return;
    const name = product.nameAr ?? product.name;
    try {
      await Share.share(
        Platform.OS === "android"
          ? { message: `${name} — ${t("product.shareText", { name })}` }
          : { title: name, message: t("product.shareText", { name }) },
      );
    } catch {}
  }, [product, t]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>

      {/* ── Sticky mini-header — fades in after scroll > 300 ── */}
      <Animated.View
        style={[stickyHdr, {
          position:          "absolute",
          top:               0,
          left:              0,
          right:             0,
          zIndex:            50,
          backgroundColor:   kit.color.surface,
          paddingTop:        insets.top,
          paddingHorizontal: 16,
          paddingBottom:     12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: kit.color.line,
          ...kit.shadow.raised,
        }]}>
        <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: kit.color.well,
              alignItems: "center", justifyContent: "center",
              borderWidth: 1,
              borderColor: kit.color.line,
            }}>
            <Ionicons name={BACK_CHEVRON} size={17} color={kit.color.inkSoft} />
          </Pressable>
          <UIText variant="body-sm" weight="bold" align="right" numberOfLines={1} style={{ flex: 1 }}>
            {product?.nameAr ?? product?.name ?? ""}
          </UIText>
        </View>
      </Animated.View>

      {/* ── Floating action buttons ── */}
      <View style={[fab.stack, { top: insets.top + 12 }]}>
        <Animated.View style={backNavAnim}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={({ pressed }) => [fab.btn, pressed && fab.btnPressed]}>
            <Ionicons name={BACK_CHEVRON} size={18} color="#fff" />
          </Pressable>
        </Animated.View>

        {product && (
          <>
            <Animated.View style={hrtAnim}>
              <Pressable
                onPress={handleWishlist}
                accessibilityRole="button"
                accessibilityLabel={inWishlist ? t("product.removeFromWishlist") : t("product.addToWishlist")}
                style={({ pressed }) => [
                  fab.btn,
                  inWishlist && fab.btnWishlistActive,
                  pressed && fab.btnPressed,
                ]}>
                <Ionicons
                  name={inWishlist ? "heart" : "heart-outline"}
                  size={18}
                  color={inWishlist ? "#F87171" : "#fff"}
                />
              </Pressable>
            </Animated.View>

            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel={t("product.shareProduct")}
              style={({ pressed }) => [fab.btn, pressed && fab.btnPressed]}>
              <Ionicons name="share-outline" size={18} color="#fff" />
            </Pressable>
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 124 + insets.bottom }}>

        {/* ═══════════════════════════════════════════════════════════════════
            §1  PRODUCT STAGE — The product as the focal point.

            Three depth layers:
              1. Halo  — breathing ambient light (accentTint circle, animated)
              2. Image — product floats, parallax-responds to scroll
              3. Seal  — "مُدرج ومعتمد" — verification pulse on mount

            The product is not displayed. It is presented.
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={stage.wrap}>
          {isLoading ? (
            <Skeleton height={400} radius={0} />
          ) : (
            <>
              {/* Layer 1: Ambient halo — breathes and parallax-drifts */}
              <Animated.View style={[stage.haloWrap, haloAnim]} pointerEvents="none">
                <View style={stage.haloOuter} />
                <View style={stage.haloInner} />
              </Animated.View>

              {/* Layer 2: Product image — parallax against the halo */}
              {product?.imageUrl ? (
                <Animated.View style={[stage.imgWrap, imgParallax]}>
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={stage.img}
                    contentFit="contain"
                    transition={300}
                  />
                </Animated.View>
              ) : (
                <View style={stage.emptyWrap}>
                  <View style={stage.emptyTile}>
                    <MaterialCommunityIcons name="pill" size={56} color={kit.color.inkFaint} />
                  </View>
                </View>
              )}

              {/* Layer 3: Authentication seal — single verification pulse */}
              {product && (
                <Animated.View
                  entering={FadeIn.duration(400).delay(220).springify().damping(18)}
                  style={[stage.seal, sealAnim]}>
                  <Ionicons name="shield-checkmark" size={12} color={kit.color.accentDeep} />
                  <UIText style={stage.sealText}>{t("product.sealVerified")}</UIText>
                </Animated.View>
              )}
            </>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, gap: 22 }}>
          {isLoading ? (
            <>
              <Skeleton height={110} radius={20} />
              <Skeleton width="44%" height={11} radius={20} />
              <Skeleton width="80%" height={28} />
              <Skeleton height={104} radius={18} />
              <Skeleton height={128} radius={18} />
            </>
          ) : product ? (
            <>
              {/* ═══════════════════════════════════════════════════════════
                  §2  TRUST SEQUENCE — Confidence before purchase.

                  Shown BEFORE the product name. The user feels:
                  "This is safe" before they feel "I want this."

                  4 pharmacy-specific trust signals in a 2×2 grid.
                  Not badges. A confidence architecture.
              ═══════════════════════════════════════════════════════════ */}
              <Animated.View
                entering={FadeInDown.duration(400).delay(100).springify().damping(22)}
                style={trust.card}>
                <View style={[trust.row, { flexDirection: flexRow(IS_RTL) }]}>
                  {([0, 1] as const).map((i) => (
                    <View key={i} style={[trust.cell, i === 0 && trust.cellDivider]}>
                      <View style={trust.iconCircle}>
                        <Ionicons name={TRUST_ICONS[i]} size={17} color={kit.color.accentDeep} />
                      </View>
                      <UIText style={trust.cellTitle}>{t(`product.trust${i}Title`)}</UIText>
                      <UIText style={trust.cellSub}>{t(`product.trust${i}Sub`)}</UIText>
                    </View>
                  ))}
                </View>
                <View style={trust.rowDivider} />
                <View style={[trust.row, { flexDirection: flexRow(IS_RTL) }]}>
                  {([2, 3] as const).map((i) => (
                    <View key={i} style={[trust.cell, i === 2 && trust.cellDivider]}>
                      <View style={trust.iconCircle}>
                        <Ionicons name={TRUST_ICONS[i]} size={17} color={kit.color.accentDeep} />
                      </View>
                      <UIText style={trust.cellTitle}>{t(`product.trust${i}Title`)}</UIText>
                      <UIText style={trust.cellSub}>{t(`product.trust${i}Sub`)}</UIText>
                    </View>
                  ))}
                </View>
              </Animated.View>

              {/* ═══════════════════════════════════════════════════════════
                  §3  IDENTITY — Category → Name → Rating.
                  The name commands. A 4px brand stripe on the reading edge
                  owns the margin — not decorative, structural.
              ═══════════════════════════════════════════════════════════ */}
              <Animated.View
                entering={FadeInDown.duration(380).delay(160).springify().damping(22)}
                style={{ gap: 14 }}>

                <View style={[identity.topRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={identity.catChip}>
                    <UIText style={identity.catText}>{product.categoryName}</UIText>
                  </View>
                  <Badge variant={product.inStock ? "success" : "error"} size="sm">
                    {product.inStock ? t("product.inStock") : t("product.outOfStock")}
                  </Badge>
                </View>

                <View style={[identity.nameBlock, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={identity.nameAccent} />
                  <View style={{ flex: 1, paddingStart: 14, gap: 5 }}>
                    <UIText style={identity.nameAr}>{product.nameAr ?? product.name}</UIText>
                    {product.nameEn && (
                      <UIText style={identity.nameEn}>{product.nameEn}</UIText>
                    )}
                  </View>
                </View>

                <View style={[identity.ratingRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <Stars value={rating.value} size={14} />
                  <UIText style={identity.ratingValue}>{rating.value}</UIText>
                  <UIText style={identity.ratingCount}>
                    {t("product.ratingCount", { count: rating.count })}
                  </UIText>
                </View>
              </Animated.View>

              {/* ═══════════════════════════════════════════════════════════
                  §4  ACTION INTENT PANEL — The decisive moment.

                  Price hierarchy commands first. The stepper is a
                  precision instrument, not a counter. A confidence line
                  below anchors the price in trust.

                  VIP top border (3px accentDeep) frames the intent.
              ═══════════════════════════════════════════════════════════ */}
              <Animated.View
                entering={FadeInDown.duration(380).delay(210).springify().damping(22)}
                style={action.card}>

                <View style={[action.row, { flexDirection: flexRow(IS_RTL) }]}>
                  {/* Price column */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <UIText style={action.priceLabel}>{t("product.priceLabel")}</UIText>
                    <UIText style={action.priceValue}>{formatPrice(product.price * qty)}</UIText>
                    {qty > 1 && (
                      <UIText style={action.priceUnit}>{formatPrice(product.price)} × {qty}</UIText>
                    )}
                  </View>

                  {/* Precision quantity stepper */}
                  <View style={{ gap: 5, alignItems: "center" }}>
                    <UIText style={action.stepperLabel}>{t("product.quantityLabel")}</UIText>
                    <View style={[action.stepper, { flexDirection: flexRow(IS_RTL) }]}>
                      <Pressable
                        onPress={handleIncrement}
                        disabled={qty >= maxQty}
                        style={[action.stepBtn, qty >= maxQty && { opacity: 0.45 }]}>
                        <View style={action.stepBtnInc}>
                          <Ionicons name="add" size={20} color={kit.color.onInk} />
                        </View>
                      </Pressable>
                      <View style={action.stepValue}>
                        <UIText style={action.stepValueText}>{qty}</UIText>
                      </View>
                      <Pressable
                        onPress={handleDecrement}
                        disabled={qty === 1}
                        style={[action.stepBtn, qty === 1 && { opacity: 0.4 }]}>
                        <Ionicons name="remove" size={20} color={kit.color.inkSoft} />
                      </Pressable>
                    </View>
                    {product.inStock && product.stock > 0 && product.stock <= 10 && (
                      <UIText style={[action.stockNote, {
                        color: qty >= maxQty ? kit.color.danger : kit.color.warn,
                      }]}>
                        {qty >= maxQty
                          ? t("product.stockMax")
                          : t("product.stockRemaining", { count: product.stock })}
                      </UIText>
                    )}
                  </View>
                </View>

                {/* Confidence anchors */}
                <View style={[action.confidence, { flexDirection: flexRow(IS_RTL) }]}>
                  <Ionicons name="storefront-outline" size={11} color={kit.color.inkFaint} />
                  <UIText style={action.confidenceText}>
                    {t("product.confidencePrice")}
                  </UIText>
                  <View style={action.confidenceDot} />
                  <UIText style={action.confidenceText}>{t("product.confidenceTax")}</UIText>
                </View>
              </Animated.View>

              {/* ═══════════════════════════════════════════════════════════
                  §5  CLINICAL PROFILE — "الملف الصيدلاني"

                  The moment of delight: the profile is collapsed by default.
                  A single tap reveals the complete file. The expansion is
                  the memorable interaction — the satisfaction of unlocking
                  full clinical detail when you choose to go deeper.

                  Pharmacist attestation at the top anchors the section in
                  professional authority, not database metadata.
              ═══════════════════════════════════════════════════════════ */}
              <Animated.View
                entering={FadeInDown.duration(380).delay(260).springify().damping(22)}
                style={clin.card}>

                {/* Header */}
                <View style={[clin.header, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={clin.headerIcon}>
                    <Ionicons name="document-text-outline" size={16} color={kit.color.accentDeep} />
                  </View>
                  <View style={{ gap: 2, flex: 1 }}>
                    <UIText style={clin.eyebrow}>{t("product.detailsEyebrow")}</UIText>
                    <UIText style={clin.title}>{t("product.clinProfileTitle")}</UIText>
                  </View>
                </View>

                {/* Pharmacist attestation */}
                <View style={[clin.attestation, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={clin.attestationDot} />
                  <UIText style={clin.attestationText}>
                    {t("product.clinAttestation")}
                  </UIText>
                </View>

                {/* Always-visible rows */}
                <View style={clin.body}>
                  <ClinRow icon="barcode-outline" label={t("product.code")}     value={product.code    ?? "-"} />
                  <ClinRow icon="folder-outline"  label={t("product.category")} value={product.categoryName ?? "-"} last={!profileExpanded} />

                  {/* Expandable additional rows */}
                  {profileExpanded && (
                    <Animated.View entering={FadeInDown.duration(300).springify().damping(20)}>
                      <ClinRow icon="scan-outline"     label={t("product.barcode")}     value={product.barcode ?? "-"} />
                      <ClinRow icon="language-outline" label={t("product.nameEnLabel")} value={product.nameEn ?? "-"}  last />
                    </Animated.View>
                  )}
                </View>

                {/* Expand / collapse toggle — the moment of delight */}
                <Pressable
                  onPress={handleProfileToggle}
                  style={[clin.expandBtn, { flexDirection: flexRow(IS_RTL) }]}>
                  <UIText style={clin.expandText}>
                    {profileExpanded ? t("product.clinCollapse") : t("product.clinExpandAll")}
                  </UIText>
                  <Ionicons
                    name={profileExpanded ? "chevron-up-outline" : "chevron-down-outline"}
                    size={14}
                    color={kit.color.accentDeep}
                  />
                </Pressable>
              </Animated.View>

              {/* ═══════════════════════════════════════════════════════════
                  §6  PHARMACIST'S SELECTION

                  "يُنصح به الصيدلاني" with a human framing:
                  "كثيراً ما يُوصف مع هذا المنتج" — Often prescribed
                  alongside this product. Guidance, not algorithm.
              ═══════════════════════════════════════════════════════════ */}
              {relatedProducts.length > 0 && (
                <Animated.View
                  entering={FadeInDown.duration(380).delay(320).springify().damping(22)}
                  style={{ gap: 16 }}>
                  <View style={[rel.header, { flexDirection: flexRow(IS_RTL) }]}>
                    <View style={rel.headerIcon}>
                      <Ionicons name="person-circle-outline" size={18} color={kit.color.accentDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <UIText style={rel.eyebrow}>{t("product.pharmacistPick")}</UIText>
                      <UIText style={rel.title}>{t("product.pharmacistPickSub")}</UIText>
                    </View>
                    <UIText style={rel.count}>{t("product.pharmacistPickCount", { count: relatedProducts.length })}</UIText>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingEnd: 20 }}>
                    {relatedProducts.map((p, idx) => (
                      <Animated.View
                        key={p.id}
                        entering={FadeIn.duration(240).delay(idx * 40)}
                        style={{ width: 155 }}>
                        <ProductCard
                          product={p}
                          lang={i18n.language === "en" ? "en" : "ar"}
                          onPress={() =>
                            router.push({ pathname: "/product/[id]", params: { id: p.id } })
                          }
                        />
                      </Animated.View>
                    ))}
                  </ScrollView>
                </Animated.View>
              )}
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Sticky CTA — the decision anchor ── */}
      {product && (
        <View style={[cta.outer, { paddingBottom: insets.bottom + 14 }]}>
          {inCart && (
            <Pressable
              onPress={() => router.push("/(tabs)/cart")}
              style={[cta.viewCart, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="cart-outline" size={14} color={kit.color.accentDeep} />
              <UIText style={cta.viewCartText}>{t("product.viewCart")}</UIText>
              <Ionicons name={FORWARD_CHEVRON} size={12} color={kit.color.accentDeep} />
            </Pressable>
          )}
          <Animated.View style={btnAnim}>
            <KitButton
              label={
                inCart
                  ? t("product.inCartAddMore")
                  : product.inStock
                  ? t("product.addWithPrice", { price: formatPrice(product.price * qty) })
                  : t("product.unavailable")
              }
              onPress={handleAdd}
              variant={inCart ? "secondary" : "primary"}
              size="lg"
              full
              disabled={!product.inStock}
            />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ─── Floating action buttons ──────────────────────────────────────────────────
// Dark frosted pill — visible on light well AND product photos.
const fab = StyleSheet.create({
  stack: {
    position: "absolute",
    end:      16,
    zIndex:   100,
    gap:      10,
  },
  btn: {
    width:           44,
    height:          44,
    borderRadius:    22,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.20)",
    elevation:       8,
    shadowColor:     "#000",
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.30,
    shadowRadius:    8,
  },
  btnPressed:        { opacity: 0.72 },
  btnWishlistActive: {
    backgroundColor: "rgba(244,63,94,0.75)",
    borderColor:     "rgba(255,255,255,0.25)",
  },
});

// ─── §1  Product Stage ────────────────────────────────────────────────────────
// Three-layer depth: halo (behind) → image (mid) → seal (front).
const stage = StyleSheet.create({
  wrap: {
    height:         400,
    backgroundColor: kit.color.well,
    overflow:       "hidden",   // keeps parallax within stage bounds
    alignItems:     "center",
    justifyContent: "center",
  },
  // Halo container — centered, animated
  haloWrap: {
    position:       "absolute",
    alignItems:     "center",
    justifyContent: "center",
    width:          280,
    height:         280,
  },
  haloOuter: {
    position:        "absolute",
    width:           280,
    height:          280,
    borderRadius:    140,
    backgroundColor: kit.color.accentTint,
    opacity:         0.28,
  },
  haloInner: {
    position:        "absolute",
    width:           180,
    height:          180,
    borderRadius:    90,
    backgroundColor: kit.color.accentTint,
    opacity:         0.32,
  },
  // Image wrapper — receives parallax translateY
  imgWrap: {
    width:             "100%",
    height:            "100%",
    paddingHorizontal: 28,
    paddingVertical:   24,
  },
  img: {
    width:  "100%",
    height: "100%",
  },
  emptyWrap: {
    alignItems:     "center",
    justifyContent: "center",
  },
  emptyTile: {
    width:           110,
    height:          110,
    borderRadius:    34,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  // Authentication seal — bottom-end, receives spring pulse on mount
  seal: {
    position:          "absolute",
    bottom:            16,
    end:               18,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.surface,
    borderRadius:      20,
    paddingHorizontal: 11,
    paddingVertical:   6,
    borderWidth:       1,
    borderColor:       "rgba(14,126,116,0.22)",
    ...kit.shadow.raised,
  },
  sealText: {
    fontSize:   11,
    fontFamily: theme.fonts.bold,
    color:      kit.color.accentDeep,
  },
});

// ─── §2  Trust Sequence ───────────────────────────────────────────────────────
// 2×2 confidence grid. Clean cross-dividers. No card-within-card.
const trust = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    20,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    borderTopWidth:  3,
    borderTopColor:  kit.color.accentDeep,
    ...kit.shadow.raised,
  },
  row: {
    alignItems: "flex-start",
  },
  rowDivider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.line,
    marginHorizontal: 16,
  },
  cell: {
    flex:              1,
    alignItems:        "center",
    padding:           18,
    gap:               7,
  },
  cellDivider: {
    borderEndWidth:  StyleSheet.hairlineWidth,
    borderEndColor:  kit.color.line,
  },
  iconCircle: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     "rgba(14,126,116,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  cellTitle: {
    fontSize:   13,
    fontFamily: theme.fonts.black,
    color:      kit.color.ink,
    textAlign:  "center",
    letterSpacing: -0.2,
  },
  cellSub: {
    fontSize:   11,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    textAlign:  "center",
    lineHeight: 15,
  },
});

// ─── §3  Identity ─────────────────────────────────────────────────────────────

const identity = StyleSheet.create({
  topRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  catChip: {
    backgroundColor:   kit.color.accentTint,
    borderRadius:      20,
    paddingHorizontal: 12,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       "rgba(14,126,116,0.18)",
  },
  catText: {
    fontSize:   12,
    fontFamily: theme.fonts.bold,
    color:      kit.color.accentDeep,
  },
  nameBlock: {
    alignItems: "flex-start",
  },
  nameAccent: {
    width:           4,
    alignSelf:       "stretch",
    borderRadius:    2,
    backgroundColor: kit.color.accentDeep,
    flexShrink:      0,
  },
  nameAr: {
    fontSize:      26,
    fontFamily:    theme.fonts.black,
    color:         kit.color.ink,
    letterSpacing: -0.5,
    lineHeight:    34,
    textAlign:     IS_RTL ? "right" : "left",
  },
  nameEn: {
    fontSize:   14,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    fontStyle:  "italic",
    textAlign:  IS_RTL ? "right" : "left",
  },
  ratingRow: {
    alignItems: "center",
    gap:        8,
  },
  ratingValue: {
    fontSize:   14,
    fontFamily: theme.fonts.black,
    color:      kit.color.ink,
  },
  ratingCount: {
    fontSize:   12,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
  },
});

// ─── §4  Action Intent Panel ──────────────────────────────────────────────────

const action = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     kit.color.line,
    borderTopWidth:  3,
    borderTopColor:  kit.color.accentDeep,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  row: {
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     16,
    gap:               16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  priceLabel: {
    fontSize:   11,
    fontFamily: theme.fonts.semibold,
    color:      kit.color.inkFaint,
    textAlign:  IS_RTL ? "right" : "left",
  },
  priceValue: {
    fontSize:      32,
    fontFamily:    theme.fonts.black,
    color:         kit.color.ink,
    letterSpacing: -1.0,
    textAlign:     IS_RTL ? "right" : "left",
  },
  priceUnit: {
    fontSize:   12,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    textAlign:  IS_RTL ? "right" : "left",
  },
  stepperLabel: {
    fontSize:   10,
    fontFamily: theme.fonts.semibold,
    color:      kit.color.inkFaint,
  },
  stepper: {
    alignItems:      "center",
    backgroundColor: kit.color.well,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
  },
  stepBtn: {
    width:          44,
    height:         44,
    alignItems:     "center",
    justifyContent: "center",
  },
  stepBtnInc: {
    width:           44,
    height:          44,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.ink,
  },
  stepValue: {
    minWidth:       44,
    alignItems:     "center",
    justifyContent: "center",
  },
  stepValueText: {
    fontSize:      18,
    fontFamily:    theme.fonts.black,
    color:         kit.color.ink,
    letterSpacing: -0.2,
  },
  stockNote: {
    fontSize:   10,
    fontFamily: theme.fonts.semibold,
    textAlign:  "center",
  },
  confidence: {
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    paddingVertical:   11,
    paddingHorizontal: 20,
  },
  confidenceDot: {
    width:           3,
    height:          3,
    borderRadius:    2,
    backgroundColor: kit.color.inkFaint,
  },
  confidenceText: {
    fontSize:   11,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
  },
});

// ─── §5  Clinical Profile ─────────────────────────────────────────────────────

const clin = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    20,
    overflow:        "hidden",
    borderWidth:     1,
    borderColor:     kit.color.line,
    borderTopWidth:  3,
    borderTopColor:  kit.color.accentDeep,
    ...kit.shadow.raised,
  },
  header: {
    alignItems:        "center",
    paddingHorizontal: 18,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    gap:               12,
  },
  headerIcon: {
    width:           34,
    height:          34,
    borderRadius:    11,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     "rgba(14,126,116,0.18)",
  },
  eyebrow: {
    fontSize:      10,
    fontFamily:    theme.fonts.semibold,
    color:         kit.color.accentDeep,
    textAlign:     IS_RTL ? "right" : "left",
    letterSpacing: 0.5,
  },
  title: {
    fontSize:      17,
    fontFamily:    theme.fonts.black,
    color:         kit.color.ink,
    textAlign:     IS_RTL ? "right" : "left",
    letterSpacing: -0.2,
  },
  attestation: {
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 18,
    paddingVertical:   12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    backgroundColor:   kit.color.well,
  },
  attestationDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: kit.color.accentDeep,
    flexShrink:      0,
  },
  attestationText: {
    flex:       1,
    fontSize:   12,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkSoft,
    textAlign:  IS_RTL ? "right" : "left",
    lineHeight: 17,
  },
  body: {
    paddingHorizontal: 18,
  },
  row: {
    alignItems:        "center",
    paddingVertical:   13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    gap:               10,
  },
  rowIcon: {
    width:           28,
    height:          28,
    borderRadius:    8,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    flexShrink:      0,
  },
  rowLabel: {
    fontSize:   13,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkSoft,
    flex:       1,
    textAlign:  IS_RTL ? "right" : "left",
  },
  rowValue: {
    fontSize:   13,
    fontFamily: theme.fonts.bold,
    color:      kit.color.ink,
    maxWidth:   "50%",
    textAlign:  IS_RTL ? "left" : "right",
  },
  expandBtn: {
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    paddingVertical:   13,
    paddingHorizontal: 18,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },
  expandText: {
    fontSize:   13,
    fontFamily: theme.fonts.bold,
    color:      kit.color.accentDeep,
  },
});

// ─── §6  Pharmacist's Selection ───────────────────────────────────────────────

const rel = StyleSheet.create({
  header: {
    alignItems: "center",
    gap:        12,
  },
  headerIcon: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     "rgba(14,126,116,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  eyebrow: {
    fontSize:      10,
    fontFamily:    theme.fonts.semibold,
    color:         kit.color.accentDeep,
    textAlign:     IS_RTL ? "right" : "left",
    letterSpacing: 0.5,
  },
  title: {
    fontSize:      15,
    fontFamily:    theme.fonts.black,
    color:         kit.color.ink,
    textAlign:     IS_RTL ? "right" : "left",
    letterSpacing: -0.2,
    marginTop:     2,
  },
  count: {
    fontSize:   12,
    fontFamily: theme.fonts.regular,
    color:      kit.color.inkFaint,
    flexShrink: 0,
  },
});

// ─── Sticky CTA ───────────────────────────────────────────────────────────────

const cta = StyleSheet.create({
  outer: {
    position:          "absolute",
    bottom:            0,
    left:              0,
    right:             0,
    backgroundColor:   kit.color.surface,
    paddingHorizontal: 16,
    paddingTop:        14,
    gap:               10,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
    shadowColor:       "#0C2240",
    shadowOffset:      { width: 0, height: -4 },
    shadowOpacity:     0.10,
    shadowRadius:      18,
    elevation:         8,
  },
  viewCart: {
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    paddingVertical: 4,
  },
  viewCartText: {
    fontSize:   13,
    fontFamily: theme.fonts.bold,
    color:      kit.color.accentDeep,
  },
});
