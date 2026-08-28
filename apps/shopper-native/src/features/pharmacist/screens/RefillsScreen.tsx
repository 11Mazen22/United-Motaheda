/**
 * RefillsScreen — the refill_requests workflow. Server infrastructure for
 * this (reviewed_by/reviewed_at/admin_notes/rejection_reason columns, staff
 * RLS) existed with zero pharmacist-facing UI ever built against it. Kept as
 * one screen with inline expand-to-review rather than a separate detail
 * route — a refill needs less inspection surface than a full order or a
 * prescription image, so a second navigation hop would be pure friction.
 */
import React, { useCallback, useState } from "react";
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, Chip, Input, Button, EmptyState, ErrorState, SkeletonCard, useTheme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { formatPrice } from "@/utils/format";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { usePharmacistRefills } from "../hooks/usePharmacistQueries";
import { usePharmacistMutations } from "../hooks/usePharmacistMutations";
import type { PharmacistRefillRequest, RefillRequestStatus } from "../api/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const FILTERS: { key: RefillRequestStatus | "all"; labelKey: string }[] = [
  { key: "all",        labelKey: "pharmacist.filterAll" },
  { key: "pending",    labelKey: "pharmacist.refillStatusPending" },
  { key: "preparing",  labelKey: "pharmacist.refillStatusPreparing" },
  { key: "ready",      labelKey: "pharmacist.refillStatusReady" },
  { key: "on_the_way", labelKey: "pharmacist.refillStatusOnTheWay" },
  { key: "delivered",  labelKey: "pharmacist.refillStatusDelivered" },
  { key: "cancelled",  labelKey: "pharmacist.refillStatusCancelled" },
];

function statusColor(status: RefillRequestStatus, theme: ReturnType<typeof useTheme>["theme"]): string {
  switch (status) {
    case "pending":    return theme.colors.status.warning;
    case "cancelled":  return theme.colors.status.error;
    case "delivered":  return theme.colors.status.success;
    default:           return theme.colors.brand.primary;
  }
}

const ADVANCE_TARGET: Partial<Record<RefillRequestStatus, RefillRequestStatus>> = {
  preparing:  "ready",
  ready:      "on_the_way",
  on_the_way: "delivered",
};

function RefillCard({ refill }: { refill: PharmacistRefillRequest }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const mutations = usePharmacistMutations();
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonTouched, setReasonTouched] = useState(false);

  const color = statusColor(refill.status, theme);
  const busy = mutations.reviewRefill.isPending || mutations.advanceRefill.isPending;
  const nextStatus = ADVANCE_TARGET[refill.status];

  const handleApprove = async () => {
    try {
      await mutations.reviewRefill.mutateAsync({ id: refill.id, decision: "approved" });
      showSuccessSheet(t("pharmacist.refillApprovedTitle", "Refill approved"), t("pharmacist.refillApprovedBody", "Moved to preparation."));
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  const handleReject = async () => {
    if (reason.trim().length === 0) { setReasonTouched(true); return; }
    try {
      await mutations.reviewRefill.mutateAsync({ id: refill.id, decision: "rejected", rejectionReason: reason.trim() });
      showSuccessSheet(t("pharmacist.refillRejectedTitle", "Refill rejected"), t("pharmacist.refillRejectedBody", "The customer has been notified."));
      setShowReject(false);
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  const handleAdvance = async () => {
    if (!nextStatus) return;
    try {
      await mutations.advanceRefill.mutateAsync({ id: refill.id, nextStatus });
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  return (
    <Pressable onPress={() => setExpanded((v) => !v)} style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default, borderStartColor: color, borderStartWidth: 4 }]}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <UIText variant="body" weight="bold" numberOfLines={1}>{refill.medicineName}</UIText>
          <UIText variant="body-sm" color="secondary" numberOfLines={1}>{refill.customerName}</UIText>
        </View>
        <View style={[s.statusPill, { backgroundColor: `${color}17` }]}>
          <UIText variant="caption" weight="bold" style={{ color }}>
            {t(FILTERS.find((f) => f.key === refill.status)?.labelKey ?? refill.status)}
          </UIText>
        </View>
      </View>

      <View style={[s.row, { marginTop: 6, gap: 6 }]}>
        <UIText variant="caption" color="muted">{new Date(refill.placedAt).toLocaleDateString()}</UIText>
        <View style={[s.dot, { backgroundColor: theme.colors.text.muted }]} />
        <UIText variant="caption" color="muted">{formatPrice(refill.total)}</UIText>
      </View>

      {expanded && (
        <View style={[s.expandArea, { borderTopColor: theme.colors.border.default }]}>
          {refill.customerPhone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${refill.customerPhone}`)} style={[s.row, { gap: 6, marginBottom: 8 }]}>
              <Ionicons name="call-outline" size={14} color={theme.colors.brand.primary} />
              <UIText variant="body-sm" style={{ color: theme.colors.brand.primary }}>{refill.customerPhone}</UIText>
            </Pressable>
          ) : null}
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.refillDelivery", "Delivery")}</UIText>
            <UIText variant="body-sm">{refill.delivery}</UIText>
          </View>
          {refill.copay > 0 && (
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.refillCopay", "Copay")}</UIText>
              <UIText variant="body-sm">{formatPrice(refill.copay)}</UIText>
            </View>
          )}
          {refill.trackingNumber ? (
            <View style={[s.row, { justifyContent: "space-between", marginTop: 4 }]}>
              <UIText variant="body-sm" color="secondary">{t("pharmacist.transferNumber")}</UIText>
              <UIText variant="body-sm">{refill.trackingNumber}</UIText>
            </View>
          ) : null}
          {refill.rejectionReason ? (
            <UIText variant="body-sm" color="danger" style={{ marginTop: 8, textAlign: TEXT_START }}>
              {refill.rejectionReason}
            </UIText>
          ) : null}

          {refill.status === "pending" && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {!showReject ? (
                <View style={[s.row, { gap: 8 }]}>
                  <Button label={t("pharmacist.actionApproveRx", "Approve")} onPress={handleApprove} loading={busy} style={{ flex: 1 }} />
                  <Button label={t("pharmacist.actionRejectRx", "Reject")} variant="outline" onPress={() => setShowReject(true)} style={{ flex: 1 }} />
                </View>
              ) : (
                <>
                  <Input
                    value={reason}
                    onChangeText={(v) => { setReason(v); if (reasonTouched) setReasonTouched(false); }}
                    placeholder={t("pharmacist.rejectionReasonPlaceholder", "Reason for rejection")}
                    multiline
                  />
                  {reasonTouched && reason.trim().length === 0 ? (
                    <UIText variant="caption" color="danger">{t("pharmacist.rejectionReasonRequired", "A rejection reason is required.")}</UIText>
                  ) : null}
                  <View style={[s.row, { gap: 8 }]}>
                    <Button label={t("pharmacist.confirmReject", "Confirm Reject")} variant="danger" onPress={handleReject} loading={busy} style={{ flex: 1 }} />
                    <Button label={t("common.cancel", "Cancel")} variant="ghost" onPress={() => setShowReject(false)} style={{ flex: 1 }} />
                  </View>
                </>
              )}
            </View>
          )}

          {nextStatus && (
            <Button
              label={t(`pharmacist.refillAdvanceTo${nextStatus === "ready" ? "Ready" : nextStatus === "on_the_way" ? "OnTheWay" : "Delivered"}`)}
              onPress={handleAdvance}
              loading={busy}
              full
              style={{ marginTop: 12 }}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

export function RefillsScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { pagePad, isTablet } = useScreenLayout();
  const [filter, setFilter] = useState<RefillRequestStatus | "all">("pending");
  const refillsQ = usePharmacistRefills(filter);
  // Independent of whichever filter tab is active — the hero always states
  // how many refills are actually waiting on a decision, the same "what
  // needs my attention right now" framing Orders/Workbench use.
  const pendingQ = usePharmacistRefills("pending");

  const items = refillsQ.data ?? [];
  const pendingCount = pendingQ.data?.length ?? 0;

  const onRefresh = useCallback(async () => { await refillsQ.refetch(); }, [refillsQ]);

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
            <UIText variant="eyebrow" style={s.heroEyebrow}>
              {t("pharmacist.refillsEyebrow", "Refill Requests")}
            </UIText>
            <UIText variant="screen-title" style={{ color: "#fff" }}>
              {t("pharmacist.refillsTitle", "Refills")}
            </UIText>
          </View>
          <View style={s.heroIconWell}>
            <Ionicons name="repeat" size={20} color="#fff" />
          </View>
        </View>
        <UIText variant="caption" style={s.heroSubtitle}>
          {pendingCount > 0
            ? t("pharmacist.refillsPendingCount", { count: pendingCount, defaultValue: "{{count}} awaiting your decision" })
            : t("pharmacist.refillsAllHandled", "All refill requests are handled")}
        </UIText>
      </LinearGradient>

      <View style={[s.filterRow, { flexDirection: flexRow(IS_RTL), paddingHorizontal: pagePad }]}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={t(f.labelKey)} selected={filter === f.key} selectable onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {refillsQ.isLoading ? (
        <View style={[s.listContent, { paddingHorizontal: pagePad }]}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      ) : refillsQ.isError ? (
        <ErrorState message={t("common.error")} retry={() => void refillsQ.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[
            s.listContent,
            { paddingHorizontal: pagePad },
            isTablet && { maxWidth: 720, alignSelf: "center", width: "100%" },
          ]}
          refreshControl={<RefreshControl refreshing={refillsQ.isFetching} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
          renderItem={({ item }) => <RefillCard refill={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <EmptyState
              icon="repeat-outline"
              title={t("pharmacist.emptyRefillsTitle", "No refill requests")}
              subtitle={t("pharmacist.emptyRefillsSubtitle", "Refill requests will appear here as customers place them.")}
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
  filterRow: { gap: 8, paddingVertical: 12, flexWrap: "wrap" },
  listContent: { paddingBottom: 40 },
  row: { flexDirection: flexRow(IS_RTL), alignItems: "center" },
  card: { borderRadius: 14, padding: 14, borderWidth: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  expandArea: { marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
