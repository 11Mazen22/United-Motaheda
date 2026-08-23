import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { kit, Text as UIText } from "@pharmacy/ui-native";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import type { NativeProduct } from "@/features/products/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export const ProductPricing = React.memo(function ProductPricing({ product, qty, t }: { product: NativeProduct; qty: number; t: (key: string) => string }) {
  return (
    <Animated.View entering={FadeInDown.duration(380).delay(210).springify().damping(22)} style={action.card}>
      <View style={[action.row, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={action.priceCol}>
          <UIText variant="caption" weight="bold" style={{ color: kit.color.inkFaint, textAlign: TEXT_START }}>
            {t("product.priceLabel")}
          </UIText>

          <View style={[action.priceRow, { flexDirection: flexRow(IS_RTL) }]}>
            <UIText variant="h2" weight="bold" style={{ color: kit.color.accent }}>
              {(product.price * qty).toFixed(2)}
            </UIText>
            <UIText variant="body" style={{ color: kit.color.inkSoft }}>
              {t("common.currency")}
            </UIText>
          </View>

          {product.hasActivePromotion && product.basePrice > product.price && (
            <View style={[action.priceCompareRow, { flexDirection: flexRow(IS_RTL) }]}> 
              <UIText variant="body-sm" style={{ color: kit.color.inkFaint, textDecorationLine: "line-through", flexShrink: 1 }} numberOfLines={1}>
                {(product.basePrice * qty).toFixed(2)} {t("common.currency")}
              </UIText>
              {product.discountPercent && product.discountPercent > 0 && (
                <View style={action.discountChip}>
                  <UIText variant="caption" weight="black" style={{ color: kit.color.danger }}>
                    -{product.discountPercent}%
                  </UIText>
                </View>
              )}
            </View>
          )}

          {qty > 1 && (
            <UIText variant="caption" style={{ color: kit.color.inkFaint, textAlign: TEXT_START, marginTop: 2 }}>
              {product.price.toFixed(2)} {t("common.currency")} × {qty}
            </UIText>
          )}
        </View>
      </View>

      <View style={[action.confidence, { flexDirection: flexRow(IS_RTL) }]}>
        <Ionicons name="storefront-outline" size={11} color={kit.color.inkFaint} />
        <UIText variant="caption" style={{ color: kit.color.inkFaint }}>
          {t("product.confidencePrice")}
        </UIText>
        <View style={action.confidenceDot} />
        <UIText variant="caption" style={{ color: kit.color.inkFaint }}>{t("product.confidenceTax")}</UIText>
      </View>
    </Animated.View>
  );
});

const action = StyleSheet.create({
  card: { backgroundColor: kit.color.surface, borderRadius: 20, borderWidth: 1, borderColor: kit.color.line, borderTopWidth: 3, borderTopColor: kit.color.accentDeep, overflow: "hidden", ...kit.shadow.raised },
  row: { alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line },
  priceCol: { flex: 1, gap: 4, flexShrink: 1, minWidth: 0 },
  priceRow: { alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  priceCompareRow: { alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 },
  discountChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: kit.color.dangerTint, borderWidth: 1, borderColor: "rgba(239,68,68,0.32)" },
  confidence: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 11, paddingHorizontal: 20 },
  confidenceDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: kit.color.inkFaint },
});
