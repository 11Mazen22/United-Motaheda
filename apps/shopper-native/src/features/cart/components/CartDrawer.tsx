/**
 * CartDrawer — premium animated bottom sheet for cart preview.
 *
 * Usage:
 *   const ref = useRef<CartDrawerRef>(null);
 *   <CartDrawer ref={ref} />
 *   ref.current?.open();
 *
 * Reads cart + pricing from the canonical Zustand store. Reactive to
 * mutations made anywhere in the app.
 */

import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import BottomSheet, { BottomSheetView, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useCartStore, selectPricing, selectItemCount } from "@/stores/cart";
import { useDeliveryContext } from "@/features/delivery";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl, FORWARD_ARROW } from "@/utils/layout";
import type { CartItem } from "@/stores/cart";

export interface CartDrawerRef {
  open: () => void;
  close: () => void;
}

export const CartDrawer = forwardRef<CartDrawerRef>(function CartDrawer(_, ref) {
  const { t }   = useTranslation();
  const sheetRef = useRef<BottomSheet>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useCartStore((s) => s.items);
  const pricing = useCartStore(selectPricing);
  const itemCount = useCartStore(selectItemCount);
  const updateQty = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);

  // Unified delivery context — same source as Cart tab + Checkout.
  // Recalculates reactively when address/branch/coords change anywhere
  // in the app, so the drawer's totals stay in lock-step with the
  // upcoming checkout.
  const delivery = useDeliveryContext();

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.snapToIndex(0),
    close: () => sheetRef.current?.close(),
  }));

  const snapPoints = useMemo(() => ["70%", "92%"], []);

  const handleCheckout = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    sheetRef.current?.close();
    router.push("/checkout");
  }, [router]);

  const handleViewCart = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    sheetRef.current?.close();
    router.push("/(tabs)/cart");
  }, [router]);

  const renderItem = useCallback(({ item }: { item: CartItem }) => (
    <CartDrawerRow
      item={item}
      onIncrement={() => updateQty(item.productId, item.quantity + 1)}
      onDecrement={() => updateQty(item.productId, Math.max(1, item.quantity - 1))}
      onRemove={() => removeItem(item.productId)}
    />
  ), [updateQty, removeItem]);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      index={-1}
      enablePanDownToClose
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}>
      <BottomSheetView style={{ flex: 1 }}>
        {/* ── Header — editorial 2-tier matching Cart screen ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.bagIcon}>
              <Ionicons name="bag-handle" size={16} color={kit.color.accentDeep} />
            </View>
            <View>
              <UIText variant="eyebrow" color="tertiary" align="right">
                {t("cart.eyebrow")}
              </UIText>
              <UIText variant="card-title" align="right" style={styles.headerTitleNew}>
                {t("cart.drawerTitle")}
              </UIText>
              <UIText variant="caption" color="muted" align="right" style={styles.headerSubNew}>
                {itemCount > 0 ? t("cart.itemCount", { count: itemCount }) : t("cart.emptyTitle")}
              </UIText>
            </View>
          </View>
          <Pressable
            onPress={() => sheetRef.current?.close()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            style={styles.closeBtn}>
            <Ionicons name="close" size={16} color={theme.colors.slate[700]} />
          </Pressable>
        </View>

        {/* ── Body ── */}
        {items.length === 0 ? (
          <EmptyCartBody />
        ) : (
          <>
            <BottomSheetFlatList
              data={items}
              keyExtractor={(item) => item.productId}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />

            {/* ── Footer — premium anchor (matches Cart screen) ── */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
              <View style={styles.totalsRow}>
                <UIText variant="body-sm" color="secondary">{t("cart.subtotal")}</UIText>
                <UIText variant="body-sm" weight="bold">{formatPrice(pricing.subtotal)}</UIText>
              </View>
              <View style={styles.totalsRow}>
                <UIText variant="body-sm" color="secondary">{t("cart.delivery")}</UIText>
                <UIText
                  variant="body-sm"
                  weight="bold"
                  style={delivery.isFree ? { color: theme.colors.success.strong } : undefined}>
                  {delivery.isFree ? t("common.free") : formatPrice(delivery.cost)}
                </UIText>
              </View>
              {pricing.discount > 0 && (
                <View style={styles.totalsRow}>
                  <UIText variant="body-sm" style={{ color: theme.colors.success.strong }}>
                    {t("cart.discount")}
                  </UIText>
                  <UIText variant="body-sm" weight="bold" style={{ color: theme.colors.success.strong }}>
                    −{formatPrice(pricing.discount)}
                  </UIText>
                </View>
              )}
              <View style={styles.divider} />
              <View style={styles.grandTotalRow}>
                <View>
                  <UIText variant="eyebrow" color="tertiary">{t("cart.totalAmount")}</UIText>
                  <UIText variant="card-title" align="right" style={styles.grandTotalLabel}>
                    {t("cart.total")}
                  </UIText>
                </View>
                <UIText variant="sheet-title" weight="black" align="left" style={styles.grandTotalValue}>
                  {formatPrice(pricing.subtotal - pricing.discount + delivery.cost)}
                </UIText>
              </View>

              <View style={styles.actions}>
                <Pressable onPress={handleViewCart} style={styles.secondaryBtnTouchable}>
                  {({ pressed }) => (
                    <View style={[styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}>
                      <UIText variant="body-sm" weight="extrabold" color="secondary">
                        {t("cart.viewCart")}
                      </UIText>
                    </View>
                  )}
                </Pressable>
                <Pressable onPress={handleCheckout} style={styles.primaryBtnTouchable}>
                  {({ pressed }) => (
                    <View style={[styles.primaryBtn, pressed && styles.primaryBtnPressed]}>
                      <UIText variant="body-sm" weight="black" color="inverse">
                        {t("cart.checkoutNow")}
                      </UIText>
                      <Ionicons name={FORWARD_ARROW} size={14} color="#fff" />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
});

// ─── Row ─────────────────────────────────────────────────────────────────────

function CartDrawerRow({
  item, onIncrement, onDecrement, onRemove,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const { t }  = useTranslation();
  const product = item.product;
  const lineTotal = (product?.price ?? 0) * item.quantity;

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View style={styles.row}>
      {product?.imageUrl ? (
        <Image source={{ uri: product.imageUrl }} style={styles.rowImage} contentFit="contain" />
      ) : (
        <View style={[styles.rowImage, styles.rowImageFallback]}>
          <Ionicons name="medkit-outline" size={20} color={theme.colors.slate[400]} />
        </View>
      )}

      <View style={styles.rowContent}>
        <UIText variant="body-sm" weight="bold" align="right" numberOfLines={2} style={styles.rowNameNew}>
          {product?.nameAr ?? product?.name}
        </UIText>
        <UIText variant="card-title" weight="black" align="right" style={styles.rowPriceNew}>
          {formatPrice(lineTotal)}
        </UIText>

        <View style={styles.qtyRow}>
          <View style={styles.qtyControl}>
            <Pressable
              onPress={() => { haptic(); onDecrement(); }}
              accessibilityRole="button"
              accessibilityLabel={t("common.decrement")}
              style={styles.qtyBtn}>
              <Ionicons name="remove" size={14} color={kit.color.accentDeep} />
            </Pressable>
            <UIText variant="body-sm" weight="black" style={styles.qtyValueNew}>
              {item.quantity}
            </UIText>
            <Pressable
              onPress={() => { haptic(); onIncrement(); }}
              accessibilityRole="button"
              accessibilityLabel={t("common.increment")}
              style={styles.qtyBtn}>
              <Ionicons name="add" size={14} color={kit.color.accentDeep} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => { haptic(); onRemove(); }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("cart.removeItem")}
            style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={14} color={theme.colors.error.base} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Empty ───────────────────────────────────────────────────────────────────

function EmptyCartBody() {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIcon}>
        <Ionicons name="bag-outline" size={34} color={kit.color.accentDeep} />
      </View>
      <UIText variant="sheet-title" align="center" style={styles.emptyTitleNew}>
        {t("cart.emptyTitle")}
      </UIText>
      <UIText variant="body" color="secondary" align="center" style={styles.emptyDescNew}>
        {t("cart.emptyDescription")}
      </UIText>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  background: {
    backgroundColor:      theme.colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
  },
  handle: {
    backgroundColor: theme.colors.slate[300],
    width:           44,
    height:          4,
  },

  // ── Header ───────────────────────────────────────────────────────
  header: {
    flexDirection:    flexRow(isRtl()),
    alignItems:       "center",
    justifyContent:   "space-between",
    paddingHorizontal: 20,
    paddingTop:       4,
    paddingBottom:    16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.hairline,
  },
  headerLeft: {
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    gap:           12,
  },
  bagIcon: {
    width:           38,
    height:          38,
    borderRadius:    11,
    backgroundColor: theme.colors.brand.lighter,
    borderWidth:     1,
    borderColor:     theme.colors.border.brandSoft,
    alignItems:      "center",
    justifyContent:  "center",
  },
  headerTitleNew: {
    letterSpacing: -0.2,
    marginTop:     1,
  },
  headerSubNew: {
    marginTop:     2,
    textTransform: "none",
    letterSpacing: 0,
  },
  closeBtn: {
    width:           34,
    height:          34,
    borderRadius:    11,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── List ────────────────────────────────────────────────────────
  list: {
    paddingHorizontal: 20,
    paddingVertical:   14,
  },
  separator: { height: 10 },

  // ── Row — premium card matching cart screen ──
  row: {
    flexDirection:   flexRow(isRtl()),
    gap:             14,
    padding:         14,
    backgroundColor: theme.colors.surface,
    borderRadius:    16,
    ...theme.shadow.card,
  },
  rowImage: {
    width:           68,
    height:          68,
    borderRadius:    theme.radius.lg,
    backgroundColor: theme.colors.surfaceSunken,
  },
  rowImageFallback: {
    alignItems:     "center",
    justifyContent: "center",
  },
  rowContent: {
    flex:           1,
    gap:            4,
    justifyContent: "space-between",
  },
  rowNameNew: {
    lineHeight: 18,
  },
  rowPriceNew: {
    color:         kit.color.accentDeep,
    letterSpacing: -0.3,
    marginTop:     2,
  },
  qtyRow: {
    flexDirection:  flexRow(isRtl()),
    alignItems:     "center",
    justifyContent: "space-between",
    marginTop:      4,
  },
  qtyControl: {
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    gap:             4,
    backgroundColor: theme.colors.brand.lighter,
    borderRadius:    10,
    padding:         3,
    borderWidth:     1,
    borderColor:     theme.colors.border.brandSoft,
  },
  qtyBtn: {
    width:           26,
    height:          26,
    borderRadius:    7,
    backgroundColor: theme.colors.surface,
    alignItems:      "center",
    justifyContent:  "center",
  },
  qtyValueNew: {
    minWidth:  20,
    textAlign: "center",
  },
  removeBtn: {
    width:           30,
    height:          30,
    borderRadius:    9,
    backgroundColor: theme.colors.error.bg,
    borderWidth:     1,
    borderColor:     theme.colors.error.light,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // ── Footer — premium anchor (matches Cart screen footer) ──
  footer: {
    paddingHorizontal: 20,
    paddingTop:        16,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    theme.colors.border.hairline,
    backgroundColor:   theme.colors.surface,
  },
  totalsRow: {
    flexDirection:  flexRow(isRtl()),
    justifyContent: "space-between",
    alignItems:     "center",
    paddingVertical: 4,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.hairline,
    marginVertical:  10,
  },
  grandTotalRow: {
    flexDirection:  flexRow(isRtl()),
    justifyContent: "space-between",
    alignItems:     "center",
  },
  grandTotalLabel: {
    letterSpacing: -0.2,
    marginTop:     1,
  },
  grandTotalValue: {
    color:         kit.color.accentDeep,
    letterSpacing: -0.5,
  },

  // ── Action buttons ──
  actions: {
    flexDirection: flexRow(isRtl()),
    gap:           10,
    marginTop:     16,
  },
  // Touchable wrappers carry only flex sizing/radius — visual styling lives
  // on the plain View inside instead of on the Pressable's own
  // function-computed style, which is unreliable under this app's RN/Fabric
  // setup.
  secondaryBtnTouchable: {
    flex:         1,
    borderRadius: 14,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius:    14,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth:     1,
    borderColor:     theme.colors.border.hairline,
    alignItems:      "center",
    justifyContent:  "center",
  },
  secondaryBtnPressed: {
    opacity:   0.92,
    transform: [{ scale: 0.985 }],
  },
  primaryBtnTouchable: {
    flex:         1.4,
    borderRadius: 14,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius:    14,
    backgroundColor: kit.color.accentDeep,
    flexDirection:   flexRow(isRtl()),
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    ...theme.shadow.brand,
  },
  primaryBtnPressed: {
    opacity:   0.94,
    transform: [{ scale: 0.985 }],
  },

  // ── Empty state — premium ──
  emptyWrap: {
    flex:           1,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical:   40,
    gap:            10,
  },
  emptyIcon: {
    width:           80,
    height:          80,
    borderRadius:    24,
    backgroundColor: theme.colors.brand.lighter,
    borderWidth:     1,
    borderColor:     theme.colors.border.brandSoft,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    12,
    ...theme.shadow.brandGlow,
  },
  emptyTitleNew: {
    letterSpacing: -0.3,
  },
  emptyDescNew: {
    lineHeight: 22,
    maxWidth:   320,
  },
});
