/**
 * Order Details — /order/[id]
 *
 * Full order view with:
 *   - Sticky header (order ID + status + payment badge)
 *   - Order timeline (contextual to payment method)
 *   - Purchased items (image from product_snapshot or hydrated from products)
 *   - Delivery address
 *   - Payment method card + proof image for manual payments
 *   - Price breakdown
 *
 * Deep link: tapping a product thumbnail navigates to /product/[id]
 *
 * Screen kept under 400 lines by delegating metadata, helpers, and sub-components
 * to src/features/orders/components/OrderDetailHelpers.tsx.
 */

import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  Platform,
  StyleSheet,
  Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Image as ExpoImage } from "expo-image";
import { Image as RNImage } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useOrderDetail } from "@/features/orders/hooks/useOrders";
import { supabase } from "@/lib/supabase";
import { cancelOrder } from "@/features/orders/api";
import { Text as UIText, Badge, useTheme } from "@pharmacy/ui-native";
import { ReorderButton } from "@/features/orders/components/ReorderButton";
import { formatPrice } from "@/utils/format";
import { FORWARD_CHEVRON, textAlignStart, isRtl, flexRow } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAppLanguage } from "@/i18n/LanguageProvider";

import {
  ORDER_STATUS_META,
  getPaymentMeta,
  getPaymentStatusDisplay,
  buildTimeline,
  formatDate,
  formatTime,
  DetailSection,
  InfoRow,
  HeaderBackButton,
} from "@/features/orders/components/OrderDetailHelpers";
import { getOrderDetailStyles } from "@/features/orders/components/order-detail.styles";

const TEXT_START = textAlignStart(isRtl());

// expo-image passes camelCase fetchPriority to the DOM on web, which React
// doesn't recognise. Use RNImage on web to suppress the warning.
function SafeImage({
  source, style, contentFit,
}: {
  source: { uri: string };
  style: object;
  contentFit: "contain" | "cover";
}) {
  if (Platform.OS === "web") return <RNImage source={source} style={style} resizeMode={contentFit} />;
  return <ExpoImage source={source} style={style} contentFit={contentFit} />;
}

// Local StatusVariant "brand" has no direct shared-Badge equivalent — map it.
function badgeVariant(v: "success" | "warning" | "brand" | "error" | "neutral"): "success" | "warning" | "primary" | "error" | "neutral" {
  return v === "brand" ? "primary" : v;
}

export default function OrderDetailScreen(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { pagePad } = useScreenLayout();
  const { theme } = useTheme();
  const styles = useMemo(() => getOrderDetailStyles(theme), [theme]);
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isRefetching, refetch, isError } = useOrderDetail(id);
  const handleRefresh = useCallback(() => { void refetch(); }, [refetch]);

  const [actions, setActions] = React.useState<any>(null);
  React.useEffect(() => {
    if (id) {
      supabase.rpc("get_order_actions", { p_order_id: id }).then(({ data }) => setActions(data as any));
    }
  }, [id, order?.status]);
  
  const [isCancelling, setIsCancelling] = React.useState(false);
  const handleCancelOrder = useCallback(() => {
    Alert.alert(
      t("orders.cancelOrder", "Cancel Order"),
      t("orders.cancelConfirm", "Are you sure you want to cancel this order?"),
      [
        { text: t("common.no", "No"), style: "cancel" },
        { 
          text: t("common.yes", "Yes"), 
          style: "destructive",
          onPress: async () => {
            try {
              setIsCancelling(true);
              await cancelOrder(id as string, "Customer requested cancellation", `cancel-mobile-${id}-${Date.now()}`);
              await refetch();
              Alert.alert(t("common.success", "Success"), t("orders.cancelledMsg", "Order has been cancelled."));
            } catch (err: any) {
              Alert.alert(t("common.error", "Error"), err.message);
            } finally {
              setIsCancelling(false);
            }
          }
        }
      ]
    );
  }, [id, refetch, t]);

  if (isLoading) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <HeaderBackButton onPress={() => router.back()} />
        </View>
        <ActivityIndicator size="large" color={theme.colors.brand.primary} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <HeaderBackButton onPress={() => router.back()} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.text.muted} />
          <UIText variant="sheet-title" color="secondary" align="center" style={{ marginTop: 16 }}>
            {t("orders.loadError")}
          </UIText>
          <UIText variant="body" color="muted" align="center" style={{ marginTop: 16 }}>
            {t("orders.loadErrorDesc")}
          </UIText>
          <Pressable onPress={handleRefresh} style={styles.retryBtnTouchable} accessibilityRole="button" accessibilityLabel={t("common.retry")}>
            {({ pressed }) => (
              <View style={[styles.retryBtn, pressed && styles.retryBtnPressed]}>
                <UIText variant="body-sm" weight="bold" style={{ color: theme.colors.brand.primary }}>
                  {t("common.retry")}
                </UIText>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  const statusMeta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.pending;
  const pmMeta = getPaymentMeta(order.paymentMethod, theme);
  const psDisplay = getPaymentStatusDisplay(order.paymentStatus, theme);
  const timeline = buildTimeline(order);
  const shortId = order.id.slice(-8).toUpperCase();
  const isManualPay = order.paymentMethod && order.paymentMethod !== "cod";
  const address = order.address;
  const formattedAddress =
    address.formatted ??
    [
      address.street,
      address.building && t("orders.building", { n: address.building }),
      address.floor && t("orders.floor", { n: address.floor }),
      address.apartment && t("orders.apt", { n: address.apartment }),
      address.city,
    ]
      .filter(Boolean)
      .join(language === "en" ? ", " : "، ");

  const TRACKABLE_STATUSES = new Set([
    "out_for_delivery",
    "picked_up",
    "shipped",
    "driver_accepted",
  ]);
  const isTrackable = TRACKABLE_STATUSES.has(order.status) && Boolean(order.qrToken);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Animated.View entering={FadeIn.duration(240)} style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <UIText variant="eyebrow" color="tertiary" style={styles.headerEyebrow}>
            {t("orders.orderDetail")}
          </UIText>
          <UIText variant="card-title" style={styles.headerOrderId}>#{shortId}</UIText>
        </View>
        <Badge variant={badgeVariant(statusMeta.variant)} label={t(statusMeta.labelKey)} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: pagePad, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={theme.colors.brand.primary}
            colors={[theme.colors.brand.primary]}
          />
        }>

        <Animated.View entering={FadeInDown.delay(30).duration(320)} style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={theme.colors.text.muted} />
            <UIText variant="eyebrow" color="tertiary">{formatDate(order.createdAt, language)}</UIText>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={12} color={theme.colors.text.muted} />
            <UIText variant="eyebrow" color="tertiary">{formatTime(order.createdAt, language)}</UIText>
          </View>
          {order.items.length > 0 && (
            <View style={styles.metaChip}>
              <Ionicons name="cube-outline" size={12} color={theme.colors.text.muted} />
              <UIText variant="eyebrow" color="tertiary">{t("orders.items", { count: order.items.length })}</UIText>
            </View>
          )}
        </Animated.View>

        {isTrackable && (
          <Animated.View entering={FadeInDown.delay(45).duration(320)}>
            <Pressable
              onPress={() =>
                router.push(
                  `/order/track/${order.id}?token=${encodeURIComponent(order.qrToken ?? "")}` as never,
                )
              }
              style={({ pressed }) => [
                trackBtnStyles.btn,
                theme.shadows[2],
                { backgroundColor: theme.colors.brand.primary },
                pressed && { backgroundColor: theme.colors.brand.primaryDark, transform: [{ scale: 0.98 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("tracking.trackDriverBtn", "Track Driver")}
            >
              <Ionicons name="navigate" size={18} color={theme.colors.text.inverse} />
              <UIText
                variant="body-sm"
                weight="bold"
                style={{ color: theme.colors.text.inverse, textAlign: TEXT_START }}
              >
                {t("tracking.trackDriverBtn", "Track Driver")}
              </UIText>
              <Ionicons name="radio-outline" size={15} color={theme.colors.text.inverse} style={{ marginStart: "auto" }} />
            </Pressable>
          </Animated.View>
        )}

        <DetailSection title={t("orders.timeline")} icon="git-branch-outline" delay={60}>
          {timeline.map((step, i) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, step.done ? styles.timelineDotDone : styles.timelineDotPending]}>
                  <Ionicons name={step.icon} size={13} color={step.done ? theme.colors.text.inverse : theme.colors.text.muted} />
                </View>
                {i < timeline.length - 1 && (
                  <View style={[styles.timelineLine, step.done && styles.timelineLineDone]} />
                )}
              </View>
              <UIText
                variant="body-sm"
                weight={step.done ? "bold" : "regular"}
                style={[
                  styles.timelineText,
                  { color: step.done ? theme.colors.text.primary : theme.colors.text.muted },
                ]}>
                {t(step.labelKey)}
              </UIText>
            </View>
          ))}
        </DetailSection>

        {order.items.length > 0 && (
          <DetailSection title={t("orders.itemsSection")} icon="bag-outline" delay={120}>
            {order.items.map((item) => (
              <Pressable
                key={item.productId}
                style={styles.itemCardTouchable}
                onPress={() => router.push(`/product/${item.productId}`)}
                accessibilityRole="button"
                accessibilityLabel={item.name}>
                {({ pressed }) => (
                  <View style={[styles.itemCard, pressed && styles.itemCardPressed]}>
                    {item.imageUrl ? (
                      <SafeImage source={{ uri: item.imageUrl }} style={styles.itemImage} contentFit="contain" />
                    ) : (
                      <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                        <Ionicons name="medkit-outline" size={22} color={theme.colors.text.muted} />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <UIText variant="body-sm" weight="bold" style={styles.itemTitle} numberOfLines={2}>
                        {item.name || t("orders.noItems")}
                      </UIText>
                      <View style={styles.itemMeta}>
                        <UIText variant="caption" color="secondary">{t("orders.qty", { count: item.quantity })}</UIText>
                        <UIText variant="caption" weight="bold" style={[styles.itemPrice, { color: theme.colors.brand.primary }]}>
                          {formatPrice(item.price, language)}
                        </UIText>
                      </View>
                    </View>
                    <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.text.muted} />
                  </View>
                )}
              </Pressable>
            ))}
          </DetailSection>
        )}

        <DetailSection title={t("orders.addressSection")} icon="location-outline" delay={180}>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <Ionicons name="person-outline" size={14} color={theme.colors.brand.primary} />
              <UIText variant="body-sm" weight="bold" style={styles.addressText}>{address.name}</UIText>
            </View>
            <View style={styles.addressRow}>
              <Ionicons name="call-outline" size={14} color={theme.colors.brand.primary} />
              <UIText variant="body-sm" style={styles.addressText}>{address.phone}</UIText>
            </View>
            <View style={[styles.addressRow, { alignItems: "flex-start" }]}>
              <Ionicons name="map-outline" size={14} color={theme.colors.brand.primary} style={{ marginTop: 4 }} />
              <UIText variant="body-sm" style={[styles.addressText, { flex: 1 }]} numberOfLines={3}>
                {formattedAddress}
              </UIText>
            </View>
          </View>
        </DetailSection>

        <DetailSection title={t("checkout.paymentSection")} icon="card-outline" delay={240}>
          <View style={[styles.paymentCard, { backgroundColor: pmMeta.bg }]}>
            <View style={styles.paymentIconBox}>
              <Ionicons name={pmMeta.icon} size={20} color={pmMeta.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <UIText variant="body-sm" weight="bold" style={{ color: pmMeta.color, textAlign: TEXT_START }}>
                {t(pmMeta.labelKey)}
              </UIText>
              <View style={styles.paymentStatusRow}>
                <Ionicons name={psDisplay.icon} size={12} color={psDisplay.color} />
                <UIText variant="caption" style={{ color: psDisplay.color }}>
                  {t(psDisplay.labelKey)}
                </UIText>
              </View>
            </View>
          </View>

          {isManualPay && order.transferNumber && (
            <View style={styles.transferRow}>
              <UIText variant="caption" color="tertiary">{t("orders.transferNumber")}</UIText>
              <UIText variant="body-sm" weight="bold" style={{ textAlign: "left" }}>
                {order.transferNumber}
              </UIText>
            </View>
          )}

          {isManualPay && order.paymentProofUrl && (
            <View style={styles.proofContainer}>
              <UIText
                variant="eyebrow"
                color="tertiary"
                style={{ marginBottom: 4, textAlign: TEXT_START }}>
                {t("orders.paymentProof")}
              </UIText>
              <SafeImage source={{ uri: order.paymentProofUrl }} style={styles.proofImage} contentFit="cover" />
            </View>
          )}
        </DetailSection>

        <DetailSection title={t("orders.priceSection")} icon="receipt-outline" delay={300}>
          <InfoRow label={t("checkout.subtotalRow", { count: order.items.length })} value={formatPrice(order.subtotal, language)} />
          <View style={styles.priceDivider} />
          <InfoRow
            label={t("checkout.deliveryRow")}
            value={order.delivery === 0 ? t("common.free") : formatPrice(order.delivery, language)}
            valueColor={order.delivery === 0 ? theme.colors.status.success : undefined}
          />
          {(order.discountTotal ?? 0) > 0 && (
            <InfoRow
              label={t("checkout.discountRow")}
              value={`−${formatPrice(order.discountTotal ?? 0, language)}`}
              valueColor={theme.colors.status.success}
            />
          )}
          <View style={styles.priceDividerSpaced} />
          <View style={styles.totalRow}>
            <UIText variant="body" weight="extrabold" color="primary" style={styles.totalLabel}>
              {t("orders.total")}
            </UIText>
            <UIText
              variant="card-title"
              weight="black"
              style={[styles.totalValueText, { color: theme.colors.text.primary, letterSpacing: -0.4 }]}>
              {formatPrice(order.total, language)}
            </UIText>
          </View>
        </DetailSection>

        {order.address.notes ? (
          <DetailSection title={t("orders.notesSection")} icon="chatbubble-outline" delay={360}>
            <UIText variant="body-sm" color="secondary" style={{ lineHeight: 22, textAlign: TEXT_START }}>
              {order.address.notes}
            </UIText>
          </DetailSection>
        ) : null}
      <View style={{ paddingVertical: 24, gap: 12 }}>
        <ReorderButton items={order.items} />
        
        {actions?.cancel?.allowed && (
          <Pressable 
            onPress={handleCancelOrder}
            disabled={isCancelling}
            style={({ pressed }) => [
              {
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.status.error,
                alignItems: "center",
                opacity: isCancelling ? 0.6 : (pressed ? 0.8 : 1),
              }
            ]}
          >
            {isCancelling ? (
              <ActivityIndicator color={theme.colors.status.error} size="small" />
            ) : (
              <UIText variant="body-sm" weight="bold" style={{ color: theme.colors.status.error }}>
                {t("orders.cancelOrder", "Cancel Order")}
              </UIText>
            )}
          </Pressable>
        )}

        {actions?.return?.allowed && (
          <Pressable 
            onPress={() => router.push(`/(customer)/(account)/order/${id}/return`)}
            style={({ pressed }) => [
              {
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.brand.primary,
                alignItems: "center",
                opacity: pressed ? 0.8 : 1,
              }
            ]}
          >
            <UIText variant="body-sm" weight="bold" style={{ color: theme.colors.brand.primary }}>
              {t("orders.requestReturn", "Request Return")}
            </UIText>
          </Pressable>
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const trackBtnStyles = StyleSheet.create({
  btn: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
});
