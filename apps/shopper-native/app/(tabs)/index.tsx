/**
 * HomeScreen — V2 arrival architecture.
 *
 * The app renders fully and immediately on every mount.
 * On cold launch an ArrivalOverlay sits on top and plays the cinematic
 * 5-phase sequence (freeze → spatial expansion → brand anchor →
 * construction → dissolve). When it completes, it unmounts and the
 * fully-assembled HomeScreen is visible beneath. No content "appears" —
 * it was always there, waiting to be revealed.
 *
 * On re-entry (back nav, tab switch): arrivalComplete=true → showArrival
 * starts false → overlay never mounts. Feels instant.
 */

import React, {
  memo,
  useCallback,
  useState,
} from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets }              from "react-native-safe-area-context";
import { useRouter }                      from "expo-router";
import { useTranslation }                 from "react-i18next";
import { useQuery, useQueryClient }       from "@tanstack/react-query";
import { Ionicons }                       from "@expo/vector-icons";
import { Text as UIText }                 from "@/shared/ui";
import { flexRow, isRtl, textAlignStart } from "../../src/utils/layout";

// ─── Stores ──────────────────────────────────────────────────────────────────
import { useCartStore, selectItemCount }  from "../../src/stores/cart";
import { useAuth }                        from "../../src/features/auth";

// ─── API ─────────────────────────────────────────────────────────────────────
import {
  categoryKeys,
  fetchCategories,
  productKeys,
  useInfiniteProducts,
} from "../../src/features/products";

// ─── Section components ───────────────────────────────────────────────────────
import { DeliveryHeader }         from "../../src/features/home/components/DeliveryHeader";
import { QuickActions }           from "../../src/features/home/components/QuickActions";
import { CategoryStrip }          from "../../src/features/home/components/CategoryStrip";
import { TodayCare }              from "../../src/features/home/components/TodayCare";
import { FlashSaleSection }       from "../../src/features/home/components/FlashSaleSection";
import { RecentlyViewedCarousel } from "../../src/features/home/components/RecentlyViewedCarousel";
import { PharmacistCard }         from "../../src/features/home/components/PharmacistCard";
import { FeaturedSection }        from "../../src/features/home/components/FeaturedSection";
import { ArrivalOverlay }         from "../../src/features/home/components/ArrivalOverlay";

// ─── Theme ───────────────────────────────────────────────────────────────────
import { theme } from "../../src/shared/theme";
import { kit }   from "../../src/shared/kit";

// ─── Module-level arrival guard ───────────────────────────────────────────────
// Resets on each cold launch (JS reload); persists across in-app navigations.
let arrivalComplete = false;

const CANVAS     = kit.color.canvas;
const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Trust strip data (inline bilingual — same pattern as TodayCare) ─────────

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TRUST_ITEMS: Array<{
  icon: IoniconsName; value: string; label: string;
  color: string; tint: string;
}> = IS_RTL
  ? [
      { icon: "star",                    value: "4.9",   label: "تقييم",   color: kit.color.warn,      tint: kit.color.warnTint    },
      { icon: "cube-outline",            value: "5000+", label: "منتج",    color: kit.color.accentDeep, tint: kit.color.accentTint  },
      { icon: "flash-outline",           value: "30د",   label: "توصيل",   color: kit.color.success,   tint: kit.color.successTint },
      { icon: "shield-checkmark-outline",value: "100%",  label: "أصالة",   color: kit.color.ink,       tint: kit.color.well        },
    ]
  : [
      { icon: "star",                    value: "4.9",   label: "Rating",   color: kit.color.warn,      tint: kit.color.warnTint    },
      { icon: "cube-outline",            value: "5,000+",label: "Products", color: kit.color.accentDeep, tint: kit.color.accentTint  },
      { icon: "flash-outline",           value: "30 min",label: "Delivery", color: kit.color.success,   tint: kit.color.successTint },
      { icon: "shield-checkmark-outline",value: "100%",  label: "Genuine",  color: kit.color.ink,       tint: kit.color.well        },
    ];

// ─── Promo banner content (inline bilingual) ──────────────────────────────────

const PROMO_CONTENT = IS_RTL
  ? {
      eyebrow:  "عرض اليوم",
      headline: "خصم ٣٠٪ على\nالأدوية المزمنة",
      sub:      "لطلبات فوق ٢٠٠ ج.م · توصيل مجاني",
      cta:      "تسوق الآن",
      badge:    "٣٠٪",
      badgeSub: "خصم",
    }
  : {
      eyebrow:  "Today's Deal",
      headline: "30% Off\nChronic Medications",
      sub:      "Orders above EGP 200 · Free delivery",
      cta:      "Shop Now",
      badge:    "30%",
      badgeSub: "OFF",
    };

// ─── Hairline divider ────────────────────────────────────────────────────────

const Divider = memo(function Divider() {
  return <View style={s.divider} />;
});

// ─── Trust strip ─────────────────────────────────────────────────────────────

const TrustStrip = memo(function TrustStrip() {
  return (
    <View style={s.trustRow}>
      {TRUST_ITEMS.map((item, i) => (
        <View key={i} style={s.trustItem}>
          <View style={[s.trustIcon, { backgroundColor: item.tint }]}>
            <Ionicons name={item.icon} size={14} color={item.color} />
          </View>
          <UIText style={s.trustValue}>{item.value}</UIText>
          <UIText style={s.trustLabel}>{item.label}</UIText>
        </View>
      ))}
    </View>
  );
});

// ─── Promo banner ────────────────────────────────────────────────────────────

interface PromoBannerProps {
  onBannerPress: (route: string) => void;
}

const PromoBanner = memo(function PromoBanner({ onBannerPress }: PromoBannerProps) {
  const p = PROMO_CONTENT;
  return (
    <Pressable
      onPress={() => onBannerPress("/deals")}
      accessibilityRole="button"
      style={({ pressed }) => [s.promoCard, pressed && s.promoCardPressed]}>

      {/* Leading: text stack + CTA */}
      <View style={s.promoBody}>
        <UIText style={s.promoEyebrow}>{p.eyebrow}</UIText>
        <UIText style={s.promoHeadline}>{p.headline}</UIText>
        <UIText style={s.promoSub}>{p.sub}</UIText>
        <View style={s.promoCta}>
          <UIText style={s.promoCtaText}>{p.cta}</UIText>
          <Ionicons
            name={IS_RTL ? "chevron-back" : "chevron-forward"}
            size={14}
            color={kit.color.onInk}
          />
        </View>
      </View>

      {/* Trailing: discount badge */}
      <View style={s.promoBadge}>
        <UIText style={s.promoBadgePct}>{p.badge}</UIText>
        <UIText style={s.promoBadgeSub}>{p.badgeSub}</UIText>
      </View>
    </Pressable>
  );
});

// ─── HomeScreen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { i18n }  = useTranslation();
  const { user }  = useAuth();
  const cartCount = useCartStore(selectItemCount);
  const qc        = useQueryClient();

  const lang = (i18n.language === "en" ? "en" : "ar") as "ar" | "en";

  // ── Arrival overlay ───────────────────────────────────────────────────────
  const [showArrival, setShowArrival] = useState(!arrivalComplete);

  const handleArrivalComplete = useCallback(() => {
    arrivalComplete = true;
    setShowArrival(false);
  }, []);

  // ── Lazy below-fold ───────────────────────────────────────────────────────
  const [belowFold, setBelowFold] = useState(false);
  const onScrollBeginDrag = useCallback(() => {
    if (!belowFold) setBelowFold(true);
  }, [belowFold]);

  const [refreshing, setRefreshing] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────────

  const categoriesQ = useQuery({
    queryKey:  categoryKeys.list(),
    queryFn:   fetchCategories,
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
  });

  const {
    products: saleProducts,
    isLoading: saleLoading,
  } = useInfiniteProducts({
    isSale:   true,
    pageSize: 8,
    sortBy:   "price_asc",
    enabled:  true,
  });

  // ── Navigation callbacks ──────────────────────────────────────────────────

  const goCart     = useCallback(() => router.push("/(tabs)/cart"    as any), [router]);
  const goSearch   = useCallback(() => router.push("/search"         as any), [router]);
  const goNotifs   = useCallback(() => router.push("/notifications"  as any), [router]);
  const goDeals    = useCallback(() => router.push("/deals"          as any), [router]);
  const goFeatured = useCallback(() => router.push("/featured"       as any), [router]);
  const goAllCats  = useCallback(() => router.push("/(tabs)/products"     ), [router]);

  const goCategory = useCallback(
    (id: string) =>
      router.push({ pathname: "/products" as any, params: { categoryId: id } }),
    [router],
  );

  const goProduct = useCallback(
    (id: string) =>
      router.push({ pathname: "/product/[id]" as any, params: { id } }),
    [router],
  );

  const goBanner   = useCallback((route: string) => router.push(route as any), [router]);
  const goNavigate = useCallback((route: string) => router.push(route as any), [router]);

  // ── Pull-to-refresh ───────────────────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: categoryKeys.list() }),
      qc.invalidateQueries({ queryKey: productKeys.featured(12) }),
      qc.invalidateQueries({ queryKey: ["products"] }),
    ]);
    setRefreshing(false);
  }, [qc]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={CANVAS} />

      <DeliveryHeader
        insets={insets}
        user={user}
        cartCount={cartCount}
        onCartPress={goCart}
        onSearchPress={goSearch}
        onNotifPress={goNotifs}
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        scrollEventThrottle={32}
        onScrollBeginDrag={onScrollBeginDrag}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kit.color.accentDeep}
            colors={[kit.color.accentDeep]}
            progressBackgroundColor={kit.color.surface}
          />
        }
      >
        {/* Trust strip */}
        <TrustStrip />

        {/* Today's care (authed only) */}
        {Boolean(user) && <TodayCare />}

        {/* Quick actions */}
        <QuickActions onNavigate={goNavigate} />

        <Divider />

        {/* Promotional banner */}
        <View style={s.bannerWrap}>
          <PromoBanner onBannerPress={goBanner} />
        </View>

        <Divider />

        {/* Category strip */}
        <CategoryStrip
          categories={categoriesQ.data ?? []}
          isLoading={categoriesQ.isLoading}
          lang={lang}
          onCategoryPress={(id, _name, _nameEn) => goCategory(id)}
          onViewAll={goAllCats}
        />

        <Divider />

        {/* Flash sale */}
        {(saleProducts.length > 0 || saleLoading) && (
          <FlashSaleSection
            products={saleProducts}
            onProductPress={goProduct}
            onViewAll={goDeals}
          />
        )}

        {/* Below-fold: lazy after first scroll */}
        {belowFold && (
          <>
            <Divider />
            <RecentlyViewedCarousel lang={lang} onProductPress={goProduct} />
            <Divider />
            <FeaturedSection lang={lang} onProductPress={goProduct} onViewAll={goFeatured} />
            <Divider />
            <PharmacistCard />
          </>
        )}

        <View style={{ height: Math.max(insets.bottom, 16) + 72 }} />
      </ScrollView>

      {/* Cinematic arrival — sits above everything, dissolves to reveal the app */}
      {showArrival && (
        <ArrivalOverlay
          topInset={insets.top}
          onComplete={handleArrivalComplete}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  // ── Trust strip ───────────────────────────────────────────────────────────
  trustRow: {
    flexDirection:     flexRow(IS_RTL),
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingVertical:   kit.sp(3),
    backgroundColor:   kit.color.surface,
    borderBottomWidth: 1,
    borderBottomColor: kit.color.line,
  },
  trustItem: {
    flex:           1,
    alignItems:     "center",
    gap:            3,
  },
  trustIcon: {
    width:          30,
    height:         30,
    borderRadius:   15,
    alignItems:     "center",
    justifyContent: "center",
  },
  trustValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  trustLabel: {
    fontFamily:         theme.fonts.regular,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Promo banner ─────────────────────────────────────────────────────────
  bannerWrap: {
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingVertical:   kit.sp(1),
  },
  promoCard: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    gap:             16,
    padding:         20,
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  promoCardPressed: {
    opacity: 0.88,
  },
  promoBody: {
    flex: 1,
    gap:  6,
  },
  promoEyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  promoHeadline: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    lineHeight:         24,
    color:              kit.color.ink,
    letterSpacing:      -0.3,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  promoSub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  promoCta: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    marginTop:         4,
    height:            38,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentDeep,
    paddingHorizontal: 16,
    alignSelf:         "stretch",
  },
  promoCtaText: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.onInk,
    includeFontPadding: false,
  },
  promoBadge: {
    width:           70,
    height:          70,
    borderRadius:    35,
    backgroundColor: kit.color.ink,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    gap:             1,
  },
  promoBadgePct: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    lineHeight:         24,
    color:              kit.color.onInk,
    includeFontPadding: false,
  },
  promoBadgeSub: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              "rgba(255,255,255,0.65)",
    includeFontPadding: false,
  },

  // ── Hairline divider ─────────────────────────────────────────────────────
  divider: {
    height:           1,
    marginHorizontal: theme.layout.pagePaddingH,
    backgroundColor:  kit.color.line,
    marginVertical:   kit.sp(2),
    opacity:          0.6,
  },
});
