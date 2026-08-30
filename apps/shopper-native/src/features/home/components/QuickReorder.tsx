/**
 * QuickReorder — "running low on your usual meds?" rail.
 *
 * Deduplicates the customer's real order history into their most recently
 * ordered products (one card per product, most recent first), each with a
 * one-tap re-add via the existing useReorder() hook — which re-fetches
 * current price/stock rather than trusting the stale order snapshot, so
 * this never adds an item at a price that's since changed.
 *
 * Renders nothing for guests or customers with no order history yet —
 * this section only exists once there's real repeat-purchase behavior to
 * act on, matching TodayCare's "guest → commerce leads" convention.
 */
import React, { memo, useCallback, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAuth } from "@/features/auth";
import { useOrders } from "@/features/orders/hooks/useOrders";
import { useReorder } from "@/features/orders/hooks/useReorder";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import type { Order, OrderItem } from "@/stores/orders";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
const CARD_W = 132;
const MAX_ITEMS = 8;
const DEFAULT_BLURHASH = "L6PZfSi_.AyE_3t7t7R**0o#DgR4";

function timeAgo(iso: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (days < 1) return t("common.today", { defaultValue: "today" });
  if (days === 1) return t("common.yesterday", { defaultValue: "yesterday" });
  if (days < 30) return t("common.daysAgo", { count: days, defaultValue: `${days}d ago` });
  const months = Math.floor(days / 30);
  return t("common.monthsAgo", { count: months, defaultValue: `${months}mo ago` });
}

/** Most recent occurrence of each distinct product across all orders. */
function dedupeByProduct(orders: Order[]): Array<{ item: OrderItem; orderedAt: string }> {
  const seen = new Map<string, { item: OrderItem; orderedAt: string }>();
  const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const order of sorted) {
    for (const item of order.items) {
      if (!seen.has(item.productId)) {
        seen.set(item.productId, { item, orderedAt: order.createdAt });
      }
    }
    if (seen.size >= MAX_ITEMS) break;
  }
  return Array.from(seen.values());
}

export const QuickReorder = memo(function QuickReorder() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { pagePad } = useScreenLayout();
  const { data: orders } = useOrders(user?.id);

  const entries = useMemo(() => (orders && orders.length > 0 ? dedupeByProduct(orders) : []), [orders]);

  if (!user || entries.length === 0) return null;

  return (
    <View style={sectionStyles.wrap}>
      <HomeSectionHeader
        eyebrow={t("home.reorderEyebrow")}
        title={t("home.reorderTitle")}
        icon="refresh"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: pagePad, gap: 10 }}
      >
        {entries.map(({ item, orderedAt }) => (
          <ReorderCard key={item.productId} item={item} orderedAt={orderedAt} theme={theme} t={t} />
        ))}
      </ScrollView>
    </View>
  );
});

function ReorderCard({ item, orderedAt, theme, t }: {
  item: OrderItem;
  orderedAt: string;
  theme: NativeTheme;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  const { reorder } = useReorder();
  const [status, setStatus] = useState<"idle" | "adding" | "added">("idle");
  const [imgFailed, setImgFailed] = useState(false);
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const handleAdd = useCallback(async () => {
    if (status !== "idle") return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStatus("adding");
    pulse.value = withSequence(withSpring(0.85, { damping: 8, stiffness: 500 }), withSpring(1, { damping: 10, stiffness: 260 }));
    await reorder([item]);
    setStatus("added");
    setTimeout(() => setStatus("idle"), 1400);
  }, [status, reorder, item, pulse]);

  return (
    <View style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }, theme.shadows[1]]}>
      <View style={[s.imgWrap, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
        {item.imageUrl && !imgFailed ? (
          <Image source={{ uri: item.imageUrl }} style={s.img} placeholder={DEFAULT_BLURHASH} contentFit="contain" transition={150} onError={() => setImgFailed(true)} />
        ) : (
          <Ionicons name="medkit-outline" size={22} color={theme.colors.text.muted} />
        )}
      </View>
      <UIText weight="bold" numberOfLines={2} style={[s.name, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>
        {item.name}
      </UIText>
      <UIText style={[s.meta, { color: theme.colors.text.muted, textAlign: TEXT_START }]}>
        {t("home.reorderLastOrdered", { time: timeAgo(orderedAt, t) })}
      </UIText>
      <Animated.View style={pulseStyle}>
        <Pressable
          onPress={handleAdd}
          disabled={status !== "idle"}
          accessibilityRole="button"
          accessibilityLabel={item.name}
          style={[s.addBtn, { backgroundColor: status === "added" ? theme.colors.status.success : theme.colors.brand.accent, flexDirection: flexRow(IS_RTL) }]}
        >
          {status === "added" ? (
            <Animated.View entering={FadeIn.duration(120)} style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 4 }}>
              <Ionicons name="checkmark" size={13} color="#FFFFFF" />
              <UIText weight="extrabold" style={s.addBtnText}>{t("home.reorderAdded")}</UIText>
            </Animated.View>
          ) : (
            <>
              <Ionicons name="add" size={13} color="#FFFFFF" />
              <UIText weight="extrabold" style={s.addBtnText}>{t("home.reorderAdd")}</UIText>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { width: CARD_W, borderRadius: 16, borderWidth: 1, padding: 10, gap: 6 },
  imgWrap: { width: "100%", height: 72, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  img: { width: "100%", height: "100%" },
  name: { fontSize: 12, lineHeight: 16, minHeight: 32, includeFontPadding: false },
  meta: { fontSize: 10, lineHeight: 13, includeFontPadding: false },
  addBtn: { height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2 },
  addBtnText: { fontSize: 11, lineHeight: 14, color: "#FFFFFF", includeFontPadding: false },
});
