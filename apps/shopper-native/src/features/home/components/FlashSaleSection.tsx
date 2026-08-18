/**
 * FlashSaleSection — 2026 Premium Redesign.
 *
 * Matches the reference image "عروض حصرية" section:
 *   • Section header + "عرض الكل" affordance
 *   • Large full-bleed gradient banner card (teal) with:
 *       - "خصومات تصل إلى 50%" headline
 *       - Product image collage (overlapping)
 *       - Dot pagination
 *       - "تسوق الآن" CTA button
 *   • Horizontal product rail below (when products exist)
 *   • Countdown timer displayed in the section header right slot
 *
 * All previous props preserved.
 */

import React, {
  memo,
  useCallback,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { ProductCard } from "@/components/ProductCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles, cntStyles as cs } from "./home.styles";
import { useEndOfDayCountdown } from "../hooks/useEndOfDayCountdown";
import type { NativeProduct } from "@/features/products";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Countdown unit ───────────────────────────────────────────────────────────

const CountdownUnit = memo(function CountdownUnit({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={cs.unit}>
      <View style={cs.cell}>
        <UIText style={cs.value}>{value}</UIText>
      </View>
      <UIText style={cs.unitLabel}>{label}</UIText>
    </View>
  );
});

const CountdownDisplay = memo(function CountdownDisplay() {
  const { t }       = useTranslation();
  const { h, m, s } = useEndOfDayCountdown();
  return (
    <View style={cs.timerRow}>
      <CountdownUnit value={h} label={t("home.flashHrs")} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={m} label={t("home.flashMin")} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={s} label={t("home.flashSec")} />
    </View>
  );
});

// ─── Offer banner card ────────────────────────────────────────────────────────

interface OfferBannerCardProps {
  products:   NativeProduct[];
  onShopNow:  () => void;
  pagePad:    number;
}

const OfferBannerCard = memo(function OfferBannerCard({
  products,
  onShopNow,
  pagePad,
}: OfferBannerCardProps) {
  const { t } = useTranslation();

  // Take up to 3 products with images for the collage
  const collageItems = products.filter((p) => p.imageUrl).slice(0, 3);

  return (
    <View style={[s.bannerWrap, { marginHorizontal: pagePad }]}>
      <LinearGradient
        colors={["#0A5F58", "#0E7E74", "#12A898"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.bannerCard}
      >
        {/* Decorative orb */}
        <View
          style={s.bannerOrb}
          pointerEvents="none"
        />

        {/* ── Text side ── */}
        <View style={s.bannerText}>
          <UIText style={s.bannerEyebrow}>{t("home.flashBannerEyebrow")}</UIText>
          <UIText style={s.bannerHeadline} numberOfLines={2}>
            {t("home.flashBannerHeadline")}
          </UIText>
          <UIText style={s.bannerDiscount}>50%</UIText>

          <Pressable
            onPress={() => {
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onShopNow();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("home.flashShopNow")}
            style={({ pressed }) => [s.shopNowBtn, pressed && s.shopNowBtnPressed]}
          >
            <UIText style={s.shopNowText}>{t("home.flashShopNow")}</UIText>
            <Ionicons name={FORWARD_CHEVRON} size={13} color={kit.color.accentDeep} />
          </Pressable>
        </View>

        {/* ── Product collage ── */}
        {collageItems.length > 0 && (
          <View style={s.collage}>
            {collageItems.map((p, i) => (
              <View
                key={p.id}
                style={[
                  s.collageItem,
                  i === 0 && s.collageItemLarge,
                  i === 1 && s.collageItemMid,
                  i === 2 && s.collageItemSmall,
                ]}
              >
                <Image
                  source={{ uri: p.imageUrl! }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            ))}
          </View>
        )}
      </LinearGradient>
    </View>
  );
});

// ─── Product rail item ────────────────────────────────────────────────────────

const FlashSaleItem = memo(function FlashSaleItem({
  item,
  lang,
  onPress,
}: {
  item:    NativeProduct;
  lang:    "ar" | "en";
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);
  return (
    <View style={s.itemWrap}>
      <ProductCard
        product={item}
        lang={lang}
        badge="sale"
        onPress={handlePress}
      />
    </View>
  );
});

// ─── FlashSaleSection ─────────────────────────────────────────────────────────

interface FlashSaleSectionProps {
  products:       NativeProduct[];
  onProductPress: (id: string) => void;
  onViewAll?:     () => void;
}

export const FlashSaleSection = memo(function FlashSaleSection({
  products,
  onProductPress,
  onViewAll,
}: FlashSaleSectionProps) {
  const { t, i18n } = useTranslation();
  const lang        = i18n.language === "en" ? "en" as const : "ar" as const;
  const items       = products.slice(0, 8);
  const { pagePad } = useScreenLayout();

  const renderFlashItem = useCallback(
    ({ item }: { item: NativeProduct }) => (
      <FlashSaleItem item={item} lang={lang} onPress={onProductPress} />
    ),
    [lang, onProductPress],
  );

  const handleViewAll = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onViewAll?.();
  }, [onViewAll]);

  if (items.length === 0) return null;

  return (
    <View style={sectionStyles.wrap}>
      {/* Section header — countdown in right slot */}
      <HomeSectionHeader
        eyebrow={t("home.flashEnds")}
        title={t("home.flashTitle")}
        icon="flash"
        accent={kit.color.danger}
        rightSlot={<CountdownDisplay />}
        onMore={onViewAll}
      />

      {/* Full-bleed offer banner */}
      <OfferBannerCard
        products={items}
        onShopNow={handleViewAll}
        pagePad={pagePad}
      />

      {/* Horizontal product rail */}
      <View style={s.railContainer}>
        <FlashList
          data={items}
          keyExtractor={(p) => p.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: pagePad, paddingVertical: 4 }}
          renderItem={renderFlashItem}
        />
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // ── Offer banner ─────────────────────────────────────────────────────────
  bannerWrap: {
    shadowColor:   "#0A5F58",
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius:  20,
    elevation:     8,
  },
  bannerCard: {
    borderRadius:   20,
    overflow:       "hidden",
    minHeight:      160,
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "stretch",
    padding:        20,
    gap:            12,
  },
  bannerOrb: {
    position:        "absolute",
    top:             -40,
    ...(IS_RTL ? { start: -40 } : { end: -40 }),
    width:           160,
    height:          160,
    borderRadius:    80,
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // Text side
  bannerText: {
    flex: 1,
    gap:  8,
    justifyContent: "center",
  },
  bannerEyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    color:              "rgba(255,255,255,0.75)",
    textAlign:          TEXT_START,
    letterSpacing:      0.8,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  bannerHeadline: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    lineHeight:         22,
    color:              "#FFFFFF",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  bannerDiscount: {
    fontFamily:         theme.fonts.black,
    fontSize:           42,
    lineHeight:         48,
    color:              "#FFFFFF",
    textAlign:          TEXT_START,
    letterSpacing:      -1,
    includeFontPadding: false,
  },
  shopNowBtn: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    alignSelf:         IS_RTL ? "flex-end" : "flex-start",
    paddingHorizontal: 16,
    paddingVertical:   9,
    borderRadius:      kit.radius.pill,
    backgroundColor:   "#FFFFFF",
    marginTop:         4,
  },
  shopNowBtnPressed: {
    opacity: 0.85,
  },
  shopNowText: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         17,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // Product collage (right side of banner)
  collage: {
    width:    130,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  collageItem: {
    position:        "absolute",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius:    10,
    overflow:        "hidden",
  },
  collageItemLarge: {
    width:  90,
    height: 90,
    top:    -10,
    ...(IS_RTL ? { start: 10 } : { end: 10 }),
    zIndex: 3,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 12,
  },
  collageItemMid: {
    width:  60,
    height: 60,
    top:    50,
    ...(IS_RTL ? { end: 50 } : { start: 50 }),
    zIndex: 2,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  collageItemSmall: {
    width:  50,
    height: 50,
    top:    80,
    ...(IS_RTL ? { start: 5 } : { end: 5 }),
    zIndex: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  // Product rail
  railContainer: {
    overflow: "hidden",
  },
  itemWrap: {
    width:     166,
    marginEnd: 12,
  },
});
