/**
 * PrescriptionQueueScreen — pharmacist review queue for pending prescriptions.
 *
 * Shows a filterable list of prescriptions (pending / approved / rejected).
 * Tapping a row opens PrescriptionDetailScreen for review.
 *
 * Rebuilt with the same gradient-hero language Orders/Refills/Inventory
 * already use — this was the last top-level pharmacist screen still on a
 * bare bordered title bar with no live count, and its cards had no visual
 * distinction between submission channels.
 */
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, Card, Chip, Input, EmptyState as PUIEmptyState, useTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAllPrescriptions } from "../hooks/usePharmacistQueries";
import type { PrescriptionReviewStatus, PharmacistPrescription, SubmissionSource } from "../api/types";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);
// A pending review sitting longer than this reads as "falling behind" —
// same 30-minute threshold Workbench's own RxQueueCard already uses, so
// the two screens agree on what counts as urgent.
const RX_URGENT_MS = 30 * 60_000;

const STATUS_FILTERS: { key: PrescriptionReviewStatus | "all"; labelKey: string }[] = [
  { key: "all",            labelKey: "pharmacist.rxAll"      },
  { key: "pending_review", labelKey: "pharmacist.rxPending"  },
  { key: "approved",       labelKey: "pharmacist.rxApproved" },
  { key: "rejected",       labelKey: "pharmacist.rxRejected" },
];

const SOURCE_META: Record<SubmissionSource, { icon: React.ComponentProps<typeof Ionicons>["name"]; labelKey: string; fallback: string }> = {
  whatsapp: { icon: "logo-whatsapp",       labelKey: "pharmacist.sourceWhatsapp", fallback: "WhatsApp" },
  scan:     { icon: "scan-outline",        labelKey: "pharmacist.scan",           fallback: "Scan" },
  manual:   { icon: "document-text-outline", labelKey: "pharmacist.manual",       fallback: "Manual" },
};

function formatRxDate(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale);
}

function ageMs(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Date.now() - t);
}

function StatChip({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <View style={s.statChip}>
      <UIText style={[s.statChipValue, { color: tone }]}>{value}</UIText>
      <UIText variant="caption" style={s.statChipLabel} numberOfLines={1}>{label}</UIText>
    </View>
  );
}

function RxCard({ rx, onPress, theme, locale, index }: {
  rx: PharmacistPrescription;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
  locale: string;
  index: number;
}) {
  const { t } = useTranslation();

  const tone =
    rx.reviewStatus === "approved" ? theme.colors.status.success :
    rx.reviewStatus === "rejected" ? theme.colors.status.error :
    theme.colors.status.warning;
  const statusLabelKey =
    rx.reviewStatus === "approved" ? "pharmacist.rxApproved" :
    rx.reviewStatus === "rejected" ? "pharmacist.rxRejected" :
    "pharmacist.rxPending";
  const source = SOURCE_META[rx.submissionSource] ?? SOURCE_META.manual;
  const isUrgent = rx.reviewStatus === "pending_review" && ageMs(rx.addedAt ?? rx.createdAt) > RX_URGENT_MS;

  return (
    <Animated.View entering={FadeInDown.duration(280).delay(Math.min(index, 8) * 40).springify()}>
      <Card onPress={onPress} style={[s.card, { borderColor: theme.colors.border.default, borderStartColor: tone, borderStartWidth: 4 }]} elevation="sm">
        <View style={[s.row, { flexDirection: flexRow(IS_RTL), gap: 10 }]}>
          <View style={[s.sourceIcon, { backgroundColor: `${theme.colors.brand.primary}14` }]}>
            <Ionicons name={source.icon} size={16} color={theme.colors.brand.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={[s.row, { flexDirection: flexRow(IS_RTL), gap: 5 }]}>
              <UIText variant="card-title" numberOfLines={1} style={{ textAlign: TEXT_START, flexShrink: 1 }}>{rx.name || "—"}</UIText>
              {isUrgent && <Ionicons name="warning" size={13} color={theme.colors.status.warning} />}
            </View>
            <View style={[s.row, { flexDirection: flexRow(IS_RTL), gap: 4, marginTop: 1 }]}>
              <Ionicons name="person-outline" size={11} color={theme.colors.text.muted} />
              <UIText variant="caption" color="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>{rx.customerName}</UIText>
              {rx.doctor ? <UIText variant="caption" color="muted" numberOfLines={1}>· Dr. {rx.doctor}</UIText> : null}
            </View>
          </View>
          <View style={[s.statusPill, { backgroundColor: `${tone}17` }]}>
            <UIText variant="eyebrow" style={{ color: tone }}>{t(statusLabelKey)}</UIText>
          </View>
        </View>

        <View style={[s.footRow, { flexDirection: flexRow(IS_RTL), borderTopColor: theme.colors.border.default }]}>
          <View style={[s.row, { flexDirection: flexRow(IS_RTL), gap: 4 }]}>
            <Ionicons name="time-outline" size={12} color={isUrgent ? theme.colors.status.warning : theme.colors.text.muted} />
            <UIText variant="caption" style={{ color: isUrgent ? theme.colors.status.warning : theme.colors.text.muted }}>
              {isUrgent ? t("pharmacist.rxUrgent", "Overdue") : formatRxDate(rx.addedAt ?? rx.createdAt, locale)}
            </UIText>
          </View>
          <View style={[s.row, { flexDirection: flexRow(IS_RTL), gap: 4 }]}>
            <UIText variant="caption" color="muted">{t(source.labelKey, source.fallback)}</UIText>
            <Ionicons name={FORWARD_CHEVRON} size={13} color={theme.colors.text.muted} />
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

export function PrescriptionQueueScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { pagePad, isTablet } = useScreenLayout();
  const locale = i18n.language === "ar" ? "ar-EG" : "en-US";

  const [filter, setFilter] = useState<PrescriptionReviewStatus | "all">("pending_review");
  const [query, setQuery] = useState("");

  const rxQuery = useAllPrescriptions(filter === "all" ? undefined : filter);
  // Independent of the active filter tab — the hero always states how many
  // prescriptions are actually waiting on a decision, same framing Refills
  // and Workbench use for "what needs my attention right now". The
  // approved/rejected counts turn the hero into a real at-a-glance triage
  // summary instead of just restating whichever filter happens to be active.
  const pendingQuery = useAllPrescriptions("pending_review");
  const approvedQuery = useAllPrescriptions("approved");
  const rejectedQuery = useAllPrescriptions("rejected");
  const pendingCount = pendingQuery.data?.length ?? 0;
  const approvedCount = approvedQuery.data?.length ?? 0;
  const rejectedCount = rejectedQuery.data?.length ?? 0;

  const allItems = rxQuery.data ?? [];
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((rx) =>
      rx.name.toLowerCase().includes(q) ||
      (rx.rxNumber ?? "").toLowerCase().includes(q) ||
      rx.customerName.toLowerCase().includes(q),
    );
  }, [allItems, query]);

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] });
  };

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.hero, { paddingHorizontal: pagePad }]}
      >
        <View style={[s.heroTopRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <UIText variant="eyebrow" style={s.heroEyebrow}>{t("pharmacist.prescriptionsEyebrow", "Prescription Review")}</UIText>
            <UIText variant="screen-title" style={{ color: "#fff" }}>{t("pharmacist.prescriptionsTitle")}</UIText>
          </View>
          <Pressable
            onPress={() => router.push("/(pharmacist)/refills" as never)}
            accessibilityRole="button"
            accessibilityLabel={t("pharmacist.refillsTitle", "Refills")}
            style={s.heroIconWell}
          >
            <Ionicons name="repeat" size={20} color="#fff" />
          </Pressable>
        </View>
        <UIText variant="caption" style={s.heroSubtitle} numberOfLines={1}>
          {pendingCount > 0
            ? t("pharmacist.rxPendingCount", { count: pendingCount, defaultValue: "{{count}} awaiting your review" })
            : t("pharmacist.rxAllHandled", "All prescriptions are reviewed")}
        </UIText>

        <View style={[s.statRow, { flexDirection: flexRow(IS_RTL) }]}>
          <StatChip value={pendingCount} label={t("pharmacist.rxPending")} tone="#fff" />
          <StatChip value={approvedCount} label={t("pharmacist.rxApproved")} tone="#4ADE80" />
          <StatChip value={rejectedCount} label={t("pharmacist.rxRejected")} tone="#FCA5A5" />
        </View>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t("pharmacist.rxSearchPlaceholder", "Search by name, Rx number, or customer…")}
          prefixIcon={<Ionicons name="search-outline" size={16} color={theme.colors.text.muted} />}
          returnKeyType="search"
          containerStyle={[s.searchBar, theme.shadows[2]]}
        />
      </LinearGradient>

      <View style={[s.filterRow, { flexDirection: flexRow(IS_RTL), paddingHorizontal: pagePad }]}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.key} label={t(f.labelKey)} selected={filter === f.key} selectable onPress={() => setFilter(f.key)} />
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(rx) => rx.id}
        contentContainerStyle={[
          s.listContent,
          { paddingHorizontal: pagePad },
          isTablet && { maxWidth: 720, alignSelf: "center", width: "100%" },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={rxQuery.isFetching} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />}
        renderItem={({ item, index }) => (
          <RxCard rx={item} theme={theme} locale={locale} index={index} onPress={() => router.push(`/(pharmacist)/prescription/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          rxQuery.isLoading ? (
            <View style={s.empty}>
              <ActivityIndicator size="large" color={theme.colors.brand.primary} />
            </View>
          ) : rxQuery.isError ? (
            <PUIEmptyState
              illustration={<Ionicons name="cloud-offline-outline" size={32} color={theme.colors.text.muted} />}
              title={t("errors.generic", "Something went wrong")}
              subtitle={t("pharmacist.rxLoadErrorSubtitle", "Couldn't load prescriptions. Check your connection.")}
              action={{ label: t("pharmacist.retry", "Try Again"), onPress: () => void rxQuery.refetch() }}
            />
          ) : query.trim().length > 0 ? (
            <PUIEmptyState
              illustration={<Ionicons name="search-outline" size={32} color={theme.colors.text.muted} />}
              title={t("pharmacist.noMatchingResults", "No matching results")}
              subtitle={t("pharmacist.tryDifferentSearch", "Try a different search or clear filters.")}
            />
          ) : (
            <PUIEmptyState
              illustration={<Ionicons name="document-text-outline" size={32} color={theme.colors.text.muted} />}
              title={t("pharmacist.emptyRxTitle")}
              subtitle={t("pharmacist.emptyRxSubtitle")}
            />
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: 12, paddingBottom: 18, gap: 6 },
  heroTopRow: { alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroEyebrow: { color: "rgba(255,255,255,0.78)", letterSpacing: 1, marginBottom: 2 },
  heroIconWell: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", flexShrink: 0 },
  heroSubtitle: { color: "rgba(255,255,255,0.82)", marginTop: 2 },
  statRow: { gap: 8, marginTop: 12 },
  statChip: { flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.14)", gap: 1 },
  statChipValue: { fontSize: 17, fontWeight: "800" },
  statChipLabel: { color: "rgba(255,255,255,0.78)" },
  searchBar: { marginTop: 12 },
  filterRow: { gap: 8, paddingVertical: 12, flexWrap: "wrap" },
  listContent: { paddingBottom: 48 },
  empty: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
  row: { alignItems: "center" },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 10 },
  sourceIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, flexShrink: 0 },
  footRow: { alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "transparent" },
});
