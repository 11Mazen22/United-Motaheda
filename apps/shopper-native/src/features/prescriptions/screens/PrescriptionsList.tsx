import { defaultTheme as theme } from "@pharmacy/ui-native";
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
import { Button, SegmentedToggle, type SegmentOption } from "@pharmacy/ui-native";
import { Text } from "@pharmacy/ui-native";
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
  const [ctaHeight, setCtaHeight]     = useState(96);

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
          style={s.disclosureTouchable}>
          {({ pressed }) => (
            <View style={[s.disclosure, pressed && s.disclosurePressed]}>
              <View style={[s.disclosureRow, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.disclosureIcon}>
                  <Ionicons name="time-outline" size={14} color={theme.colors.text.muted} />
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
                    color={theme.colors.text.muted}
                  />
                </View>
              </View>
            </View>
          )}
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
            style={s.backBtnTouchable}>
            {({ pressed }) => (
              <View style={[s.backBtn, pressed && s.backBtnPressed]}>
                <Ionicons name={BACK_CHEVRON} size={20} color={theme.colors.text.primary} />
              </View>
            )}
          </Pressable>
        ) : (
          <View style={s.backBtn} />
        )}

        {/* Quick-add pill on the trailing edge */}
        <Pressable
          onPress={goToAdd}
          accessibilityRole="button"
          accessibilityLabel={t("prescriptions.addTitle")}
          style={s.addPillTouchable}>
          {({ pressed }) => (
            <View style={[s.addPill, pressed && s.addPillPressed]}>
              <Ionicons name="add" size={14} color={theme.colors.brand.primary} style={IS_RTL ? { marginStart: 6 } : { marginEnd: 6 }} />
              <Text weight="black" style={s.addPillText}>
                {t("prescriptions.addShort")}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={s.identityRow}>
        <View style={s.heroTile}>
          <Ionicons name="medkit" size={24} color={theme.colors.brand.primary} />
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
          tint={theme.colors.status.error}
          tintBg={`${theme.colors.status.error}1A`}
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
          tint={theme.colors.brand.primary}
          tintBg={theme.colors.brand.primaryLight}
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
          tint={theme.colors.status.warning}
          tintBg={`${theme.colors.status.warning}1A`}
          value={expiringCount}
          label={t("prescriptions.statExpiring")}
          divider
        />
        <StatCell
          icon="checkmark-circle-outline"
          tint={theme.colors.status.success}
          tintBg={`${theme.colors.status.success}1A`}
          value={readyCount}
          label={t("prescriptions.statReady")}
          divider
        />
        <StatCell
          icon="medkit-outline"
          tint={theme.colors.brand.primary}
          tintBg={theme.colors.brand.primaryLight}
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
              <Ionicons name="funnel-outline" size={22} color={theme.colors.text.muted} />
            </View>
            <Text weight="bold" style={s.filterEmptyText}>
              {t("prescriptions.filterEmpty")}
            </Text>
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop:        14,
          paddingBottom:     ctaHeight + 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.brand.primary}
            colors={[theme.colors.brand.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Sticky CTA */}
      <View
        onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)}
        style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
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
        <Button variant="primary" full label={ctaLabel} icon={ctaIcon} onPress={onCta} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: theme.colors.canvas.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
    ...theme.shadows[1],
  },
  navRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    minHeight:      38,
  },
  // Bare touchables: a raw Pressable's own function-computed `style` has
  // proven unreliable in this app's RN/Fabric setup — observed losing
  // sizing/background/border entirely in some cases, row layout collapsing
  // to a column in others. Visual styling always lives on an inner View.
  backBtnTouchable: {
    borderRadius: 14,
  },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    14,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: {
    opacity:   0.7,
    transform: [{ scale: 0.96 }],
  },
  addPillTouchable: {
    borderRadius: 9999,
  },
  addPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    backgroundColor:   theme.colors.brand.primaryLight,
    borderRadius:      9999,
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
    color:              theme.colors.brand.primary,
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
    backgroundColor: theme.colors.brand.primaryLight,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
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
    color:              theme.colors.brand.primary,
    letterSpacing:      0.6,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontSize:           28,
    lineHeight:         34,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Stats band ──────────────────────────────────────────────────────────────
  statsBand: {
    backgroundColor:   theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
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
    borderEndColor: theme.colors.border.default,
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
    color:              theme.colors.text.primary,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  statLabel: {
    fontSize:           9,
    lineHeight:         13,
    color:              theme.colors.text.muted,
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
    backgroundColor:   theme.colors.canvas.background,
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
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    alignItems:      "center",
    justifyContent:  "center",
  },
  filterEmptyText: {
    fontSize:           13,
    lineHeight:         19,
    color:              theme.colors.text.muted,
    textAlign:          "center",
    includeFontPadding: false,
  },

  // ── Disclosure row ──────────────────────────────────────────────────────────
  disclosureTouchable: {
    borderRadius: 12,
  },
  disclosure: {
    backgroundColor:   theme.colors.canvas.surface,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    overflow:          "hidden",
  },
  disclosurePressed: {
    backgroundColor: theme.colors.canvas.surfaceMuted,
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
    backgroundColor: theme.colors.canvas.surfaceMuted,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  disclosureText: {
    flex:               1,
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.text.secondary,
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
    color:              theme.colors.text.primary,
    textAlign:          "center",
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  emptyBody: {
    fontSize:           14,
    lineHeight:         22,
    color:              theme.colors.text.secondary,
    textAlign:          "center",
    maxWidth:           320,
    includeFontPadding: false,
  },
  // `full` Button stretches to fill this wrapper — bounded width (not just
  // minWidth) so the button doesn't hug one edge inside an oversized box.
  // That mismatch (minWidth without a matching maxWidth, alongside a
  // non-`full` Button's alignSelf:"flex-start") was the "shifted left" bug.
  emptyCta: {
    width:     "100%",
    maxWidth:  280,
    marginTop: 12,
  },

  // ── Skeleton ────────────────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: theme.colors.canvas.surface,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    overflow:        "hidden",
    ...theme.shadows[1],
  },
  skeletonStripe: {
    height:          4,
    backgroundColor: theme.colors.canvas.surfaceMuted,
  },
  skeletonBody: {
    padding:    16,
    gap:        12,
    alignItems: "center",
  },
  skeletonTile: {
    width:           44,
    height:          44,
    borderRadius:    10,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    flexShrink:      0,
  },
  skeletonLine: {
    height:          12,
    borderRadius:    6,
    backgroundColor: theme.colors.canvas.surfaceMuted,
  },

  // ── Sticky CTA ──────────────────────────────────────────────────────────────
  ctaBar: {
    position:          "absolute",
    start:             0,
    end:               0,
    bottom:            0,
    paddingHorizontal: 20,
    paddingTop:        12,
    backgroundColor:   theme.colors.canvas.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    theme.colors.border.default,
  },
});
