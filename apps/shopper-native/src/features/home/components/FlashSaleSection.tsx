import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, FORWARD_CHEVRON } from "@/utils/layout";
import { kit } from "@/shared/kit";
import { useScreenLayout } from "@/utils/responsive";
import { ProductCard } from "@/components/ProductCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { flashStyles as fs, cntStyles as cs } from "./home.styles";
import type { NativeProduct } from "@/features/products";
import { useEndOfDayCountdown } from "../hooks/useEndOfDayCountdown";

// ─── CountdownUnit ────────────────────────────────────────────────────────────

const CountdownUnit = memo(function CountdownUnit({
  value, label,
}: { value: string; label: string }) {
  return (
    <View style={cs.unit}>
      <LinearGradient
        colors={[kit.color.accent, kit.color.accentDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cs.cell}
      >
        <UIText style={cs.value}>{value}</UIText>
      </LinearGradient>
      <UIText variant="eyebrow" color="tertiary" style={cs.unitLabel}>{label}</UIText>
    </View>
  );
});

// ─── CountdownDisplay — isolated so 1-second tick only re-renders this subtree
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

// ─── FlashSaleItem — stable list cell ────────────────────────────────────────

const FlashSaleItem = memo(function FlashSaleItem({
  item, lang, onPress,
}: {
  item:    NativeProduct;
  lang:    "ar" | "en";
  onPress: (id: string) => void;
}) {
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);
  return (
    <View style={fs.itemWrap}>
      <ProductCard
        product={item}
        lang={lang}
        badge="sale"
        onPress={handlePress}
      />
    </View>
  );
});

// ─── "View All" button styles ─────────────────────────────────────────────────

const va = StyleSheet.create({
  wrap: {
    paddingTop:    8,
    paddingBottom: 6,
  },
  btn: {
    borderRadius: kit.radius.pill,
    overflow:     "hidden",
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  btnInner: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    height:          52,
    borderRadius:    kit.radius.pill,
    paddingHorizontal: 20,
  },
  text: {
    fontFamily: theme.fonts.bold,
    fontSize: 14, 
    lineHeight: 21,
    color: "#fff",
    includeFontPadding: false,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
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
  const items       = products.slice(0, 6);
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
    <View style={fs.sectionGap}>
      {/* Header: countdown displays prominently; "See All" is a separate button */}
      <HomeSectionHeader
        eyebrow={t("home.flashEnds")}
        title={t("home.flashTitle")}
        icon="flash"
        accent={kit.color.accent}
        rightSlot={<CountdownDisplay />}
      />

      {/* Horizontal product rail with professional spacing */}
      <View style={fs.railContainer}>
        <FlashList
          data={items}
          keyExtractor={(p) => p.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[fs.railContent, { paddingHorizontal: pagePad }]}
          renderItem={renderFlashItem}
        />
      </View>

      {/* ── "View All Deals" CTA — animated gradient button ── */}
      {onViewAll && (
        <View style={[va.wrap, { paddingHorizontal: pagePad }]}>
          <Pressable
            onPress={handleViewAll}
            accessibilityRole="button"
            style={({ pressed }) => [va.btn, pressed && va.btnPressed]}>
            <LinearGradient
              colors={[kit.color.accent, kit.color.accentDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={va.btnInner}
            >
              <Ionicons name="flash" size={18} color="#fff" />
              <UIText style={va.text}>{t("home.viewAll")}</UIText>
              <Ionicons name={FORWARD_CHEVRON} size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </View>
  );
});
