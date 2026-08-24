/**
 * DailyEdit — editorial "today's picks" rail: a hero card (full-bleed image,
 * name, price, CTA) plus a 2–3 column compact row below. More considered
 * than a plain horizontal list — this is Home's "featured products" section.
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
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text as UIText, CustomerUI, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { ProductCard } from "@/components/ProductCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import { fetchFeaturedProducts, productKeys } from "@/features/products";
import { formatPrice } from "@/utils/format";
import type { NativeProduct } from "@/features/products";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const GAP = 12;
const STALE_MS = 90_000;
const EDIT_LIMIT = 6;

const SPRING_IN = { damping: 10, stiffness: 380 } as const;
const SPRING_OUT = { damping: 14, stiffness: 280 } as const;

export interface DailyEditProps {
  lang: "ar" | "en";
  onProductPress: (id: string) => void;
  onViewAll?: () => void;
}

export const DailyEdit = memo(function DailyEdit({
  lang,
  onProductPress,
  onViewAll,
}: DailyEditProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { data, isLoading } = useQuery<NativeProduct[]>({
    queryKey: productKeys.featured(EDIT_LIMIT),
    queryFn: () => fetchFeaturedProducts(EDIT_LIMIT),
    staleTime: STALE_MS,
    gcTime: 5 * 60_000,
  });

  const { width, isTablet, pagePad } = useScreenLayout();

  const products = (data ?? []).filter((p) => p.imageUrl);

  if (isLoading) return (
    <View style={sectionStyles.wrap}>
      <HomeSectionHeader eyebrow="..." title="..." icon="bookmark-outline" />
      <View style={{ paddingHorizontal: pagePad }}>
         <CustomerUI.Skeleton width="100%" height={240} radius={16} />
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
        onMore={onViewAll}
      />

      <View style={[s.body, { paddingHorizontal: pagePad }]}>
        <EditorialHeroCard
          product={hero}
          lang={lang}
          onPress={() => onProductPress(hero.id)}
          theme={theme}
        />

        {second && (
          <View style={s.compactRow}>
            <View style={{ width: compactW }}>
              <ProductCard product={second} lang={lang} onPress={() => onProductPress(second.id)} />
            </View>
            {third && (
              <View style={{ width: compactW }}>
                <ProductCard product={third} lang={lang} onPress={() => onProductPress(third.id)} />
              </View>
            )}
            {isTablet && fourth && (
              <View style={{ width: compactW }}>
                <ProductCard product={fourth} lang={lang} onPress={() => onProductPress(fourth.id)} />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
});

interface EditorialHeroCardProps {
  product: NativeProduct;
  lang: "ar" | "en";
  onPress: () => void;
  theme: NativeTheme;
}

const EditorialHeroCard = memo(function EditorialHeroCard({
  product,
  lang,
  onPress,
  theme,
}: EditorialHeroCardProps) {
  const { t } = useTranslation();

  const displayName =
    lang === "ar"
      ? (product.nameAr ?? product.name)
      : (product.name ?? product.nameAr);

  const isSale = product.hasActivePromotion;
  const isNew = Boolean(product.isNew);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => { scale.value = withSpring(0.97, SPRING_IN); }, [scale]);
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
      <Animated.View style={[s.heroCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[2], animStyle]}>
        <View style={[s.heroImageWrap, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
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
              <Ionicons name="medkit-outline" size={36} color={theme.colors.text.muted} />
            </View>
          )}
          {(isSale || isNew) && (
            <View
              style={[
                s.heroBadge,
                { backgroundColor: isSale ? theme.colors.status.error : theme.colors.brand.primary },
              ]}
            >
              <UIText style={styles.heroBadgeText}>
                {isSale ? t("common.sale") : t("common.new")}
              </UIText>
            </View>
          )}
        </View>

        <View style={s.heroBody}>
          <UIText variant="eyebrow" style={{ color: theme.colors.brand.primary, textAlign: TEXT_START }}>{t("home.dailyEditHeroLead")}</UIText>
          <UIText variant="card-title" numberOfLines={2} style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>
            {displayName}
          </UIText>
          {Boolean(product.categoryName) && (
            <UIText variant="caption" numberOfLines={1} style={{ color: theme.colors.text.muted, textAlign: TEXT_START }}>
              {product.categoryName}
            </UIText>
          )}
          <View style={s.heroFoot}>
            <UIText variant="h4" style={{ color: theme.colors.text.primary }}>{formatPrice(product.price)}</UIText>
            <View style={[s.heroCta, { backgroundColor: theme.colors.brand.primary }]}>
              <UIText style={[styles.heroCtaText, { color: theme.colors.text.inverse }]}>{t("home.dailyEditShopNow")}</UIText>
              <Ionicons name={FORWARD_CHEVRON} size={12} color={theme.colors.text.inverse} />
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const s = StyleSheet.create({
  body: { gap: GAP },
  heroCard: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "stretch",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 160,
  },
  heroImageWrap: { width: 148, alignItems: "center", justifyContent: "center", padding: 12 },
  heroImage: { width: "100%", height: "100%" },
  heroImageEmpty: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  heroBadge: { position: "absolute", top: 10, start: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  heroBody: { flex: 1, paddingHorizontal: 16, paddingVertical: 16, justifyContent: "space-between", gap: 6 },
  heroFoot: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 },
  heroCta: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999 },
  compactRow: { flexDirection: flexRow(IS_RTL), gap: GAP },
});

const styles = StyleSheet.create({
  heroBadgeText: { fontSize: 9, lineHeight: 13, color: "#FFFFFF", letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "800" },
  heroCtaText: { fontSize: 11, lineHeight: 15, fontWeight: "800" },
});
