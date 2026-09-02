/**
 * ReturnsQueueScreen — return requests actually ready for a pharmacist to
 * inspect. usePharmacistReturns() (and the return-inspection detail screen
 * it feeds) existed fully built with zero navigation entry point anywhere
 * in the app before this — a return could reach INSPECTION server-side
 * with no way for staff to discover or open it at all.
 *
 * Scoped to INSPECTION only (see listPendingReturns' own comment):
 * REQUESTED/UNDER_REVIEW returns need a different initial admit/decline
 * decision that has no UI yet either (process-return's approve_request/
 * reject_request actions exist server-side, unused) -- listing them here
 * would just be a second dead-end tap, not a fix.
 */
import React, { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, EmptyState, ErrorState, SkeletonCard, useTheme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { usePharmacistReturns } from "../hooks/usePharmacistQueries";
import type { PharmacistReturnRequest } from "../api/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function ReturnCard({ item, onPress, index }: { item: PharmacistReturnRequest; onPress: () => void; index: number }) {
  const { theme } = useTheme();

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(240)}>
      <Pressable
        onPress={onPress}
        style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}
        accessibilityRole="button"
      >
        <View style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.icon, { backgroundColor: `${theme.colors.status.warning}1A` }]}>
            <Ionicons name="return-up-back" size={16} color={theme.colors.status.warning} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText variant="card-title" numberOfLines={1} style={{ textAlign: TEXT_START }}>
              {item.customerName ?? "—"}
            </UIText>
            <UIText variant="caption" color="secondary" numberOfLines={1} style={{ textAlign: TEXT_START, marginTop: 2 }}>
              {item.reason}
            </UIText>
          </View>
          <Ionicons name={FORWARD_CHEVRON} size={16} color={theme.colors.text.muted} />
        </View>

        <View style={[s.footRow, { flexDirection: flexRow(IS_RTL), borderTopColor: theme.colors.border.default }]}>
          <UIText variant="body-sm" weight="bold">{formatPrice(item.orderTotal)}</UIText>
          <UIText variant="caption" color="muted">#{item.orderId.slice(-8).toUpperCase()}</UIText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function ReturnsQueueScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const { pagePad, isTablet } = useScreenLayout();
  const returnsQuery = usePharmacistReturns();

  const items = returnsQuery.data ?? [];

  const onRefresh = useCallback(async () => {
    await returnsQuery.refetch();
  }, [returnsQuery]);

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingHorizontal: pagePad }]}
      >
        <View style={[s.heroRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText variant="eyebrow" style={s.heroEyebrow}>{t("pharmacist.returnsEyebrow", "Return Inspection")}</UIText>
            <UIText variant="screen-title" style={{ color: "#fff" }}>{t("pharmacist.returnsTitle", "Returns")}</UIText>
          </View>
          <View style={s.heroIconWell}>
            <Ionicons name="return-up-back" size={20} color="#fff" />
          </View>
        </View>
        <UIText variant="caption" style={s.heroSubtitle}>
          {items.length > 0
            ? t("pharmacist.returnsPendingCount", { count: items.length, defaultValue: "{{count}} awaiting inspection" })
            : t("pharmacist.returnsAllHandled", "No returns waiting on inspection")}
        </UIText>
      </LinearGradient>

      {returnsQuery.isLoading ? (
        <View style={[s.listContent, { paddingHorizontal: pagePad }]}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      ) : returnsQuery.isError ? (
        <ErrorState message={t("common.error")} retry={() => void returnsQuery.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[
            s.listContent,
            { paddingHorizontal: pagePad },
            isTablet && { maxWidth: 720, alignSelf: "center", width: "100%" },
          ]}
          refreshControl={<RefreshControl refreshing={returnsQuery.isFetching} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
          renderItem={({ item, index }) => (
            <ReturnCard item={item} index={index} onPress={() => router.push(`/(pharmacist)/return/${item.orderId}` as never)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-circle-outline"
              title={t("pharmacist.emptyReturnsTitle", "Nothing to inspect")}
              subtitle={t("pharmacist.emptyReturnsSubtitle", "Returns will appear here once they reach inspection.")}
            />
          }
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: 12, paddingBottom: 18, gap: 6 },
  heroRow: { alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroEyebrow: { color: "rgba(255,255,255,0.78)", letterSpacing: 1, marginBottom: 2 },
  heroIconWell: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    flexShrink: 0,
  },
  heroSubtitle: { color: "rgba(255,255,255,0.82)", marginTop: 2 },
  listContent: { paddingTop: 16, paddingBottom: 48 },
  card: { borderRadius: 14, padding: 14, borderWidth: 1, gap: 10 },
  row: { alignItems: "center", gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  footRow: { alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
