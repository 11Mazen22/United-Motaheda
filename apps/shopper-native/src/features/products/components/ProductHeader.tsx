import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Badge } from "@/components/ui/Badge";
import { kit, Text as UIText } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import type { NativeProduct } from "@/features/products/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
const TRUST_ICONS: IoniconsName[] = ["shield-checkmark-outline", "thermometer-outline", "medal-outline", "storefront-outline"];

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: flexRow(IS_RTL), gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons key={s} name={value >= s ? "star" : value >= s - 0.5 ? "star-half" : "star-outline"} size={size} color="#D97706" />
      ))}
    </View>
  );
}

export const ProductHeader = React.memo(function ProductHeader({ product, hasRating, t }: { product: NativeProduct; hasRating: boolean; t: (key: string, options?: Record<string, unknown>) => string }) {
  return (
    <View style={{ gap: 22 }}>
      <Animated.View entering={FadeInDown.duration(400).delay(100).springify().damping(22)} style={trust.card}>
        <View style={[trust.row, { flexDirection: flexRow(IS_RTL) }]}>
          {[0, 1].map((i) => (
            <View key={i} style={[trust.cell, i === 0 && trust.cellDivider]}>
              <View style={trust.iconCircle}>
                <Ionicons name={TRUST_ICONS[i]} size={17} color={kit.color.accentDeep} />
              </View>
              <UIText variant="body-sm" weight="black" style={{ textAlign: "center" }}>{t(`product.trust${i}Title`)}</UIText>
              <UIText variant="caption" style={{ textAlign: "center", color: kit.color.inkFaint }}>{t(`product.trust${i}Sub`)}</UIText>
            </View>
          ))}
        </View>
        <View style={trust.rowDivider} />
        <View style={[trust.row, { flexDirection: flexRow(IS_RTL) }]}>
          {[2, 3].map((i) => (
            <View key={i} style={[trust.cell, i === 2 && trust.cellDivider]}>
              <View style={trust.iconCircle}>
                <Ionicons name={TRUST_ICONS[i]} size={17} color={kit.color.accentDeep} />
              </View>
              <UIText variant="body-sm" weight="black" style={{ textAlign: "center" }}>{t(`product.trust${i}Title`)}</UIText>
              <UIText variant="caption" style={{ textAlign: "center", color: kit.color.inkFaint }}>{t(`product.trust${i}Sub`)}</UIText>
            </View>
          ))}
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(380).delay(160).springify().damping(22)} style={{ gap: 14 }}>
        <View style={[identity.topRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={identity.catChip}>
            <UIText variant="caption" weight="bold" style={{ color: kit.color.accentDeep }}>{product.categoryName}</UIText>
          </View>
          <Badge variant={product.inStock ? "success" : "error"} size="sm">
            {product.inStock ? t("product.inStock") : t("product.outOfStock")}
          </Badge>
        </View>

        <View style={[identity.nameBlock, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={identity.nameAccent} />
          <View style={{ flex: 1, paddingStart: 14, gap: 5 }}>
            <UIText variant="h2" weight="black" style={{ textAlign: TEXT_START }} numberOfLines={3}>{product.nameAr ?? product.name}</UIText>
            {product.nameEn && (
              <UIText variant="body-sm" style={{ color: kit.color.inkFaint, fontStyle: "italic", textAlign: TEXT_START }}>{product.nameEn}</UIText>
            )}
          </View>
        </View>

        {hasRating && (
          <View style={[identity.ratingRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Stars value={product.ratingAvg!} size={14} />
            <UIText variant="body-sm" weight="black">{product.ratingAvg}</UIText>
            <UIText variant="caption" style={{ color: kit.color.inkFaint }}>
              {t("product.ratingCount", { count: product.ratingCount! })}
            </UIText>
          </View>
        )}
      </Animated.View>
    </View>
  );
});

const trust = StyleSheet.create({
  card: { backgroundColor: kit.color.surface, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: kit.color.line, borderTopWidth: 3, borderTopColor: kit.color.accentDeep, ...kit.shadow.raised },
  row: { alignItems: "flex-start" },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: kit.color.line, marginHorizontal: 16 },
  cell: { flex: 1, alignItems: "center", padding: 18, gap: 7 },
  cellDivider: { borderEndWidth: StyleSheet.hairlineWidth, borderEndColor: kit.color.line },
  iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: "rgba(14,126,116,0.18)", alignItems: "center", justifyContent: "center" },
});

const identity = StyleSheet.create({
  topRow: { alignItems: "center", justifyContent: "space-between" },
  catChip: { backgroundColor: kit.color.accentTint, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(14,126,116,0.18)" },
  nameBlock: { alignItems: "flex-start" },
  nameAccent: { width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: kit.color.accentDeep, flexShrink: 0 },
  ratingRow: { alignItems: "center", gap: 8 },
});
