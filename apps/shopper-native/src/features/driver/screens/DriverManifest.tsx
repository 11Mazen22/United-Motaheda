/**
 * DriverManifest — the driver section's home screen. Shows any pending
 * assignment offers up top (needs a response), then today's active manifest
 * (accepted orders still being prepared/delivered).
 */
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Screen, Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { useDriverManifest, useDriverOffers, driverQueryKeys } from "../hooks/useDriverManifest";
import type { ManifestOrder } from "../api";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// "preparing" is the fallback bucket for every pre-ready stage (pending,
// pending_payment, confirmed, preparing, and the legacy "processing" synonym)
// — the driver doesn't need pharmacy-internal stage distinctions, just
// "not yet" vs "go pick it up" vs "already picked up".
const STATUS_META: Record<string, { labelKey: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  preparing: { labelKey: "driver.statusPreparing", color: kit.color.inkSoft,    bg: kit.color.well,       icon: "time-outline" },
  ready:     { labelKey: "driver.statusReady",     color: kit.color.accentDeep, bg: kit.color.accentTint, icon: "cube-outline" },
  picked_up: { labelKey: "driver.statusPickedUp",  color: kit.color.warn,       bg: kit.color.warnTint,   icon: "car-outline" },
};

function OfferBanner({ count, onPress }: { count: number; onPress: () => void }) {
  const { t } = useTranslation();
  if (count === 0) return null;
  return (
    <Pressable onPress={onPress} style={s.offerBanner}>
      <View style={s.offerIconWell}>
        <Ionicons name="notifications" size={18} color={kit.color.onInk} />
      </View>
      <View style={{ flex: 1 }}>
        <UIText variant="card-title" color="inverse" style={{ textAlign: TEXT_START }}>
          {t("driver.newOfferTitle", { count })}
        </UIText>
        <UIText variant="body-sm" color="inverse-muted" style={{ textAlign: TEXT_START }}>
          {t("driver.newOfferBody")}
        </UIText>
      </View>
      <Ionicons name={FORWARD_CHEVRON} size={18} color={kit.color.onInk} />
    </Pressable>
  );
}

// "shipped" is the legacy synonym for "picked_up" (see
// packages/contracts/src/orderStatus.ts) — old rows may still carry it.
const STATUS_ALIASES: Record<string, string> = { shipped: "picked_up", processing: "preparing" };

function ManifestCard({ order, onPress }: { order: ManifestOrder; onPress: () => void }) {
  const { t } = useTranslation();
  const key = STATUS_ALIASES[order.status] ?? order.status;
  const meta = STATUS_META[key] ?? STATUS_META.preparing;
  return (
    <Pressable onPress={onPress} style={s.card}>
      <View style={s.cardHeader}>
        <View style={[s.statusPill, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={13} color={meta.color} />
          <UIText variant="caption" style={{ color: meta.color }}>{t(meta.labelKey)}</UIText>
        </View>
        <Ionicons name={FORWARD_CHEVRON} size={16} color={kit.color.inkFaint} />
      </View>
      <UIText variant="card-title" style={{ textAlign: TEXT_START, marginTop: 8 }}>
        {order.customerName || t("driver.unknownCustomer")}
      </UIText>
      <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }} numberOfLines={2}>
        {order.customerAddress || "—"}
      </UIText>
      <View style={s.cardFooter}>
        <UIText variant="body-sm" color="muted">#{order.id.slice(-8).toUpperCase()}</UIText>
        <UIText variant="card-title" color="brand">{formatPrice(order.total)}</UIText>
      </View>
    </Pressable>
  );
}

function ShiftSummary({ orders, offers }: { orders: ManifestOrder[]; offers: number }) {
  const { t } = useTranslation();
  const inTransit = orders.filter((order) => (STATUS_ALIASES[order.status] ?? order.status) === "picked_up").length;
  return (
    <View style={s.summaryCard}>
      <View style={s.summaryIntro}>
        <View style={s.summaryIcon}><Ionicons name="speedometer-outline" size={20} color={kit.color.onInk} /></View>
        <View style={{ flex: 1 }}>
          <UIText variant="card-title" color="inverse" style={{ textAlign: TEXT_START }}>{t("driver.manifestTitle")}</UIText>
          <UIText variant="body-sm" color="inverse-muted" style={{ textAlign: TEXT_START, marginTop: 2 }}>{t("driver.newOfferBody")}</UIText>
        </View>
      </View>
      <View style={s.summaryMetrics}>
        <View style={s.metric}><UIText style={s.metricValue}>{orders.length}</UIText><UIText style={s.metricLabel}>{t("driver.items")}</UIText></View>
        <View style={s.metricDivider} />
        <View style={s.metric}><UIText style={s.metricValue}>{inTransit}</UIText><UIText style={s.metricLabel}>{t("driver.statusPickedUp")}</UIText></View>
        <View style={s.metricDivider} />
        <View style={s.metric}><UIText style={s.metricValue}>{offers}</UIText><UIText style={s.metricLabel}>{t("driver.newOfferTitle", { count: offers })}</UIText></View>
      </View>
    </View>
  );
}

export function DriverManifest(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const manifestQuery = useDriverManifest(user?.id);
  const offersQuery = useDriverOffers(user?.id);

  const onRefresh = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: driverQueryKeys.manifest(user.id) }),
        queryClient.invalidateQueries({ queryKey: driverQueryKeys.offers(user.id) }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, user?.id]);

  const orders = manifestQuery.data ?? [];
  const offerCount = offersQuery.data?.length ?? 0;

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <View style={s.header}>
        <View>
          <UIText variant="caption" color="brand" style={{ textAlign: TEXT_START }}>
            {t("driver.eyebrow")}
          </UIText>
          <UIText variant="screen-title" style={{ textAlign: TEXT_START, marginTop: 2 }}>
            {t("driver.greeting", { name: user?.name ?? "" })}
          </UIText>
        </View>
        <Pressable onPress={() => void signOut()} style={s.logoutBtn} accessibilityRole="button" accessibilityLabel={t("driver.signOut")}>
          <Ionicons name="log-out-outline" size={20} color={kit.color.inkSoft} />
        </Pressable>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={kit.color.accent} />}
        ListHeaderComponent={
          <>
            <ShiftSummary orders={orders} offers={offerCount} />
            <OfferBanner count={offerCount} onPress={() => router.push("/(driver)/offers" as never)} />
            <UIText variant="section-head" style={{ textAlign: TEXT_START, marginTop: 4, marginBottom: 10 }}>
              {t("driver.manifestTitle")}
            </UIText>
          </>
        }
        renderItem={({ item }) => (
          <ManifestCard order={item} onPress={() => router.push(`/(driver)/delivery/${item.id}` as never)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          manifestQuery.isLoading ? (
            <View style={s.emptyState}>
              <ActivityIndicator size="large" color={kit.color.accent} />
              <UIText variant="body-sm" color="secondary" style={{ marginTop: 12 }}>{t("common.loading")}</UIText>
            </View>
          ) : manifestQuery.isError ? (
            <View style={s.emptyState}>
              <Ionicons name="cloud-offline-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>{t("errors.network")}</UIText>
              <Pressable onPress={() => void onRefresh()} style={s.retryBtn}><UIText variant="body-sm" color="brand">{t("common.retry")}</UIText></Pressable>
            </View>
          ) : !manifestQuery.isLoading ? (
            <View style={s.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
                {t("driver.emptyManifestTitle")}
              </UIText>
              <UIText variant="body-sm" color="secondary" style={{ marginTop: 4, textAlign: "center" }}>
                {t("driver.emptyManifestBody")}
              </UIText>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: kit.inset.screen,
    paddingTop: 12,
    paddingBottom: 8,
  },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: kit.color.surface,
    borderWidth: 1, borderColor: kit.color.line,
  },
  listContent: {
    paddingHorizontal: kit.inset.screen,
    paddingBottom: 40,
  },
  summaryCard: { backgroundColor: kit.color.ink, borderRadius: kit.radius.xl, padding: 16, marginBottom: 14, ...kit.shadow.raised },
  summaryIntro: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
  summaryIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  summaryMetrics: { flexDirection: flexRow(IS_RTL), alignItems: "center", marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.18)" },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 20, fontFamily: theme.fonts.black, color: kit.color.onInk },
  metricLabel: { fontSize: 9, color: "rgba(255,255,255,0.68)", textAlign: "center", marginTop: 2 },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: "rgba(255,255,255,0.22)" },
  offerBanner: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 12,
    backgroundColor: kit.color.ink,
    borderRadius: kit.radius.xl,
    padding: 16,
    marginBottom: 16,
    ...kit.shadow.raised,
  },
  offerIconWell: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  card: {
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.xl,
    padding: 16,
    ...kit.shadow.card,
  },
  cardHeader: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: kit.radius.pill,
  },
  cardFooter: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  retryBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: kit.radius.pill, backgroundColor: kit.color.accentTint },
});
