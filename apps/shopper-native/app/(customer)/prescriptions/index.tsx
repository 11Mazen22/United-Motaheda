import { useTheme, type NativeTheme } from "@pharmacy/ui-native";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Button, SegmentedToggle, type SegmentOption } from "@pharmacy/ui-native";
import { Text } from "@pharmacy/ui-native";
import { RxCard } from "@/shared/components/RxCard";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { usePrescriptions } from "@/features/prescriptions/hooks/usePrescriptions";
import { usePrescriptionsQuery } from "@/features/prescriptions/hooks/usePrescriptionsQuery";
import { sortActiveByStatus } from "@/features/prescriptions/lib/statusSort";
import { PrescriptionsHeader } from "@/features/prescriptions/components/PrescriptionsHeader";
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

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface StatCellProps {
  icon:  IoniconsName;
  value: number;
  label: string;
}

function StatCell({ icon, value, label }: StatCellProps): React.ReactElement {
  const s = React.useMemo(() => get_glass(), []);
  return (
    <View style={s.cell}>
      <View style={s.iconWell}>
        <Ionicons name={icon} size={13} color="#fff" />
      </View>
      <Text weight="black" style={s.value}>{value}</Text>
      <Text weight="bold" style={s.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

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

function CenteredState({ icon, tint, tintBg, title, body, ctaLabel, ctaIcon, onCta }: CenteredStateProps): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
  return (
    <Animated.View entering={FadeInDown.duration(320).springify()} style={s.centered}>
      <View style={[s.emptyIcon, { backgroundColor: tintBg, borderColor: tint + "30" }]}> <Ionicons name={icon} size={34} color={tint} /> </View>
      <Text weight="black" style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      <View style={s.emptyCta}>
        <Button variant="primary" full label={ctaLabel} icon={ctaIcon} onPress={onCta} />
      </View>
    </Animated.View>
  );
}

export default function Page(): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
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

  const renderItem = useCallback(({ item, index }: { item: ListItem; index: number }): React.ReactElement => {
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
                <Text weight="bold" style={s.disclosureText}> {item.open
                  ? t("prescriptions.expiredHide")
                  : t("prescriptions.expiredShow", { count: item.count })} </Text>
                <View style={s.disclosureChevron}>
                  <Ionicons name={item.open ? "chevron-up" : FORWARD_CHEVRON} size={14} color={theme.colors.text.muted} />
                </View>
              </View>
            </View>
          )}
        </Pressable>
      );
    }
    return (
      <Animated.View entering={FadeInDown.duration(340).delay(Math.min(index, 6) * 45).springify()}>
        <RxCard
          prescription={item.rx}
          variant="list"
          onPress={goToDetail}
          onRefill={goToRefill}
        />
      </Animated.View>
    );
  }, [goToDetail, goToRefill, t, theme.colors.text.muted, s.disclosure, s.disclosureChevron, s.disclosureIcon, s.disclosurePressed, s.disclosureRow, s.disclosureText, s.disclosureTouchable]);

  const keyExtractor = useCallback((item: ListItem) => item.kind === "disclosure" ? "__disclosure__" : item.rx.id, []);

  const addPill = (
    <Pressable
      onPress={goToAdd}
      accessibilityRole="button"
      accessibilityLabel={t("prescriptions.addTitle")}
      style={s.addPillTouchable}>
      {({ pressed }) => (
        <View style={[s.addPill, pressed && s.addPillPressed]}> <Ionicons name="add" size={14} color="#fff" style={IS_RTL ? { marginStart: 6 } : { marginEnd: 6 }} />
          <Text weight="black" style={s.addPillText}> {t("prescriptions.addShort")} </Text>
        </View>
      )}
    </Pressable>
  );

  const header = (
    <PrescriptionsHeader
      insetsTop={insets.top}
      icon="medkit"
      eyebrow={t("prescriptions.listEyebrow")}
      title={t("prescriptions.listTitle")}
      onBack={canGoBack ? () => router.back() : undefined}
      trailing={addPill}
      statsBand={all.length > 0 ? (
        <View style={[s.statsBand, { flexDirection: flexRow(IS_RTL) }]}>
          <StatCell icon="alert-circle-outline" value={expiringCount} label={t("prescriptions.statExpiring")} />
          <StatCell icon="checkmark-circle-outline" value={readyCount} label={t("prescriptions.statReady")} />
          <StatCell icon="medkit-outline" value={totalActive} label={t("prescriptions.statTotal")} />
        </View>
      ) : undefined}
    />
  );

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

  return (
    <View style={s.screen}>
      {header}

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
            <View style={s.filterEmptyIcon}> <Ionicons name="funnel-outline" size={22} color={theme.colors.text.muted} /> </View>
            <Text weight="bold" style={s.filterEmptyText}> {t("prescriptions.filterEmpty")} </Text>
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

      <View onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)} style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
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

function get_glass() { return StyleSheet.create({
  cell: {
    flex:            1,
    minWidth:        0,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             4,
    paddingVertical: 14,
    borderRadius:    14,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  iconWell: {
    width:           28,
    height:          28,
    borderRadius:    9,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  value: {
    fontSize:           20,
    lineHeight:         26,
    color:              "#fff",
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  label: {
    fontSize:           9,
    lineHeight:         13,
    color:              "rgba(255,255,255,0.82)",
    letterSpacing:      0.4,
    textTransform:      "uppercase",
    textAlign:          "center",
    includeFontPadding: false,
  },
}); }

function get_s(theme: NativeTheme) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },

  addPillTouchable: {
    borderRadius: 9999,
  },
  addPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    backgroundColor:   "rgba(255,255,255,0.16)",
    borderRadius:      9999,
    paddingHorizontal: 14,
    paddingVertical:   9,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.24)",
  },
  addPillPressed: {
    opacity:   0.85,
    transform: [{ scale: 0.97 }],
  },
  addPillText: {
    fontSize:           12,
    lineHeight:         16,
    color:              "#fff",
    includeFontPadding: false,
  },

  statsBand: {
    gap: 10,
  },

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
  emptyCta: {
    width:     "100%",
    maxWidth:  280,
    marginTop: 12,
  },

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
}); }
