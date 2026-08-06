/**
 * PrescriptionQueueScreen — pharmacist review queue for pending prescriptions.
 *
 * Shows a filterable list of prescriptions (pending / approved / rejected).
 * Tapping a row opens PrescriptionDetailScreen for review.
 */

import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useRouter }       from "expo-router";
import { Ionicons }        from "@expo/vector-icons";
import { useTranslation }  from "react-i18next";
import { useQueryClient }  from "@tanstack/react-query";

import { Screen, Text as UIText }  from "@/shared/ui";
import { kit }                     from "@/shared/kit";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";

import { useAllPrescriptions }     from "../hooks/usePharmacistQueries";
import { PharmacistScreenHeader }  from "../components/PharmacistScreenHeader";
import type { PrescriptionReviewStatus, PharmacistPrescription } from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const STATUS_FILTERS: { key: PrescriptionReviewStatus | "all"; labelKey: string }[] = [
  { key: "all",            labelKey: "pharmacist.rxAll"     },
  { key: "pending_review", labelKey: "pharmacist.rxPending" },
  { key: "approved",       labelKey: "pharmacist.rxApproved"},
  { key: "rejected",       labelKey: "pharmacist.rxRejected"},
];

function RxCard({ rx, onPress }: { rx: PharmacistPrescription; onPress: () => void }) {
  const { t } = useTranslation();

  const chipColor =
    rx.reviewStatus === "approved"
      ? kit.color.success
      : rx.reviewStatus === "rejected"
        ? kit.color.danger
        : kit.color.warn;
  const chipBg =
    rx.reviewStatus === "approved"
      ? kit.color.successTint
      : rx.reviewStatus === "rejected"
        ? kit.color.dangerTint
        : kit.color.warnTint;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.cardPressed]}
      accessibilityRole="button"
    >
      <View style={[s.cardHeader, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[s.statusDot, { backgroundColor: chipBg, borderColor: chipColor }]}>
          <UIText variant="eyebrow" style={{ color: chipColor }}>
            {t(`pharmacist.rx${rx.reviewStatus === "pending_review" ? "Pending" : rx.reviewStatus === "approved" ? "Approved" : "Rejected"}`)}
          </UIText>
        </View>
        <UIText variant="caption" color="secondary">
          {rx.submissionSource === "whatsapp" ? "WhatsApp" : rx.submissionSource === "scan" ? t("pharmacist.scan") : t("pharmacist.manual")}
        </UIText>
        <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.inkFaint} />
      </View>
      <UIText variant="card-title" style={{ textAlign: TEXT_START, marginTop: 8 }} numberOfLines={1}>
        {rx.name || "—"}
      </UIText>
      <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>
        {rx.customerName}
        {rx.doctor ? ` · Dr. ${rx.doctor}` : ""}
      </UIText>
      <UIText variant="caption" color="muted" style={{ textAlign: TEXT_START, marginTop: 4 }}>
        {new Date(rx.addedAt).toLocaleDateString()}
      </UIText>
    </Pressable>
  );
}

export function PrescriptionQueueScreen(): React.ReactElement {
  const { t }       = useTranslation();
  const router      = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<PrescriptionReviewStatus | "all">("pending_review");

  const rxQuery = useAllPrescriptions(
    filter === "all" ? undefined : filter,
  );

  const items = rxQuery.data ?? [];

  const onRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] });
  };

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader
        title={t("pharmacist.prescriptionsTitle")}
        subtitle={t("pharmacist.prescriptionsSubtitle", { count: items.length })}
      />

      {/* Filter tabs */}
      <View style={[s.filterRow, { flexDirection: flexRow(IS_RTL) }]}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[s.filterTab, filter === f.key && s.filterTabActive]}
            accessibilityRole="button"
          >
            <UIText
              variant="caption"
              style={{ color: filter === f.key ? kit.color.onAccent : kit.color.inkSoft }}
            >
              {t(f.labelKey)}
            </UIText>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(rx) => rx.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={rxQuery.isFetching}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
          />
        }
        renderItem={({ item }) => (
          <RxCard
            rx={item}
            onPress={() => router.push(`/(pharmacist)/prescription/${item.id}` as never)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          rxQuery.isLoading ? (
            <View style={s.empty}>
              <ActivityIndicator size="large" color={kit.color.accent} />
            </View>
          ) : (
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
                {t("pharmacist.emptyRxTitle")}
              </UIText>
            </View>
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  filterRow: {
    gap:               8,
    paddingHorizontal: kit.inset.screen,
    paddingVertical:   12,
    flexWrap:          "wrap",
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  filterTabActive: {
    backgroundColor: kit.color.accent,
    borderColor:     kit.color.accent,
  },
  listContent: {
    paddingHorizontal: kit.inset.screen,
    paddingBottom:     48,
  },
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    padding:         16,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            8,
  },
  statusDot: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      kit.radius.pill,
    borderWidth:       1,
  },
  empty: {
    alignItems:    "center",
    paddingTop:    60,
    paddingBottom: 40,
  },
});
