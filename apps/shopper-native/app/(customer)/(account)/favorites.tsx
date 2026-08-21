import React, { memo, useCallback } from "react";

import { Platform, Pressable, StyleSheet, View } from "react-native";

import { showConfirmSheet } from "@/shared/store/appSheetStore";

import { FlashList } from "@shopify/flash-list";

import { Image } from "expo-image";

import { Ionicons } from "@expo/vector-icons";

import { kit } from "@pharmacy/ui-native";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";

import Animated, { FadeInDown, FadeOutRight, Layout } from "react-native-reanimated";

import { useTranslation } from "react-i18next";

import { useWishlistStore, clearUserWishlist } from "@/stores/wishlist";

import { useCartStore } from "@/stores/cart";

import type { NativeProduct } from "@/services/productsApi";

import { EmptyState } from "@/components/ui/EmptyState";

import { Text as UIText } from "@pharmacy/ui-native";

import { useDarkColors } from "@/hooks/useDarkColors";

import { theme } from "@pharmacy/design-tokens";

import { formatPrice } from "@/utils/format";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);



const Skeleton = memo(function Skeleton() {

  const { c } = useDarkColors();

  return (

    <View style={[s.card, { flexDirection: flexRow(RTL), backgroundColor: c.surface, borderColor: c.line }]}>

      <View style={[s.img, { backgroundColor: c.canvas }]} />

      <View style={{ flex: 1, gap: 8 }}>

        <View style={{ width: "40%", height: 9, backgroundColor: c.line, borderRadius: 6 }} />

        <View style={{ width: "85%", height: 13, backgroundColor: c.line, borderRadius: 6 }} />

        <View style={{ width: "35%", height: 15, backgroundColor: c.line, borderRadius: 6, marginTop: 4 }} />

      </View>

      <View style={s.acts}><View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: c.canvas }} /></View>

    </View>

  );

});



const Card = memo(function Card({ product, index }: { product: NativeProduct; index: number }) {

  const { c } = useDarkColors();

  const router = useRouter(), { t } = useTranslation();

  const addItem = useCartStore(s => s.addItem);

  const inCart = useCartStore(s => s.items.some(i => i.productId === product.id));

  const name = product.nameAr ?? product.name;



  const addToCart = useCallback(() => {

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    addItem(product, 1);

  }, [product, addItem]);



  return (

    <Animated.View entering={FadeInDown.duration(280).delay(index * 50)} exiting={FadeOutRight.duration(220)} layout={Layout.springify()} style={[s.card, { flexDirection: flexRow(RTL) }]}>

      <Pressable onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}>

        <View style={s.img}>

          {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={180} />

            : <><View style={[StyleSheet.absoluteFill, { backgroundColor: c.accentTint }]} /><Ionicons name="medkit-outline" size={28} color={c.lineStrong} /></>}

          {!product.inStock && <View style={s.oos}><UIText variant="eyebrow" color="inverse">{t("common.outOfStock")}</UIText></View>}

        </View>

      </Pressable>



      <View style={{ flex: 1, gap: 4 }}>

        <UIText variant="eyebrow" color="tertiary" align={TA} numberOfLines={1}>{product.categoryName}</UIText>

        <Pressable onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}>

          <UIText variant="body-sm" weight="bold" align={TA} numberOfLines={2} style={s.name}>{name}</UIText>

        </Pressable>

        <UIText style={[s.price, { textAlign: TA }]}> {formatPrice(product.price)} </UIText>

      </View>



      <Pressable onPress={addToCart} disabled={!product.inStock} accessibilityRole="button"

        accessibilityLabel={!product.inStock ? t("wishlist.notAvailable", { name }) : inCart ? t("wishlist.inCart", { name }) : t("wishlist.addToCartLabel", { name })}

        accessibilityState={{ disabled: !product.inStock }} style={[s.cartBtn, inCart && s.cartOn, !product.inStock && s.cartOff]}>

        <Ionicons name={inCart ? "checkmark" : "cart-outline"} size={16} color={inCart ? "#fff" : product.inStock ? c.accentDeep : c.inkFaint} />

      </Pressable>

    </Animated.View>

  );

});



export default function FavoritesScreen() {

  const { c } = useDarkColors();

  const { t } = useTranslation(), router = useRouter(), insets = useSafeAreaInsets();

  const items = useWishlistStore(s => s.items);

  const isHydrated = useWishlistStore(s => s.isHydrated);

  const userId = useWishlistStore(s => s.userId);

  const clear = useWishlistStore(s => s.clear);



  const clearAll = useCallback(() => {

    const doClear = () => { clear(); if (userId) void clearUserWishlist(userId).catch(() => {}); };

    showConfirmSheet(t("wishlist.clearTitle"), t("wishlist.clearMessage"), () => {

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

      doClear();

    }, { confirmLabel: t("cart.clearAll"), danger: true });

  }, [clear, userId, t]);



  return (

    <View style={s.screen}>

      <Animated.View entering={FadeInDown.duration(280)} style={[s.header, { paddingTop: insets.top + 10 }]}>

        <View style={[s.hRow, { flexDirection: flexRow(RTL) }]}>

          <Pressable onPress={() => router.back()} style={s.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>

            <Ionicons name={BACK_CHEVRON} size={18} color={c.inkSoft} />

          </Pressable>

          <View style={s.tile}><Ionicons name="heart-outline" size={22} color="#E53E3E" /></View>

          <View style={{ flex: 1 }}>

            <UIText style={[s.hTitle, { textAlign: TA }]}>{t("wishlist.title")}</UIText>

            <UIText style={[s.hSub, { textAlign: TA }]}>{t("wishlist.yourWishlist")}</UIText>

          </View>

          {items.length > 0 ? <Pressable onPress={clearAll} hitSlop={8} style={s.clr} accessibilityRole="button" accessibilityLabel={t("wishlist.clearAllLabel")}>

            <Ionicons name="trash-outline" size={15} color="#E53E3E" />

          </Pressable> : <View style={{ width: 40 }} />}

        </View>

      </Animated.View>



      {items.length > 0 && <View style={[s.chipRow, { flexDirection: flexRow(RTL) }]}>

        <View style={[s.chip, { flexDirection: flexRow(RTL) }]}>

          <Ionicons name="heart" size={11} color="#E53E3E" />

          <UIText style={s.chipT}>{t("products.items", { count: items.length })}</UIText>

        </View>

      </View>}



      {!isHydrated ? <View style={{ padding: 20, gap: 12 }}>{[1, 2, 3, 4].map(k => <Skeleton key={k} />)}</View>

        : items.length === 0 ? <EmptyState icon="heart-outline" title={t("wishlist.empty")} description={t("wishlist.emptyDescription")} actionLabel={t("wishlist.browse")} onAction={() => router.push("/(customer)/(tabs)/products")} />

        : <FlashList<NativeProduct> data={items} keyExtractor={p => p.id} getItemType={() => "favorite-card"}

            contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}

            ListHeaderComponent={<View style={[s.listHdr, { flexDirection: flexRow(RTL) }]}><UIText style={s.listHdrT}>{t("wishlist.savedItems", { count: items.length })}</UIText></View>}

            renderItem={({ item, index }) => <View style={s.wrap}><Card product={item} index={index} /></View>}

          />}

    </View>

  );

}



const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: kit.color.canvas },

  wrap: { paddingBottom: 12 },

  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line, ...kit.shadow.raised },

  hRow: { alignItems: "center", gap: 12 },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: kit.color.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised, flexShrink: 0 },

  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: "rgba(229,62,62,0.08)", borderWidth: 1, borderColor: "rgba(229,62,62,0.16)", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  hTitle: { fontFamily: theme.fonts.black, fontSize: 18, letterSpacing: -0.4, color: kit.color.ink, includeFontPadding: false, textAlign: TA },

  hSub: { fontFamily: theme.fonts.semibold, fontSize: 11, color: kit.color.inkFaint, includeFontPadding: false, textAlign: TA, marginTop: 1 },

  clr: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(229,62,62,0.08)", borderWidth: 1, borderColor: "rgba(229,62,62,0.16)", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  chipRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: kit.color.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: kit.color.line },

  chip: { alignItems: "center", gap: 5, backgroundColor: "rgba(229,62,62,0.08)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(229,62,62,0.16)" },

  chipT: { fontSize: 10, fontFamily: theme.fonts.bold, color: "#E53E3E", includeFontPadding: false },

  listHdr: { marginBottom: 12 },

  listHdrT: { fontFamily: theme.fonts.semibold, fontSize: 11, color: kit.color.inkFaint, letterSpacing: 0.3, textTransform: "uppercase", textAlign: TA, includeFontPadding: false },



  card: { alignItems: "center", gap: 14, backgroundColor: kit.color.surface, borderRadius: 16, padding: 14, marginHorizontal: 20, marginBottom: 12, borderWidth: 1, borderColor: kit.color.line, ...kit.shadow.raised },

  img: { width: 82, height: 82, borderRadius: 14, backgroundColor: kit.color.well, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },

  oos: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.50)", alignItems: "center", justifyContent: "center" },

  name: { lineHeight: 20 },

  price: { fontSize: 15, fontFamily: theme.fonts.black, color: kit.color.accentDeep, letterSpacing: -0.3, marginTop: 2, includeFontPadding: false },

  acts: { alignItems: "center", gap: 10 },

  cartBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: kit.color.accentTint, borderWidth: 1, borderColor: kit.color.line, alignItems: "center", justifyContent: "center", ...kit.shadow.raised },

  cartOn: { backgroundColor: kit.color.accentDeep, borderColor: kit.color.accentDeep },

  cartOff: { backgroundColor: kit.color.well, borderColor: kit.color.line },

});
