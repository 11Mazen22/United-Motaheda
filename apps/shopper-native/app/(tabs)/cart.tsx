/**
 * Cart Screen — Premium RTL-Ready Edition
 *
 * Architecture:
 *   • Granular Zustand selectors — no re-render cascades
 *   • renderItem extracted + memoized — stable FlatList identity
 *   • All colours/spacing via theme tokens or named CART_* constants
 *   • Full RTL (row-reverse layouts), a11y, haptics, Reanimated animations
 */
import React, { memo, useCallback, useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeOutRight,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useCartStore, type CartItem } from "@/stores/cart";
import {
  useDeliveryContext,
  FREE_DELIVERY_THRESHOLD,
} from "@/features/delivery";
import { showConfirmSheet } from "@/shared/store/appSheetStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { FORWARD_CHEVRON } from "@/utils/layout";
import { s } from "./cart.styles";

// ─── StepBtn — animated quantity button ──────────────────────────────────────

const StepBtn = memo(function StepBtn({
  icon,
  onPress,
  disabled,
}: {
  icon:      "add" | "remove";
  onPress:   () => void;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;
    scale.value = withSequence(
      withSpring(0.82, { damping: 14, stiffness: 500 }),
      withTiming(1, { duration: 120 }),
    );
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  }, [disabled, onPress, scale]);

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        hitSlop={10}
        accessibilityRole="button"
        style={[s.stepBtn, disabled && s.stepBtnDisabled]}>
        <Ionicons
          name={icon}
          size={14}
          color={disabled ? kit.color.inkFaint : kit.color.ink}
        />
      </Pressable>
    </Animated.View>
  );
});

// ─── CartItemCard — zero store subscriptions, all data via props ──────────────

interface CartItemCardProps {
  item:       CartItem;
  updateQty:  (productId: string, qty: number) => void;
  removeItem: (productId: string) => void;
}

const CartItemCard = memo(function CartItemCard({
  item,
  updateQty,
  removeItem,
}: CartItemCardProps) {
  const { t } = useTranslation();
  const product = item.product;
  const maxQty  = product.stock > 0 ? Math.floor(product.stock) : item.quantity;
  const isAtMax = item.quantity >= maxQty;
  const lineTotal = (product.price * item.quantity).toFixed(2);
  const name = product.nameAr ?? product.name;

  const handleInc = useCallback(() => {
    if (isAtMax) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    updateQty(item.productId, item.quantity + 1);
  }, [isAtMax, item.productId, item.quantity, updateQty]);

  const handleDec = useCallback(() => {
    if (item.quantity > 1) {
      updateQty(item.productId, item.quantity - 1);
    } else {
      removeItem(item.productId);
    }
  }, [item.productId, item.quantity, removeItem, updateQty]);

  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    removeItem(item.productId);
  }, [item.productId, removeItem]);

  return (
    <Animated.View
      exiting={FadeOutRight.duration(220)}
      layout={Layout.springify().damping(18)}
      style={s.card}>

      <View style={s.cardTopRow}>
        <UIText style={s.catLabel} numberOfLines={1}>{product.categoryName}</UIText>
        <Pressable
          onPress={handleRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("cart.removeItem")}
          style={s.deleteBtn}>
          <Ionicons name="trash-outline" size={13} color={kit.color.danger} />
        </Pressable>
      </View>

      <View style={s.cardMidRow}>
        <View style={s.imgBox}>
          {product.imageUrl ? (
            <Image
              source={{ uri: product.imageUrl }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <View style={s.imgFallback}>
              <Ionicons name="medkit-outline" size={26} color={kit.color.inkFaint} />
            </View>
          )}
        </View>
        <UIText style={s.productName} numberOfLines={3}>{name}</UIText>
      </View>

      <View style={s.cardBottomRow}>
        <View style={s.priceWrap}>
          <UIText style={s.lineTotal}>{lineTotal}</UIText>
          <UIText style={s.currency}>{t("common.currency")}</UIText>
          {item.quantity > 1 && (
            <UIText style={s.unitHint}>{product.price.toFixed(0)} × {item.quantity}</UIText>
          )}
        </View>
        <View style={s.stepper}>
          <StepBtn icon="add"    onPress={handleInc} disabled={isAtMax} />
          <UIText style={[s.qtyNum, isAtMax && s.qtyNumMax]}>{item.quantity}</UIText>
          <StepBtn icon="remove" onPress={handleDec} />
        </View>
      </View>

      {isAtMax && product.stock > 0 && (
        <Animated.View entering={FadeInDown.duration(160)} style={s.maxHint}>
          <Ionicons name="alert-circle" size={10} color={kit.color.warn} />
          <UIText style={s.maxHintText}>{t("common.maxQty")}</UIText>
        </Animated.View>
      )}
    </Animated.View>
  );
});

// ─── CartHeader ───────────────────────────────────────────────────────────────

const CartHeader = memo(function CartHeader({
  t,
  insetsTop,
  count,
  onClearPress,
}: {
  t:            (key: string, options?: Record<string, unknown>) => string;
  insetsTop:    number;
  count:        number;
  onClearPress: () => void;
}) {
  return (
    <View style={[s.header, { paddingTop: insetsTop + 14 }]}>
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={s.headerIcon}>
            <Ionicons name="bag-outline" size={18} color={kit.color.accentDeep} />
          </View>
          <View>
            <UIText style={s.headerEyebrow}>{t("cart.eyebrow")}</UIText>
            <UIText style={s.headerTitle}>{t("cart.title")}</UIText>
          </View>
        </View>
        <View style={s.headerActions}>
          <View style={s.countBadge}>
            <UIText style={s.countText}>{t("cart.itemCount", { count })}</UIText>
          </View>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("cart.clearCart")}
            style={s.clearBtn}
            onPress={onClearPress}>
            <Ionicons name="trash-outline" size={13} color={kit.color.danger} />
            <UIText style={s.clearText}>{t("common.clear")}</UIText>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

// ─── CartListHeader ───────────────────────────────────────────────────────────

const CartListHeader = memo(function CartListHeader({
  t,
  delivery,
  progress,
  remaining,
}: {
  t:         (key: string, options?: Record<string, unknown>) => string;
  delivery:  ReturnType<typeof useDeliveryContext>;
  progress:  number;
  remaining: string;
}) {
  return (
    <>
      {delivery.outOfServiceMessage && (
        <Animated.View entering={FadeInDown.duration(220)} style={s.warnBanner}>
          <Ionicons name="alert-circle" size={15} color={kit.color.warn} />
          <UIText style={s.warnText}>{delivery.outOfServiceMessage}</UIText>
        </Animated.View>
      )}

      {delivery.branch && delivery.isDeliverable && (
        <Animated.View entering={FadeInDown.duration(240)} style={s.branchPill}>
          <View style={s.branchIconBox}>
            <Ionicons name="storefront-outline" size={14} color={kit.color.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <UIText style={s.branchEyebrow}>{t("cart.deliveringFrom")}</UIText>
            <UIText style={s.branchName} numberOfLines={1}>
              {delivery.branch.fullNameAr ?? delivery.branch.nameAr}
              {delivery.distanceKm != null &&
                ` · ${delivery.distanceKm.toFixed(1)} ${t("home.kmUnit")}`}
            </UIText>
          </View>
          <Ionicons name="checkmark-circle" size={18} color={kit.color.success} />
        </Animated.View>
      )}

      <View style={s.deliveryCard}>
        {delivery.isFree ? (
          <View style={s.freeRow}>
            <View style={s.freeIconBox}>
              <Ionicons name="checkmark-circle-outline" size={18} color={kit.color.onInk} />
            </View>
            <View style={{ flex: 1 }}>
              <UIText style={s.freeTitle}>{t("cart.freeDelivery")}</UIText>
              <UIText style={s.freeSub}>
                {t("cart.freeDeliverySubtitle", { threshold: FREE_DELIVERY_THRESHOLD })}
              </UIText>
            </View>
          </View>
        ) : (
          <>
            <View style={s.progressHeader}>
              <View style={s.progressLeft}>
                <Ionicons name="bicycle-outline" size={15} color={kit.color.warn} />
                <UIText style={s.progressLabel}>
                  {t("cart.addForFreeDelivery", { remaining })}
                </UIText>
              </View>
              <UIText style={s.progressPct}>{Math.round(progress * 100)}%</UIText>
            </View>
            <View style={s.track}>
              <View style={[s.fill, { width: `${Math.max(progress * 100, 2)}%` as `${number}%` }]} />
            </View>
          </>
        )}
      </View>

      <View style={s.trustRow}>
        {(
          [
            {
              icon:  "flash-outline" as const,
              label: t("cart.fastDelivery"),
              tint:  kit.color.warnTint,
              fg:    kit.color.warn,
            },
            {
              icon:  "shield-checkmark-outline" as const,
              label: t("cart.securePayment"),
              tint:  kit.color.successTint,
              fg:    kit.color.success,
            },
            {
              icon:  "refresh-outline" as const,
              label: t("cart.guaranteedReturns"),
              tint:  kit.color.accentTint,
              fg:    kit.color.accentDeep,
            },
          ] as const
        ).map((b, i, arr) => (
          <View key={b.label} style={[s.trustCell, i < arr.length - 1 && s.trustDivider]}>
            <View style={[s.trustIconBox, { backgroundColor: b.tint }]}>
              <Ionicons name={b.icon} size={13} color={b.fg} />
            </View>
            <UIText style={s.trustLabel}>{b.label}</UIText>
          </View>
        ))}
      </View>
    </>
  );
});

// ─── CartScreen ───────────────────────────────────────────────────────────────

export default function CartScreen() {
  const { t }   = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  // Granular selectors — no whole-store subscription
  const items      = useCartStore((s) => s.items);
  const clearCart  = useCartStore((s) => s.clearCart);
  const updateQty  = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const sub        = useCartStore((s) => s.subtotal());
  const count      = useCartStore((s) => s.itemCount());

  const delivery     = useDeliveryContext();
  const deliveryCost = delivery.isFree ? 0 : delivery.cost;
  const total        = sub + deliveryCost;

  const progress = useMemo(() => Math.min(sub / FREE_DELIVERY_THRESHOLD, 1), [sub]);
  const remaining = delivery.isFree
    ? "0.00"
    : (delivery.amountToFreeDelivery?.toFixed(2) ?? "0.00");

  const handleClearCart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    showConfirmSheet(
      t("cart.clearCartTitle"),
      t("cart.clearCartMessage"),
      () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        clearCart();
      },
      { confirmLabel: t("cart.clearAll"), danger: true },
    );
  }, [clearCart, t]);

  const handleCheckout = useCallback(() => {
    if (delivery.isDeliverable) router.push("/checkout");
  }, [delivery.isDeliverable, router]);

  // Stable renderItem — no inline arrow function
  const renderItem = useCallback(
    ({ item }: { item: CartItem }) => (
      <CartItemCard
        item={item}
        updateQty={updateQty}
        removeItem={removeItem}
      />
    ),
    [updateQty, removeItem],
  );

  // ── Empty state ──────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={[s.header, { paddingTop: 16 }]}>
          <View style={s.headerLeft}>
            <View style={s.headerIcon}>
              <Ionicons name="bag-outline" size={18} color={kit.color.accentDeep} />
            </View>
            <View>
              <UIText style={s.headerEyebrow}>{t("cart.eyebrow")}</UIText>
              <UIText style={s.headerTitle}>{t("cart.title")}</UIText>
            </View>
          </View>
        </View>
        <EmptyState
          icon="bag-outline"
          title={t("cart.emptyTitle")}
          description={t("cart.emptyDescription")}
          actionLabel={t("cart.emptyAction")}
          onAction={() => router.push("/(tabs)/products")}
        />
      </View>
    );
  }

  // ── Populated ────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <CartHeader t={t} insetsTop={insets.top} count={count} onClearPress={handleClearCart} />

      <FlatList
        data={items}
        keyExtractor={(i) => i.productId}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop:        14,
          paddingBottom:     theme.spacing.lg,
          gap:               10,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <CartListHeader t={t} delivery={delivery} progress={progress} remaining={remaining} />
        }
        renderItem={renderItem}
      />

      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        <View style={s.footerHandle} />

        {/* Condensed subtotal + delivery rows */}
        <View style={s.totalsBlock}>
          <View style={s.totalRow}>
            <UIText style={s.totalLabel}>{t("cart.subtotal")}</UIText>
            <UIText style={s.totalValue}>{sub.toFixed(2)} {t("common.currency")}</UIText>
          </View>
          <View style={s.totalRow}>
            <UIText style={s.totalLabel}>{t("cart.delivery")}</UIText>
            {delivery.isFree ? (
              <UIText style={s.totalFree}>{t("common.free")}</UIText>
            ) : (
              <UIText style={s.totalValue}>{deliveryCost.toFixed(2)} {t("common.currency")}</UIText>
            )}
          </View>
        </View>

        {/* Conversion row — total price + massive pill CTA side-by-side */}
        <View style={s.checkoutRow}>
          {/* Total price block (RTL: appears on right) */}
          <View style={s.priceBlock}>
            <UIText style={s.priceLabel}>{t("cart.total")}</UIText>
            <View style={s.priceRow}>
              <UIText style={s.priceTotal}>{total.toFixed(2)}</UIText>
              <UIText style={s.priceCurrency}>{t("common.currency")}</UIText>
            </View>
          </View>

          {/* Pill checkout button (RTL: appears on left) */}
          <Pressable
            onPress={handleCheckout}
            disabled={!delivery.isDeliverable}
            accessibilityRole="button"
            accessibilityState={{ disabled: !delivery.isDeliverable }}
            style={({ pressed }) => [
              s.checkoutOuter,
              pressed && { opacity: 0.92 },
            ]}>
            <View style={[s.checkoutInner, !delivery.isDeliverable && s.checkoutInnerDisabled]}>
              <Ionicons name={FORWARD_CHEVRON} size={17} color={kit.color.onInk} />
              <UIText style={s.checkoutText}>
                {delivery.isDeliverable
                  ? t("cart.checkoutBtn", { total: total.toFixed(2) })
                  : t("cart.outsideDelivery")}
              </UIText>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
