/**
 * PrescriptionsList — the user's prescription roster.
 *
 * Redesign (2026 visual pass):
 *   • Unified header treatment matching AddRxEntry/AddRxManual:
 *     38pt back button + quick-add pill on the trailing edge, 56pt
 *     accent hero tile, 28pt black title at -0.6 letterSpacing.
 *   • Stats band: 3 cells with tinted icon wells, hairline dividers,
 *     uppercase 10pt labels in inkFaint, 22pt black metric.
 *   • Segmented filter chip strip (All / Ready / Refill / Expired)
 *     fully localized via t() — no IS_RTL ternary.
 *   • Disclosure row for expired rxs polished into a card-like surface.
 *   • Empty / error / loading states each get their own dedicated
 *     premium layout (no shared scrap).
 *   • Sticky bottom CTA respects safe-area + hairline top border.
 *   • All textAlign → textAlignStart(IS_RTL); chevrons via FORWARD_CHEVRON.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { kit, Button, SegmentedToggle, type SegmentOption } from "@/shared/kit";
import { Text } from "@/shared/ui";
import { RxCard } from "@/shared/components/RxCard";
import { useAuth } from "@/features/auth";
import {
  flexRow,
  isRtl,
  textAlignStart,
  FORWARD_CHEVRON,
  BACK_CHEVRON,
} from "@/utils/layout";
import { usePrescriptions } from "../hooks/usePrescriptions";
import { usePrescriptionsQuery } from "../hooks/usePrescriptionsQuery";
import { sortActiveByStatus } from "../lib/statusSort";
import type { Prescription } from "@/stores/prescriptionsStore";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface RxRow {
  kind: "rx";
  rx:   Prescription;
}
interface DisclosureRow {
  kind:  "disclosure";
  count: number;
  open:  boolean;
}
type ListItem = RxRow | DisclosureRow;

type RxFilter = "all" | "ready" | "refill" | "expired";

// ─── Screen ───────────────────────────────────────────────────────────────────

export function PrescriptionsList(): React.ReactElement {
  const { t }         = useTranslation();
  const router        = useRouter();
  const insets        = useSafeAreaInsets();
  const { user }      = useAuth();
  const all           = usePrescriptions();
  const { refetch, isRefetching, isLoading, isError } = usePrescriptionsQuery(user?.id);

  const [showExpired, setShowExpired] = useState(false);
  const [filter, setFilter]           = useState<RxFilter>("all");

  const { active, expired } = useMemo(() => {
    const expiredList = all.filter((p) => p.status === "expired");
    const activeList  = sortActiveByStatus(all.filter((p) => p.status !== "expired"));
    return { active: activeList, expired: expiredList };
  }, [all]);

  const expiringCount = useMemo(() => active.filter((rx) => rx.status === "expiring").length, [active]);
  const readyCount    = useMemo(() => active.filter((rx) => rx.status === "ready").length,    [active]);
  const totalActive   = active.length;

  const data = useMemo<ListItem[]>(() => {
    if (filter === "expired") {
      return expired.map((rx) => ({ kind: "rx", rx }));
    }
    const shown =
      filter === "ready"  ? active.filter((rx) => rx.status === "ready") :
      filter === "refill" ? active.filter((rx) => rx.status === "expiring") :
      active;

    const out: ListItem[] = shown.map((rx) => ({ kind: "rx", rx }));

    if (filter === "all" && expired.length > 0) {
      out.push({ kind: "disclosure", count: expired.length, open: showExpired });
      if (showExpired) {
        for (const rx of expired) out.push({ kind: "rx", rx });
      }
    }
    return out;
  }, [active, expired, showExpired, filter]);

  const hasExpired = expired.length > 0;
  const canGoBack  = router.canGoBack();

  const FILTER_OPTIONS: ReadonlyArray<SegmentOption<RxFilter>> = useMemo(() => [
    { value: "all",     label: t("prescriptions.filterAll") },
    { value: "ready",   label: t("prescriptions.filterReady") },
    { value: "refill",  label: t("prescriptions.filterRefill") },
    { value: "expired", label: t("prescriptions.filterExpired") },
  ], [t]);

  const goToAdd    = useCallback(() => router.push("/prescriptions/add" as never), [router]);
  const goToDetail = useCallback((rx: Prescription) => router.push(`/prescriptions/${rx.id}` as never), [router]);
  const goToRefill = useCallback((rx: Prescription) => router.push(`/prescriptions/${rx.id}/refill` as never), [router]);

  const renderItem = useCallback(({ item }: { item: ListItem }): React.ReactElement => {
    if (item.kind === "disclosure") {
      return (
        <Pressable
          onPress={() => setShowExpired((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: item.open }}
          accessibilityLabel={t("prescriptions.expiredDisclosure", { count: item.count })}
          style={({ pressed }) => [s.disclosure, pressed && s.disclosurePressed]}>
          <View style={[s.disclosureRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.disclosureIcon}>
              <Ionicons name="time-outline" size={14} color={kit.color.inkFaint} />
            </View>
            <Text weight="bold" style={s.disclosureText}>
              {item.open
                ? t("prescriptions.expiredHide")
                : t("prescriptions.expiredShow", { count: item.count })}
            </Text>
            <View style={s.disclosureChevron}>
              <Ionicons
                name={item.open ? "chevron-up" : FORWARD_CHEVRON}
                size={14}
                color={kit.color.inkFaint}
              />
            </View>
          </View>
        </Pressable>
      );
    }
    return (
      <RxCard
        prescription={item.rx}
        variant="list"
        onPress={goToDetail}
        onRefill={goToRefill}
      />
    );
  }, [goToDetail, goToRefill, t]);

  const keyExtractor = useCallback(
    (item: ListItem) => item.kind === "disclosure" ? "__disclosure__" : item.rx.id,
    [],
  );

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <View style={s.navRow}>
        {canGoBack ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
            <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
          </Pressable>
        ) : (
          <View style={s.backBtn} />
        )}

        {/* Quick-add pill on the trailing edge */}
        <Pressable
          onPress={goToAdd}
          accessibilityRole="button"
          accessibilityLabel={t("prescriptions.addTitle")}
          style={({ pressed }) => [s.addPill, pressed && s.addPillPressed]}>
          <Ionicons name="add" size={14} color={kit.color.accentDeep} />
          <Text weight="black" style={s.addPillText}>
            {t("prescriptions.addShort")}
          </Text>
        </Pressable>
      </View>

      <View style={s.identityRow}>
        <View style={s.heroTile}>
          <Ionicons name="medkit" size={24} color={kit.color.accentDeep} />
        </View>
        <View style={s.identityText}>
          <Text weight="bold" style={s.eyebrow}>
            {t("prescriptions.listEyebrow")}
          </Text>
          <Text weight="black" style={s.title} accessibilityRole="header">
            {t("prescriptions.listTitle")}
          </Text>
        </View>
      </View>
    </View>
  );

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={s.screen}>
        {header}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.skeletonCard}>
              <View style={s.skeletonStripe} />
              <View style={[s.skeletonBody, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.skeletonTile} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[s.skeletonLine, { width: "60%" }]} />
                  <View style={[s.skeletonLine, { width: "40%" }]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError && active.length === 0 && expired.length === 0) {
    return (
      <View style={s.screen}>
        {header}
        <CenteredState
          icon="cloud-offline-outline"
          tint={kit.color.danger}
          tintBg={kit.color.dangerTint}
          title={t("prescriptions.errorTitle")}
          body={t("prescriptions.errorBody")}
          ctaLabel={t("common.retry")}
          ctaIcon="refresh"
          onCta={refetch}
        />
      </View>
    );
  }

  // ── True empty state ────────────────────────────────────────────────────────
  if (active.length === 0 && expired.length === 0) {
    return (
      <View style={s.screen}>
        {header}
        <CenteredState
          icon="medkit-outline"
          tint={kit.color.accentDeep}
          tintBg={kit.color.accentTint}
          title={t("prescriptions.emptyTitle")}
          body={t("prescriptions.emptyBody")}
          ctaLabel={t("prescriptions.addTitle")}
          ctaIcon="add"
          onCta={goToAdd}
        />
      </View>
    );
  }

  // ── Main list ───────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      {header}

      {/* Stats band */}
      <View style={[s.statsBand, { flexDirection: flexRow(IS_RTL) }]}>
        <StatCell
          icon="alert-circle-outline"
          tint={kit.color.warn}
          tintBg={kit.color.warnTint}
          value={expiringCount}
          label={t("prescriptions.statExpiring")}
          divider
        />
        <StatCell
          icon="checkmark-circle-outline"
          tint={kit.color.success}
          tintBg={kit.color.successTint}
          value={readyCount}
          label={t("prescriptions.statReady")}
          divider
        />
        <StatCell
          icon="medkit-outline"
          tint={kit.color.accentDeep}
          tintBg={kit.color.accentTint}
          value={totalActive}
          label={t("prescriptions.statTotal")}
        />
      </View>

      {/* Filter bar — only when an expired roster exists */}
      {hasExpired && (
        <View style={s.filterBar}>
          <SegmentedToggle
            value={filter}
            onChange={setFilter}
            options={FILTER_OPTIONS}
            size="md"
          />
        </View>
      )}

      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          <View style={s.filterEmpty}>
            <View style={s.filterEmptyIcon}>
              <Ionicons name="funnel-outline" size={22} color={kit.color.inkFaint} />
            </View>
            <Text weight="bold" style={s.filterEmptyText}>
              {t("prescriptions.filterEmpty")}
            </Text>
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop:        14,
          paddingBottom:     insets.bottom + 96,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={kit.color.accent}
            colors={[kit.color.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Sticky CTA */}
      <View style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <Button
          variant="primary"
          full
          label={t("prescriptions.addTitle")}
          icon="add"
          onPress={goToAdd}
        />
      </View>
    </View>
  );
}

// ─── StatCell ────────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface StatCellProps {
  icon:    IoniconsName;
  tint:    string;
  tintBg:  string;
  value:   number;
  label:   string;
  divider?: boolean;
}

function StatCell({ icon, tint, tintBg, value, label, divider }: StatCellProps): React.ReactElement {
  return (
    <View style={[s.statCell, divider && s.statCellDivider]}>
      <View style={[s.statIconWell, { backgroundColor: tintBg }]}>
        <Ionicons name={icon} size={14} color={tint} />
      </View>
      <Text weight="black" style={s.statValue}>{value}</Text>
      <Text weight="bold" style={s.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── CenteredState (empty / error) ───────────────────────────────────────────

interface CenteredStateProps {
  icon:     IoniconsName;
  tint:     string;
  tintBg:   string;
  title:    string;
  body:     string;
  ctaLabel: string;
  ctaIcon:  IoniconsName;
  onCta:    () => void;
}

function CenteredState({
  icon, tint, tintBg, title, body, ctaLabel, ctaIcon, onCta,
}: CenteredStateProps): React.ReactElement {
  return (
    <View style={s.centered}>
      <View style={[s.emptyIcon, { backgroundColor: tintBg, borderColor: tint + "30" }]}>
        <Ionicons name={icon} size={34} color={tint} />
      </View>
      <Text weight="black" style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      <View style={s.emptyCta}>
        <Button variant="primary" label={ctaLabel} icon={ctaIcon} onPress={onCta} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    minHeight:      38,
  },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    14,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: {
    opacity:   0.7,
    transform: [{ scale: 0.96 }],
  },
  addPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       "rgba(14,126,116,0.18)",
  },
  addPillPressed: {
    opacity:   0.85,
    transform: [{ scale: 0.97 }],
  },
  addPillText: {
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  identityRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
  },
  heroTile: {
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  identityText: {
    flex: 1,
    gap:  2,
  },
  eyebrow: {
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.6,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontSize:           28,
    lineHeight:         34,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Stats band ──────────────────────────────────────────────────────────────
  statsBand: {
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  statCell: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             6,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  statCellDivider: {
    borderEndWidth: StyleSheet.hairlineWidth,
    borderEndColor: kit.color.line,
  },
  statIconWell: {
    width:          34,
    height:         34,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize:           22,
    lineHeight:         28,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  statLabel: {
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.inkFaint,
    letterSpacing:      0.4,
    textTransform:      "uppercase",
    textAlign:          "center",
    includeFontPadding: false,
  },

  // ── Filter bar ──────────────────────────────────────────────────────────────
  filterBar: {
    paddingHorizontal: 20,
    paddingTop:        14,
    paddingBottom:     2,
    backgroundColor:   kit.color.canvas,
  },
  filterEmpty: {
    alignItems:      "center",
    paddingTop:      48,
    gap:             12,
  },
  filterEmptyIcon: {
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  filterEmptyText: {
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    includeFontPadding: false,
  },

  // ── Disclosure row ──────────────────────────────────────────────────────────
  disclosure: {
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    overflow:          "hidden",
  },
  disclosurePressed: {
    backgroundColor: kit.color.well,
  },
  disclosureRow: {
    alignItems:        "center",
    gap:               10,
    paddingHorizontal: 14,
    paddingVertical:   14,
  },
  disclosureIcon: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  disclosureText: {
    flex:               1,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  disclosureChevron: {
    width:          20,
    height:         20,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  // ── Empty / error ───────────────────────────────────────────────────────────
  centered: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               14,
  },
  emptyIcon: {
    width:           88,
    height:          88,
    borderRadius:    28,
    borderWidth:     1,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  emptyTitle: {
    fontSize:           19,
    lineHeight:         26,
    color:              kit.color.ink,
    textAlign:          "center",
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  emptyBody: {
    fontSize:           14,
    lineHeight:         22,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    maxWidth:           320,
    includeFontPadding: false,
  },
  emptyCta: {
    marginTop: 12,
    minWidth:  220,
  },

  // ── Skeleton ────────────────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  skeletonStripe: {
    height:          4,
    backgroundColor: kit.color.well,
  },
  skeletonBody: {
    padding:    16,
    gap:        12,
    alignItems: "center",
  },
  skeletonTile: {
    width:           44,
    height:          44,
    borderRadius:    kit.radius.control,
    backgroundColor: kit.color.well,
    flexShrink:      0,
  },
  skeletonLine: {
    height:          12,
    borderRadius:    6,
    backgroundColor: kit.color.well,
  },

  // ── Sticky CTA ──────────────────────────────────────────────────────────────
  ctaBar: {
    position:          "absolute",
    start:             0,
    end:               0,
    bottom:            0,
    paddingHorizontal: 20,
    paddingTop:        12,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },
});
