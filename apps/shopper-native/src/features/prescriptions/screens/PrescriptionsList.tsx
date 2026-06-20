/**
 * PrescriptionsList — the user's prescription roster. VIP 2026.
 *
 * Header: VIP inline header — 52×52 medkit icon tile + display title + eyebrow.
 * Stats strip: Expiring (warn) | Ready (success) | Total (accent).
 * Body:
 *   - Active RxCards sorted expiring → ready → active.
 *   - Expired section collapsed behind a disclosure row.
 *   - Empty state when no active rxs.
 * Sticky CTA: "إضافة وصفة" → /prescriptions/add.
 * Pull-to-refresh: usePrescriptionsQuery().refetch().
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
import { theme } from "@/shared/theme";
import { Text } from "@/shared/ui";
// Direct imports (not the barrel) to break the require cycle:
// shared/components/index → PharmacyBootstrap → features/prescriptions → here.
import { RxCard }    from "@/shared/components/RxCard";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, FORWARD_CHEVRON, BACK_CHEVRON } from "@/utils/layout";
import { usePrescriptions } from "../hooks/usePrescriptions";
import { usePrescriptionsQuery } from "../hooks/usePrescriptionsQuery";
import { sortActiveByStatus } from "../lib/statusSort";
import type { Prescription } from "@/stores/prescriptionsStore";

const IS_RTL = isRtl();

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

// ── Filter ───────────────────────────────────────────────────────────────────
type RxFilter = "all" | "ready" | "refill" | "expired";

const FILTER_OPTIONS: ReadonlyArray<SegmentOption<RxFilter>> = IS_RTL
  ? [
      { value: "all",     label: "الكل" },
      { value: "ready",   label: "جاهزة" },
      { value: "refill",  label: "تجديد" },
      { value: "expired", label: "منتهية" },
    ]
  : [
      { value: "all",     label: "All" },
      { value: "ready",   label: "Ready" },
      { value: "refill",  label: "Refill" },
      { value: "expired", label: "Expired" },
    ];

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
    const expired = all.filter((p) => p.status === "expired");
    const active  = sortActiveByStatus(all.filter((p) => p.status !== "expired"));
    return { active, expired };
  }, [all]);

  // Stats — always reflect the full roster, not the current filter
  const expiringCount = useMemo(() => active.filter((rx) => rx.status === "expiring").length, [active]);
  const readyCount    = useMemo(() => active.filter((rx) => rx.status === "ready").length,    [active]);
  const totalActive   = active.length;

  const data = useMemo<ListItem[]>(() => {
    // Expired-only view: show the expired roster directly, no disclosure.
    if (filter === "expired") {
      return expired.map((rx) => ({ kind: "rx", rx }));
    }

    // Active views — optionally narrowed by status.
    const shown =
      filter === "ready"  ? active.filter((rx) => rx.status === "ready") :
      filter === "refill" ? active.filter((rx) => rx.status === "expiring") :
      active;

    const out: ListItem[] = shown.map((rx) => ({ kind: "rx", rx }));

    // Expired disclosure only appears in the unfiltered "All" view.
    if (filter === "all" && expired.length > 0) {
      out.push({ kind: "disclosure", count: expired.length, open: showExpired });
      if (showExpired) {
        for (const rx of expired) out.push({ kind: "rx", rx });
      }
    }
    return out;
  }, [active, expired, showExpired, filter]);

  const hasExpired = expired.length > 0;

  const goToAdd    = useCallback(() => router.push("/prescriptions/add" as never), [router]);
  const goToDetail = useCallback((rx: Prescription) => router.push(`/prescriptions/${rx.id}` as never), [router]);
  const goToRefill = useCallback((rx: Prescription) => router.push(`/prescriptions/${rx.id}/refill` as never), [router]);

  const canGoBack = router.canGoBack();

  const renderItem = useCallback(({ item }: { item: ListItem }): React.ReactElement => {
    if (item.kind === "disclosure") {
      return (
        <Pressable
          onPress={() => setShowExpired((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: item.open }}
          accessibilityLabel={`عرض المنتهية (${item.count})`}
          style={[s.disclosureRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons
            name={item.open ? "chevron-down" : FORWARD_CHEVRON}
            size={14}
            color={kit.color.inkFaint}
          />
          <Text style={s.disclosureText}>
            {item.open ? "إخفاء المنتهية" : `عرض المنتهية (${item.count})`}
          </Text>
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
  }, [goToDetail, goToRefill]);

  const keyExtractor = useCallback(
    (item: ListItem) => item.kind === "disclosure" ? "__disclosure__" : item.rx.id,
    [],
  );

  // ── VIP header ──────────────────────────────────────────────────────────────
  const header = (
    <View style={[s.header, { paddingTop: insets.top + 14 }]}>
      <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
        {canGoBack ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={s.backBtn}>
            <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
          </Pressable>
        ) : (
          <View style={s.backBtn} />
        )}
        {/* Quick-add pill */}
        <Pressable
          onPress={goToAdd}
          accessibilityRole="button"
          accessibilityLabel="إضافة وصفة"
          style={[s.addPill, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="add" size={14} color={kit.color.accentDeep} />
          <Text style={s.addPillText}>إضافة</Text>
        </Pressable>
      </View>

      <View style={[s.identityRow, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={s.iconTile}>
          <Ionicons name="medkit" size={22} color={kit.color.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>إدارة الصحة</Text>
          <Text style={s.title} accessibilityRole="header">الوصفات الطبية</Text>
        </View>
      </View>
    </View>
  );

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={s.screen}>
        {header}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={s.skeletonCard}>
              <View style={[s.skeletonStripe, { backgroundColor: kit.color.well }]} />
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

  // ── Error state ──────────────────────────────────────────────────────────────
  if (isError && active.length === 0 && expired.length === 0) {
    return (
      <View style={s.screen}>
        {header}
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="cloud-offline-outline" size={30} color={kit.color.inkFaint} />
          </View>
          <Text style={s.emptyTitle}>تعذّر تحميل الوصفات</Text>
          <Text style={s.emptyBody}>
            حدث خطأ أثناء جلب وصفاتك. تحقق من الاتصال وأعد المحاولة.
          </Text>
          <Button
            variant="primary"
            label="إعادة المحاولة"
            icon="refresh"
            onPress={refetch}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
    );
  }

  // ── True empty state ─────────────────────────────────────────────────────────
  if (active.length === 0 && expired.length === 0) {
    return (
      <View style={s.screen}>
        {header}
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="medkit-outline" size={30} color={kit.color.inkFaint} />
          </View>
          <Text style={s.emptyTitle}>لا توجد وصفات طبية بعد</Text>
          <Text style={s.emptyBody}>
            أرسل وصفتك عبر واتساب وسيضيفها فريق الصيدلية إلى حسابك، أو أضفها برقم الوصفة.
          </Text>
          <Button
            variant="primary"
            label="إضافة وصفة"
            icon="add"
            onPress={goToAdd}
            style={{ marginTop: 8 }}
          />
        </View>
      </View>
    );
  }

  // ── Main list ────────────────────────────────────────────────────────────────
  return (
    <View style={s.screen}>
      {header}

      {/* Stats strip */}
      <View style={[s.statsBand, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[s.statCell, s.statCellBorder]}>
          <View style={[s.statIconWell, { backgroundColor: kit.color.warnTint }]}>
            <Ionicons name="alert-circle-outline" size={13} color={kit.color.warn} />
          </View>
          <Text style={s.statValue}>{expiringCount}</Text>
          <Text style={s.statLabel}>تنتهي قريباً</Text>
        </View>
        <View style={[s.statCell, s.statCellBorder]}>
          <View style={[s.statIconWell, { backgroundColor: kit.color.successTint }]}>
            <Ionicons name="checkmark-circle-outline" size={13} color={kit.color.success} />
          </View>
          <Text style={s.statValue}>{readyCount}</Text>
          <Text style={s.statLabel}>جاهزة للاستلام</Text>
        </View>
        <View style={s.statCell}>
          <View style={[s.statIconWell, { backgroundColor: kit.color.accentTint }]}>
            <Ionicons name="medkit-outline" size={13} color={kit.color.accentDeep} />
          </View>
          <Text style={s.statValue}>{totalActive}</Text>
          <Text style={s.statLabel}>إجمالي الوصفات</Text>
        </View>
      </View>

      {/* Filter bar — only when an expired roster exists to filter against */}
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
            <Text style={s.filterEmptyText}>
              {t("prescriptions.filterEmpty")}
            </Text>
          </View>
        }
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop:        16,
          paddingBottom:     insets.bottom + 80,
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
      <View style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <Button variant="primary" full label="إضافة وصفة" icon="add" onPress={goToAdd} />
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

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     18,
    gap:               16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width:  36,
    height: 36,
  },
  addPill: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  addPillText: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  identityRow: {
    alignItems: "center",
    gap:        14,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    textAlign:          "right",
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         36,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          "right",
    includeFontPadding: false,
  },

  // ── Stats band ────────────────────────────────────────────────────────────────
  statsBand: {
    backgroundColor: kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  statCell: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             5,
    paddingVertical: 14,
  },
  statCellBorder: {
    borderEndWidth: StyleSheet.hairlineWidth,
    borderEndColor: kit.color.lineStrong,
  },
  statIconWell: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    includeFontPadding: false,
  },

  // ── Filter bar ────────────────────────────────────────────────────────────────
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
    alignItems:      "center",
    justifyContent:  "center",
  },
  filterEmptyText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    includeFontPadding: false,
  },

  // ── Disclosure row ────────────────────────────────────────────────────────────
  disclosureRow: {
    alignItems:        "center",
    gap:               7,
    paddingVertical:   12,
    paddingHorizontal: 4,
  },
  disclosureText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Empty / error ─────────────────────────────────────────────────────────────
  centered: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               12,
  },
  emptyIcon: {
    width:           72,
    height:          72,
    borderRadius:    24,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  emptyTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           17,
    lineHeight:         25,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  emptyBody: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    maxWidth:           300,
    includeFontPadding: false,
  },

  // ── Skeleton ──────────────────────────────────────────────────────────────────
  skeletonCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
  },
  skeletonStripe: {
    height: 4,
  },
  skeletonBody: {
    padding: 16,
    gap:     12,
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

  // ── Sticky CTA ────────────────────────────────────────────────────────────────
  ctaBar: {
    position:          "absolute",
    left:              0,
    right:             0,
    bottom:            0,
    paddingHorizontal: 20,
    paddingTop:        12,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },
});
