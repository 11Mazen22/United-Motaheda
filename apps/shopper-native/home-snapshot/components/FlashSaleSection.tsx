/**
 * FlashSaleSection — PROTECTED performance-optimised flash-sale rail.
 */

import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "../shared/ui/Text";
import { theme } from "../shared/theme";
import { flexRow, isRtl, FORWARD_CHEVRON } from "../utils/layout";
import { kit } from "../shared/kit";
import { ProductCard } from "./ProductCard";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { flashStyles as fs, cntStyles as cs } from "./home.styles";
import type { NativeProduct } from "../features/products/types";
import { useEndOfDayCountdown } from "../hooks/useEndOfDayCountdown";

const SALE_DISCOUNTS = [25, 15, 20, 30, 10, 20];

const CountdownUnit = memo(function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <View style={cs.unit}>
      <View style={cs.cell}>
        <UIText style={cs.value}>{value}</UIText>
      </View>
      <UIText variant="eyebrow" color="tertiary" style={cs.unitLabel}>{label}</UIText>
    </View>
  );
});

const CountdownDisplay = memo(function CountdownDisplay() {
  const { t }       = useTranslation();
  const { h, m, s } = useEndOfDayCountdown();
  return (
    <View style={cs.timerRow}>
      <CountdownUnit value={s} label={t("home.flashSec")} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={m} label={t("home.flashMin")} />
      <UIText style={cs.colon}>:</UIText>
      <CountdownUnit value={h} label={t("home.flashHrs")} />
    </View>
  );
});

const FlashSaleItem = memo(function FlashSaleItem({ item, index, lang, onPress }: { item: NativeProduct; index: number; lang: "ar" | "en"; onPress: (id: string) => void; }) {
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);
  return (
    <View style={fs.itemWrap}>
      <ProductCard
        product={item}
        lang={lang}
        badge="sale"
        discountPercent={SALE_DISCOUNTS[index % SALE_DISCOUNTS.length]}
        onPress={handlePress}
      />
    </View>
  );
});

interface FlashSaleSectionProps {
  products:       NativeProduct[];
  onProductPress: (id: string) => void;
  onViewAll?:     () => void;
}

export const FlashSaleSection = memo(function FlashSaleSection({ products, onProductPress, onViewAll }: FlashSaleSectionProps) {
  const { t, i18n } = useTranslation();
  const lang        = i18n.language === "en" ? "en" as const : "ar" as const;
  const items       = products.slice(0, 6);

  const renderFlashItem = useCallback(
    ({ item, index }: { item: NativeProduct; index: number }) => (
      <FlashSaleItem item={item} index={index} lang={lang} onPress={onProductPress} />
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
      <HomeSectionHeader
        eyebrow={t("home.flashEnds")}
        title={t("home.flashTitle")}
        icon="flash"
        accent={kit.color.danger}
        rightSlot={<CountdownDisplay />}
      />

      <FlashList
        data={items}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.layout.pagePaddingH }}
        renderItem={renderFlashItem}
      />

      {onViewAll && (
        <View style={va.wrap}>
          <Pressable onPress={handleViewAll} accessibilityRole="button" style={({ pressed }) => [va.btn, pressed && va.btnPressed]}>
            <View style={va.btnInner}>
              <Ionicons name="flame" size={15} color={kit.color.danger} />
              <UIText style={va.text}>{t("home.viewAll")}</UIText>
              <Ionicons name={FORWARD_CHEVRON} size={15} color={kit.color.inkSoft} />
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
});

const va = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingTop:        10,
  },
  btn: {
    borderRadius: kit.radius.pill,
    overflow:     "hidden",
  },
  btnPressed: { opacity: 0.85 },
  btnInner: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    height:          46,
    borderRadius:    kit.radius.pill,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  text: {
    fontFamily: theme.fonts.black,
    fontSize: 13, lineHeight: 19,
    color: kit.color.ink,
    includeFontPadding: false,
  },
});
