import React, { useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, Layout, SlideInDown } from "react-native-reanimated";

import { Text, Button, EmptyState, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";

import { useCartStore, selectPricing, type CartItem } from "@/stores/cart";
import { useCartStateMachine, type ConflictItem } from "@/features/cart/hooks/useCartStateMachine";
import { FREE_DELIVERY_THRESHOLD } from "@/features/delivery/constants";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

function PremiumCartItem({ item, conflict, theme }: { item: CartItem; conflict?: ConflictItem; theme: NativeTheme }) {
  const { t, i18n } = useTranslation();
  const updateQty = useCartStore(s => s.updateQty);
  const removeItem = useCartStore(s => s.removeItem);
  const router = useRouter();

  const handleIncrement = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (item.quantity >= item.product.stock) return;
    updateQty(item.productId, item.quantity + 1);
  }, [item, updateQty]);

  const handleDecrement = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    if (item.quantity > 1) {
      updateQty(item.productId, item.quantity - 1);
    } else {
      removeItem(item.productId);
    }
  }, [item, updateQty, removeItem]);

  const name = (i18n.language === "en" ? (item.product.nameEn || item.product.nameAr || item.product.name) : (item.product.nameAr || item.product.nameEn || item.product.name)) ?? "";
  const hasDiscount = item.product.hasActivePromotion && item.product.basePrice > item.product.price;
  const isOutOfStock = conflict?.type === "unavailable" || (conflict?.type === "stock" && conflict.serverStock === 0);

  return (
    <Animated.View layout={Layout.springify()} entering={FadeIn} exiting={FadeOut.duration(200)} style={[styles.itemCard, theme.shadows[1], { backgroundColor: theme.colors.canvas.surface, borderColor: conflict ? theme.colors.status.error : theme.colors.border.default }]}>
      <Pressable onPress={() => router.push(`/(customer)/(shop)/product/${item.productId}`)} style={[styles.itemContent, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={styles.itemImageWrap}>
          <LinearGradient
            colors={theme.isDark
              ? [theme.colors.canvas.surfaceMuted, theme.colors.canvas.elevated]
              : [theme.colors.brand.primaryLight, theme.colors.canvas.surface]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {item.product.imageUrl ? (
            <Image source={{ uri: item.product.imageUrl }} style={styles.itemImage} placeholder={DEFAULT_BLURHASH} contentFit="contain" />
          ) : (
             <Ionicons name="medkit-outline" size={32} color={theme.colors.text.muted} />
          )}
        </View>

        <View style={styles.itemDetails}>
          <Text variant="body" weight="bold" numberOfLines={2} style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>
            {name}
          </Text>

          <View style={[styles.itemPriceRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Text variant="h5" style={{ color: theme.colors.text.primary }}>{formatPrice(item.product.price, i18n.language === "en" ? "en" : "ar")}</Text>
            {hasDiscount && (
              <Text variant="caption" style={{ color: theme.colors.text.muted, textDecorationLine: "line-through", marginHorizontal: 8 }}>
                {formatPrice(item.product.basePrice, i18n.language === "en" ? "en" : "ar")}
              </Text>
            )}
          </View>

          {conflict && (
            <View style={[styles.conflictBox, { backgroundColor: `${theme.colors.status.error}1A`, flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="warning" size={14} color={theme.colors.status.error} />
              <Text variant="caption" weight="bold" style={{ color: theme.colors.status.error }}>
                {conflict.type === "unavailable" ? t("cart.itemUnavailable", "Item no longer available") :
                 conflict.type === "stock" ? t("cart.onlyStockLeft", { count: conflict.serverStock, defaultValue: `Only ${conflict.serverStock} left` }) :
                 t("cart.priceChanged", "Price updated")}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      <View style={[styles.itemFooter, { flexDirection: flexRow(IS_RTL), borderTopColor: theme.colors.border.default }]}>
        {isOutOfStock ? (
          <Pressable onPress={() => removeItem(item.productId)} style={styles.removeBtnText} accessibilityRole="button" accessibilityLabel={t("common.remove", "Remove")}>
             <Text variant="body" weight="bold" style={{ color: theme.colors.status.error }}>{t("common.remove", "Remove")}</Text>
          </Pressable>
        ) : (
          <View style={[styles.qtyControl, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }]}>
             <Pressable onPress={handleDecrement} style={styles.qtyBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={item.quantity === 1 ? t("product.remove", "Remove") : t("product.decrease", "Decrease quantity")}>
                <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={item.quantity === 1 ? theme.colors.status.error : theme.colors.brand.primary} />
             </Pressable>
             <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, width: 28, textAlign: "center" }}>
                {item.quantity.toLocaleString("ar-EG")}
             </Text>
             <Pressable onPress={handleIncrement} style={styles.qtyBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("product.increase", "Increase quantity")}>
                <Ionicons name="add" size={16} color={item.quantity >= item.product.stock ? theme.colors.text.disabled : theme.colors.brand.primary} />
             </Pressable>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

export default function CartScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" as const : "ar" as const;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const items = useCartStore(s => s.items);
  const pricing = useCartStore(selectPricing);
  const cartState = useCartStateMachine();
  const clearCart = useCartStore(s => s.clearCart);

  const isCartEmpty = items.length === 0;

  if (isCartEmpty) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
        <LinearGradient
          colors={gradients.brandPrimary as unknown as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
           <Text variant="h3" style={{ color: "#fff" }}>{t("cart.title", "My Basket")}</Text>
        </LinearGradient>
        <EmptyState
          illustrationName="empty"
          title={t("cart.emptyTitle", "Your basket is empty")}
          subtitle={t("cart.emptySubtitle", "Looks like you haven't added anything yet. Discover our premium pharmacy products.")}
          action={{ label: t("common.startShopping", "Start Shopping"), onPress: () => router.replace("/(customer)/(tabs)/products") }}
        />
      </View>
    );
  }

  const amountToFreeDelivery = FREE_DELIVERY_THRESHOLD - pricing.subtotal;
  const progressPercent = Math.min(100, Math.max(0, (pricing.subtotal / FREE_DELIVERY_THRESHOLD) * 100));

  const hasBlockingConflict = cartState.conflicts.some(c => c.type === "unavailable" || (c.type === "stock" && c.serverStock === 0));

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.canvas.background }]}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
         <Text variant="h3" style={{ color: "#fff" }}>{t("cart.title", "My Basket")} · {items.length}</Text>
         <Pressable onPress={clearCart} accessibilityRole="button" accessibilityLabel={t("common.clear", "Clear")} style={styles.clearChip}>
            <Text variant="body" weight="medium" style={{ color: "#fff" }}>{t("common.clear", "Clear")}</Text>
         </Pressable>
      </LinearGradient>

      <FlatList
        data={items}
        keyExtractor={item => item.productId}
        contentContainerStyle={{ padding: 16, paddingBottom: 240 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animated.View entering={SlideInDown} style={[styles.deliveryProgressCard, theme.shadows[1], { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <View style={[styles.progressHeader, { flexDirection: flexRow(IS_RTL) }]}>
               <Ionicons name="bicycle-outline" size={24} color={theme.colors.brand.primary} />
               <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text variant="body" weight="bold" style={{ color: theme.colors.text.primary, textAlign: TEXT_START }}>
                     {amountToFreeDelivery > 0 ? t("cart.addForFreeDelivery", { amount: formatPrice(amountToFreeDelivery, lang), defaultValue: `Add ${formatPrice(amountToFreeDelivery, lang)} for FREE delivery` }) : t("cart.freeDeliveryUnlocked", "Free Delivery Unlocked!")}
                  </Text>
               </View>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.canvas.background }]}>
               <Animated.View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? theme.colors.status.success : theme.colors.brand.accent }]} />
            </View>
          </Animated.View>
        }
        renderItem={({ item }) => {
          const conflict = cartState.conflicts.find(c => c.productId === item.productId);
          return <PremiumCartItem item={item} conflict={conflict} theme={theme} />;
        }}
      />

      <Animated.View entering={SlideInDown.duration(400)} style={[styles.checkoutDock, theme.shadows[3], { backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default, paddingBottom: Platform.OS === "ios" ? 34 : 20 }]}>
        <View style={styles.dockSummary}>
           <Text variant="body" style={{ color: theme.colors.text.secondary }}>{t("cart.total", "Total")}</Text>
           <Text variant="h3" style={{ color: theme.colors.text.primary }}>{formatPrice(pricing.total, lang)}</Text>
        </View>
        <Button
           label={hasBlockingConflict ? t("cart.resolveConflicts", "Resolve Issues") : t("cart.checkout", "Checkout")}
           variant={hasBlockingConflict ? "secondary" : "primary"}
           tone={hasBlockingConflict ? "solid" : "gradient"}
           onPress={() => {
             if (hasBlockingConflict) {
               Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
               return;
             }
             Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
             router.push("/(customer)/checkout");
           }}
           style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: flexRow(IS_RTL), justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  clearChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.16)" },

  deliveryProgressCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  progressHeader: { alignItems: "center", marginBottom: 12 },
  progressBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },

  itemCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  itemContent: { padding: 12, alignItems: "center" },
  itemImageWrap: { width: 80, height: 80, borderRadius: 12, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  itemImage: { width: "100%", height: "100%" },
  itemDetails: { flex: 1, paddingHorizontal: 12, justifyContent: "center" },
  itemPriceRow: { alignItems: "center", marginTop: 4 },
  conflictBox: { alignItems: "center", padding: 6, borderRadius: 6, marginTop: 8, gap: 4 },

  itemFooter: { borderTopWidth: 1, padding: 8, paddingHorizontal: 12, justifyContent: "space-between", alignItems: "center" },
  removeBtnText: { paddingVertical: 6, paddingHorizontal: 12 },
  qtyControl: { alignItems: "center", borderRadius: 18, paddingHorizontal: 2, height: 36, borderWidth: 1 },
  qtyBtn: { width: 30, height: 32, alignItems: "center", justifyContent: "center" },

  checkoutDock: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopWidth: 1, flexDirection: flexRow(IS_RTL), paddingHorizontal: 20, paddingTop: 16, alignItems: "center", gap: 20 },
  dockSummary: { flex: 1 },
});
