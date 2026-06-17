import React, { memo, useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { showConfirmSheet } from "@/shared/store/appSheetStore";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { kit } from "@/shared/kit";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeOutRight, Layout } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useWishlistStore, clearUserWishlist } from "@/stores/wishlist";
import { useCartStore } from "@/stores/cart";
import type { NativeProduct } from "@/services/productsApi";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── FavoriteCard ─────────────────────────────────────────────────────────────
const FavoriteCard = memo(function FavoriteCard({ product, index }: { product: NativeProduct; index: number }) {
  const router  = useRouter();
  const { t }   = useTranslation();
  const toggle  = useWishlistStore((s) => s.toggle);
  const addItem = useCartStore((s) => s.addItem);
  const inCart  = useCartStore((s) => s.items.some((i) => i.productId === product.id));
  const name    = product.nameAr ?? product.name;

  const handleRemove = useCallback(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    toggle(product);
  }, [product, toggle]);

  const handleAddToCart = useCallback(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addItem(product, 1);
  }, [product, addItem]);

  return (
    <Animated.View
      entering={FadeInDown.duration(280).delay(index * 50)}
      exiting={FadeOutRight.duration(220)}
      layout={Layout.springify()}
      style={[s.card, { flexDirection: flexRow(IS_RTL) }]}>

      {/* Image */}
      <Pressable onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}>
        <View style={s.imgBox}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={180} />
          ) : (
            <>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: kit.color.accentTint }]} />
              <Ionicons name="medkit-outline" size={28} color={kit.color.lineStrong} />
            </>
          )}
          {!product.inStock && (
            <View style={s.outOfStockOverlay}>
              <UIText variant="eyebrow" color="inverse">{t("common.outOfStock")}</UIText>
            </View>
          )}
        </View>
      </Pressable>

      {/* Info */}
      <View style={{ flex: 1, gap: 4 }}>
        <UIText variant="eyebrow" color="tertiary" align={TEXT_START} numberOfLines={1}>
          {product.categoryName}
        </UIText>
        <Pressable onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}>
          <UIText variant="body-sm" weight="bold" align={TEXT_START} numberOfLines={2} style={s.nameLabel}>
            {name}
          </UIText>
        </Pressable>
        <UIText style={[s.priceLabel, { textAlign: TEXT_START }]}>
          {formatPrice(product.price)}
        </UIText>
      </View>

      {/* Actions */}
      <View style={s.actions}>
        <Pressable
          onPress={handleRemove}
          hitSlop={8}
          style={s.removeBtn}
          accessibilityRole="button"
          accessibilityLabel={t("wishlist.removeFrom", { name })}>
          <Ionicons name="heart" size={18} color={"#E53E3E"} />
        </Pressable>
        <Pressable
          onPress={handleAddToCart}
          disabled={!product.inStock}
          accessibilityRole="button"
          accessibilityLabel={
            !product.inStock
              ? t("wishlist.notAvailable", { name })
              : inCart
              ? t("wishlist.inCart", { name })
              : t("wishlist.addToCartLabel", { name })
          }
          accessibilityState={{ disabled: !product.inStock }}
          style={[s.cartBtn, inCart && s.cartBtnActive, !product.inStock && s.cartBtnDisabled]}>
          <Ionicons
            name={inCart ? "checkmark" : "cart-outline"}
            size={16}
            color={inCart ? "#fff" : product.inStock ? kit.color.accentDeep : kit.color.inkFaint}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function FavoritesScreen() {
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const { t }      = useTranslation();
  const items      = useWishlistStore((s) => s.items);
  const isHydrated = useWishlistStore((s) => s.isHydrated);
  const userId     = useWishlistStore((s) => s.userId);
  const clear      = useWishlistStore((s) => s.clear);

  const handleClearAll = useCallback(() => {
    const doClear = () => {
      clear();
      if (userId) {
        void clearUserWishlist(userId).catch((e) => {
          if (__DEV__) console.warn("[favorites] clearUserWishlist failed:", e);
        });
      }
    };

    showConfirmSheet(
      t("wishlist.clearTitle"),
      t("wishlist.clearMessage"),
      () => {
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
        doClear();
      },
      { confirmLabel: t("cart.clearAll"), danger: true },
    );
  }, [clear, userId, t]);

  return (
    <View style={s.screen}>

      {/* ── VIP Header ── */}
      <Animated.View entering={FadeIn.duration(240)} style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable
          onPress={() => router.back()}
          style={s.backBtn}
          hitSlop={10}
          accessibilityRole="button">
          <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
        </Pressable>

        <View style={s.iconTile}>
          <Ionicons name="heart-outline" size={22} color={"#E53E3E"} />
        </View>

        <View style={{ flex: 1 }}>
          <UIText style={s.headerTitle}>{t("wishlist.title")}</UIText>
          <UIText style={s.headerSubtitle}>{t("wishlist.yourWishlist")}</UIText>
        </View>

        {items.length > 0 ? (
          <Pressable
            onPress={handleClearAll}
            hitSlop={8}
            style={s.clearBtn}
            accessibilityRole="button"
            accessibilityLabel={t("wishlist.clearAllLabel")}>
            <Ionicons name="trash-outline" size={15} color={"#E53E3E"} />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </Animated.View>

      {/* Count chip */}
      {items.length > 0 && (
        <View style={[s.statsRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.statChip, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="heart" size={11} color={"#E53E3E"} />
            <UIText style={s.statText}>{t("products.items", { count: items.length })}</UIText>
          </View>
        </View>
      )}

      {!isHydrated ? null : items.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title={t("wishlist.empty")}
          description={t("wishlist.emptyDescription")}
          actionLabel={t("wishlist.browse")}
          onAction={() => router.push("/(tabs)/products")}
        />
      ) : (
        <FlashList<NativeProduct>
          data={items}
          keyExtractor={favoriteKeyExtractor}
          getItemType={favoriteItemType}
          contentContainerStyle={{
            padding:       20,
            paddingBottom: insets.bottom + 24,
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={[s.listHeader, { flexDirection: flexRow(IS_RTL) }]}>
              <Badge variant="brand" size="sm">{t("products.items", { count: items.length })}</Badge>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={s.cardWrap}>
              <FavoriteCard product={item} index={index} />
            </View>
          )}
        />
      )}
    </View>
  );
}

// Stable refs so FlashList recycler stays happy.
const favoriteKeyExtractor = (p: NativeProduct) => p.id;
const favoriteItemType     = () => "favorite-card";

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },
  cardWrap: { paddingBottom: 12 },

  // Header
  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 20,
    paddingBottom:     16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    flexShrink:      0,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: "rgba(229,62,62,0.08)",
    borderWidth:     1,
    borderColor:     "rgba(229,62,62,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.4,
    color:              kit.color.ink,
    includeFontPadding: false,
    textAlign:          TEXT_START,
  },
  headerSubtitle: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
    textAlign:          TEXT_START,
    marginTop:          1,
  },
  clearBtn: {
    width:           40,
    height:          40,
    borderRadius:    13,
    backgroundColor: "rgba(229,62,62,0.08)",
    borderWidth:     1,
    borderColor:     "rgba(229,62,62,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },

  // Stats
  statsRow: {
    gap:               8,
    paddingHorizontal: 20,
    paddingVertical:   10,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  statChip: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   "rgba(229,62,62,0.08)",
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       "rgba(229,62,62,0.16)",
  },
  statText: {
    fontSize:           10,
    fontFamily:         theme.fonts.bold,
    color:              "#E53E3E",
    includeFontPadding: false,
  },

  // List
  listHeader: { marginBottom: 12 },

  // Card
  card: {
    alignItems:      "center",
    gap:             14,
    backgroundColor: kit.color.surface,
    borderRadius:    16,
    padding:         14,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  imgBox: {
    width:           82,
    height:          82,
    borderRadius:    14,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
    flexShrink:      0,
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.50)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  nameLabel:  { lineHeight: 20 },
  priceLabel: {
    fontSize:           15,
    fontFamily:         theme.fonts.black,
    color:              kit.color.accentDeep,
    letterSpacing:      -0.3,
    marginTop:          2,
    includeFontPadding: false,
  },

  // Actions
  actions: { alignItems: "center", gap: 10 },
  removeBtn: {
    width:           40,
    height:          40,
    borderRadius:    13,
    backgroundColor: "rgba(229,62,62,0.08)",
    borderWidth:     1,
    borderColor:     "rgba(229,62,62,0.16)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  cartBtn: {
    width:           40,
    height:          40,
    borderRadius:    13,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  cartBtnActive: {
    backgroundColor: kit.color.accentDeep,
    borderColor:     kit.color.accentDeep,
  },
  cartBtnDisabled: {
    backgroundColor: kit.color.well,
    borderColor:     kit.color.line,
  },
});
