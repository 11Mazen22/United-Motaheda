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

import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Image as ExpoImage } from "expo-image";
import { Image as RNImage } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { StyleSheet } from "react-native";
import { useOrderDetail } from "@/features/orders/hooks/useOrders";
import { Text as UIText } from "@pharmacy/ui-native";
import { Badge } from "@/components/ui/Badge";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { formatPrice } from "@/utils/format";
import { FORWARD_CHEVRON, textAlignStart, isRtl } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAppLanguage } from "@/i18n/LanguageProvider";

const TEXT_START = textAlignStart(isRtl());

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
import { styles } from "@/features/orders/components/order-detail.styles";

// ─── SafeImage — expo-image on native, RNImage on web ────────────────────────
// expo-image passes camelCase fetchPriority to the DOM on web, which React
// doesn't recognise. Use RNImage on web to suppress the warning.

function SafeImage({
  source, style, contentFit,
}: {
  source:     { uri: string };
  style:      object;
  contentFit: "contain" | "cover";
}) {
  if (Platform.OS === "web") return <RNImage source={source} style={style} resizeMode={contentFit} />;
  return <ExpoImage source={source} style={style} contentFit={contentFit} />;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrderDetailScreen(): React.ReactElement {
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const { t }        = useTranslation();
  const { language } = useAppLanguage();
  const { pagePad } = useScreenLayout();
  const { id }       = useLocalSearchParams<{ id: string }>();

  const { data: order, isLoading, isRefetching, refetch, isError } = useOrderDetail(id);
  const handleRefresh = useCallback(() => { void refetch(); }, [refetch]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <HeaderBackButton onPress={() => router.back()} />
        </View>
        <ActivityIndicator size="large" color={kit.color.accent} style={{ marginTop: 80 }} />
      </View>
    );
  }

  // ── Error / not found ────────────────────────────────────────────────────────
  if (isError || !order) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <HeaderBackButton onPress={() => router.back()} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="alert-circle-outline" size={48} color={kit.color.inkFaint} />
          <UIText variant="sheet-title" color="secondary" align="center" style={{ marginTop: theme.spacing.lg }}>
            {t("orders.loadError")}
          </UIText>
          <UIText variant="body" color="muted" align="center" style={{ marginTop: theme.spacing.sm }}>
            {t("orders.loadErrorDesc")}
          </UIText>
          <Pressable onPress={handleRefresh} style={styles.retryBtnTouchable} accessibilityRole="button">
            {({ pressed }) => (
              <View style={[styles.retryBtn, pressed && styles.retryBtnPressed]}>
                <UIText variant="body-sm" weight="bold" style={{ color: kit.color.accentDeep }}>
                  {t("common.retry")}
                </UIText>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  const statusMeta  = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.pending;
  const pmMeta      = getPaymentMeta(order.paymentMethod);
  const psDisplay   = getPaymentStatusDisplay(order.paymentStatus);
  const timeline    = buildTimeline(order);
  const shortId     = order.id.slice(-8).toUpperCase();
  const isManualPay = order.paymentMethod && order.paymentMethod !== "cod";
  const address     = order.address;
  const formattedAddress =
    address.formatted ??
    [
      address.street,
      address.building && t("orders.building", { n: address.building }),
      address.floor    && t("orders.floor",    { n: address.floor    }),
      address.apartment && t("orders.apt",     { n: address.apartment }),
      address.city,
    ]
      .filter(Boolean)
      .join(language === "en" ? ", " : "، ");

  // ── Track Driver button visibility ──────────────────────────────────────────
  // Shown when:
  //   • order is actively being delivered (any in-transit status)
  //   • qrToken is available (required by track-order Edge Function)
  // qrToken is fetched as part of ORDERS_SELECT (added in B4 Task 4).
  const TRACKABLE_STATUSES = new Set([
    "out_for_delivery",
    "picked_up",
    "shipped",
    "driver_accepted",
  ]);
  const isTrackable = TRACKABLE_STATUSES.has(order.status) && Boolean(order.qrToken);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Sticky header ───────────────────────────────────────────────────── */}
      <Animated.View entering={FadeIn.duration(240)} style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <View style={{ flex: 1 }}>
          <UIText variant="eyebrow" color="tertiary" style={styles.headerEyebrow}>
            {t("orders.orderDetail")}
          </UIText>
          <UIText variant="card-title" style={styles.headerOrderId}>#{shortId}</UIText>
        </View>
        <Badge variant={statusMeta.variant} size="sm">{t(statusMeta.labelKey)}</Badge>
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
            tintColor={kit.color.accent}
            colors={[kit.color.accent]}
          />
        }>

        {/* ── Meta chip row ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(30).duration(320)} style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="calendar-outline" size={12} color={kit.color.inkFaint} />
            <UIText variant="eyebrow" color="tertiary">{formatDate(order.createdAt, language)}</UIText>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={12} color={kit.color.inkFaint} />
            <UIText variant="eyebrow" color="tertiary">{formatTime(order.createdAt, language)}</UIText>
          </View>
          {order.items.length > 0 && (
            <View style={styles.metaChip}>
              <Ionicons name="cube-outline" size={12} color={kit.color.inkFaint} />
              <UIText variant="eyebrow" color="tertiary">{t("orders.items", { count: order.items.length })}</UIText>
            </View>
          )}
        </Animated.View>

        {/* ── Track Driver button ────────────────────────────────────────── */}
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
                pressed && trackBtnStyles.btnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("tracking.trackDriverBtn", "Track Driver")}
            >
              <Ionicons name="navigate" size={18} color={kit.color.onAccent} />
              <UIText
                variant="body-sm"
                weight="bold"
                style={{ color: kit.color.onAccent, textAlign: TEXT_START }}
              >
                {t("tracking.trackDriverBtn", "Track Driver")}
              </UIText>
              <Ionicons name="radio-outline" size={15} color={kit.color.onAccent} style={{ marginStart: "auto" }} />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Timeline ──────────────────────────────────────────────────────── */}
        <DetailSection title={t("orders.timeline")} icon="git-branch-outline" delay={60}>
          {timeline.map((step, i) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, step.done ? styles.timelineDotDone : styles.timelineDotPending]}>
                  <Ionicons name={step.icon} size={13} color={step.done ? kit.color.onInk : kit.color.inkFaint} />
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
                  { color: step.done ? kit.color.ink : kit.color.inkFaint },
                ]}>
                {t(step.labelKey)}
              </UIText>
            </View>
          ))}
        </DetailSection>

        {/* ── Items ──────────────────────────────────────────────────────────── */}
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
                        <Ionicons name="medkit-outline" size={22} color={kit.color.inkFaint} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <UIText variant="body-sm" weight="bold" style={styles.itemTitle} numberOfLines={2}>
                        {item.name || t("orders.noItems")}
                      </UIText>
                      <View style={styles.itemMeta}>
                        <UIText variant="caption" color="secondary">{t("orders.qty", { count: item.quantity })}</UIText>
                        <UIText variant="caption" weight="bold" style={[styles.itemPrice, { color: kit.color.accentDeep }]}>
                          {formatPrice(item.price)}
                        </UIText>
                      </View>
                    </View>
                    <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.inkFaint} />
                  </View>
                )}
              </Pressable>
            ))}
          </DetailSection>
        )}

        {/* ── Address ────────────────────────────────────────────────────────── */}
        <DetailSection title={t("orders.addressSection")} icon="location-outline" delay={180}>
          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <Ionicons name="person-outline" size={14} color={kit.color.accentDeep} />
              <UIText variant="body-sm" weight="bold" style={styles.addressText}>{address.name}</UIText>
            </View>
            <View style={styles.addressRow}>
              <Ionicons name="call-outline" size={14} color={kit.color.accentDeep} />
              <UIText variant="body-sm" style={styles.addressText}>{address.phone}</UIText>
            </View>
            <View style={[styles.addressRow, { alignItems: "flex-start" }]}>
              <Ionicons name="map-outline" size={14} color={kit.color.accentDeep} style={{ marginTop: theme.spacing.xs }} />
              <UIText variant="body-sm" style={[styles.addressText, { flex: 1 }]} numberOfLines={3}>
                {formattedAddress}
              </UIText>
            </View>
          </View>
        </DetailSection>

        {/* ── Payment ────────────────────────────────────────────────────────── */}
        <DetailSection title={t("checkout.paymentSection")} icon="card-outline" delay={240}>
          <View style={[styles.paymentCard, { backgroundColor: pmMeta.bg }]}>
            <View style={styles.paymentIconBox}>
              <Ionicons name={pmMeta.icon} size={20} color={pmMeta.color} />
            </View>
            <View style={{ flex: 1 }}>
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
              {/* Transfer numbers are value-shaped — keep LTR composition */}
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
                style={{ marginBottom: theme.spacing.sm, textAlign: TEXT_START }}>
                {t("orders.paymentProof")}
              </UIText>
              <SafeImage source={{ uri: order.paymentProofUrl }} style={styles.proofImage} contentFit="cover" />
            </View>
          )}
        </DetailSection>

        {/* ── Price breakdown — receipt grammar ──────────────────────────────── */}
        <DetailSection title={t("orders.priceSection")} icon="receipt-outline" delay={300}>
          <InfoRow label={t("checkout.subtotalRow", { count: order.items.length })} value={formatPrice(order.subtotal)} />
          <View style={styles.priceDivider} />
          <InfoRow
            label={t("checkout.deliveryRow")}
            value={order.delivery === 0 ? t("common.free") : formatPrice(order.delivery)}
            valueColor={order.delivery === 0 ? kit.color.success : undefined}
          />
          {(order.discountTotal ?? 0) > 0 && (
            <InfoRow
              label={t("checkout.discountRow")}
              value={`−${formatPrice(order.discountTotal ?? 0)}`}
              valueColor={kit.color.success}
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
              style={[styles.totalValueText, { color: kit.color.ink, letterSpacing: -0.4 }]}>
              {formatPrice(order.total)}
            </UIText>
          </View>
        </DetailSection>

        {/* ── Notes ──────────────────────────────────────────────────────────── */}
        {order.address.notes ? (
          <DetailSection title={t("orders.notesSection")} icon="chatbubble-outline" delay={360}>
            <UIText variant="body-sm" color="secondary" style={{ lineHeight: 22, textAlign: TEXT_START }}>
              {order.address.notes}
            </UIText>
          </DetailSection>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ─── Track Driver button styles ───────────────────────────────────────────────
// Defined outside the component (no closure needed) to avoid re-creation on
// every render, matching the pattern used in DeliveryExecutionScreen.tsx.
const trackBtnStyles = StyleSheet.create({
  btn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               10,
    backgroundColor:   kit.color.accent,
    borderRadius:      kit.radius.lg,
    paddingVertical:   14,
    paddingHorizontal: 18,
    ...kit.shadow.brandGlow,
  },
  btnPressed: {
    backgroundColor: kit.color.accentDeep,
    transform:       [{ scale: 0.98 }],
  },
});
