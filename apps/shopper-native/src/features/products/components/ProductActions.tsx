import { defaultTheme as theme } from "@pharmacy/ui-native";
import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { Text as UIText, Button as KitButton } from "@pharmacy/ui-native";
import { isRtl, flexRow, FORWARD_CHEVRON } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import type { NativeProduct } from "@/features/products/types";

const IS_RTL = isRtl();

interface ProductActionsProps {
  product: NativeProduct;
  qty: number;
  maxQty: number;
  inCart: boolean;
  btnAnim: Record<string, unknown>;
  setCtaHeight: (height: number) => void;
  insets: { bottom: number };
  router: { push: (path: string) => void };
  t: (key: string, options?: Record<string, unknown>) => string;
  lang: "ar" | "en";
  handleAdd: () => void;
  handleIncrement: () => void;
  handleDecrement: () => void;
}

export const ProductActions = React.memo(function ProductActions({
  product,
  qty,
  maxQty,
  inCart,
  btnAnim,
  setCtaHeight,
  insets,
  router,
  t,
  lang,
  handleAdd,
  handleIncrement,
  handleDecrement
}: ProductActionsProps) {
  if (!product) return null;

  return (
    <View
      onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)}
      style={[cta.outer, { paddingBottom: insets.bottom + 12 }]}>
      {inCart && (
        <Pressable
          onPress={() => router.push("/(customer)/(tabs)/cart")}
          accessibilityRole="button"
          accessibilityLabel={t("product.viewCart")}
          style={cta.viewCartTouchable}>
          {({ pressed }) => (
            <View style={[cta.viewCart, { flexDirection: flexRow(IS_RTL) }, pressed && cta.viewCartPressed]}>
              <Ionicons name="cart-outline" size={14} color={theme.colors.brand.primary} />
              <UIText variant="body-sm" weight="black" style={{ color: theme.colors.brand.primary }}>{t("product.viewCart")}</UIText>
              <Ionicons name={FORWARD_CHEVRON} size={12} color={theme.colors.brand.primary} />
            </View>
          )}
        </Pressable>
      )}
      
      <View style={[cta.actionsRow, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={action.stepper}>
          <Pressable
            onPress={handleDecrement}
            disabled={qty === 1}
            accessibilityRole="button"
            accessibilityLabel={t("product.decrement")}
            style={({ pressed }) => [action.stepBtn, pressed && !(qty === 1) && action.stepBtnPressed, qty === 1 && action.stepBtnDisabled]}>
            <Ionicons name="remove" size={20} color={qty === 1 ? theme.colors.text.muted : theme.colors.text.secondary} />
          </Pressable>

          <View style={action.stepValue}>
            <UIText variant="body" weight="black">{qty}</UIText>
          </View>

          <Pressable
            onPress={handleIncrement}
            disabled={qty >= maxQty}
            accessibilityRole="button"
            accessibilityLabel={t("product.increment")}
            style={({ pressed }) => [action.stepBtnPrimary, pressed && !(qty >= maxQty) && action.stepBtnPrimaryPressed, qty >= maxQty && action.stepBtnDisabled]}>
            <Ionicons name="add" size={20} color={theme.colors.text.inverse} />
          </Pressable>
        </View>

        <Animated.View style={[btnAnim, { flex: 1 }]}>
          <KitButton
            label={
              inCart
                ? t("product.inCartAddMore")
                : product.inStock
                ? t("product.addWithPrice", { price: formatPrice(product.price * qty, lang) })
                : t("product.unavailable")
            }
            icon={inCart ? "add" : "cart-outline"}
            onPress={handleAdd}
            variant={inCart ? "secondary" : "primary"}
            size="lg"
            full
            disabled={!product.inStock}
          />
        </Animated.View>
      </View>
      {product.inStock && product.stock > 0 && product.stock <= 10 && (
        <UIText variant="caption" weight="bold" style={{ color: qty >= maxQty ? theme.colors.status.error : theme.colors.status.warning, textAlign: "center" }}>
          {qty >= maxQty ? t("product.stockMax") : t("product.stockRemaining", { count: product.stock })}
        </UIText>
      )}
    </View>
  );
});

const cta = StyleSheet.create({
  outer: { position: "absolute", bottom: 0, start: 0, end: 0, backgroundColor: theme.colors.canvas.surface, paddingHorizontal: 16, paddingTop: 14, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border.default, shadowColor: "#0C2240", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.10, shadowRadius: 18, elevation: 8 },
  viewCartTouchable: { alignSelf: "center" },
  viewCart: { alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9999, backgroundColor: "transparent", alignSelf: "center" },
  viewCartPressed: { backgroundColor: theme.colors.brand.primaryLight },
  actionsRow: { alignItems: "center", gap: 12 },
});

const action = StyleSheet.create({
  stepper: { flexDirection: flexRow(IS_RTL), alignItems: "center", backgroundColor: theme.colors.canvas.surfaceMuted, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border.default, padding: 3, gap: 3 },
  stepBtn: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.canvas.surface, borderWidth: 1, borderColor: theme.colors.border.default },
  stepBtnPressed: { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary, transform: [{ scale: 0.96 }] },
  stepBtnDisabled: { opacity: 0.45 },
  stepBtnPrimary: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.primary, borderWidth: 1, borderColor: theme.colors.brand.primary },
  stepBtnPrimaryPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  stepValue: { minWidth: 40, height: 42, alignItems: "center", justifyContent: "center" },
});
