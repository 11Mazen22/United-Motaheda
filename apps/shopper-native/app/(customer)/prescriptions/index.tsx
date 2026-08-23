import { useDarkColors } from "@/hooks/useDarkColors";

import React, { useCallback, useMemo, useState } from "react";

import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import { kit, Button, SegmentedToggle, type SegmentOption } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

import { RxCard } from "@/shared/components/RxCard";

import { useAuth } from "@/features/auth";

import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON, BACK_CHEVRON } from "@/utils/layout";

import { usePrescriptions } from "@/features/prescriptions/hooks/usePrescriptions";

import { usePrescriptionsQuery } from "@/features/prescriptions/hooks/usePrescriptionsQuery";

import { sortActiveByStatus } from "@/features/prescriptions/lib/statusSort";

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

  icon:    IoniconsName;

  tint:    string;

  tintBg:  string;

  value:   number;

  label:   string;

  divider?: boolean;

}



function StatCell({ icon, tint, tintBg, value, label, divider }: StatCellProps): React.ReactElement {

  const { c } = useDarkColors();

  const s = React.useMemo(() => get_s(c), [c]);

  return (

    <View style={[s.statCell, divider && s.statCellDivider]}>

      <View style={[s.statIconWell, { backgroundColor: tintBg }]}> <Ionicons name={icon} size={14} color={tint} /> </View>

      <Text weight="black" style={s.statValue}>{value}</Text>

      <Text weight="bold" style={s.statLabel} numberOfLines={1}>{label}</Text>

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

  const { c } = useDarkColors();

  const s = React.useMemo(() => get_s(c), [c]);

  return (

    <View style={s.centered}>

      <View style={[s.emptyIcon, { backgroundColor: tintBg, borderColor: tint + "30" }]}> <Ionicons name={icon} size={34} color={tint} /> </View>

      <Text weight="black" style={s.emptyTitle}>{title}</Text>

      <Text style={s.emptyBody}>{body}</Text>

      <View style={s.emptyCta}>

        <Button variant="primary" full label={ctaLabel} icon={ctaIcon} onPress={onCta} />

      </View>

    </View>

  );

}



export default function Page(): React.ReactElement {

  const { c } = useDarkColors();

  const s = React.useMemo(() => get_s(c), [c]);

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

                  <Ionicons name="time-outline" size={14} color={c.inkFaint} />

                </View>

                <Text weight="bold" style={s.disclosureText}> {item.open

                  ? t("prescriptions.expiredHide")

                  : t("prescriptions.expiredShow", { count: item.count })} </Text>

                <View style={s.disclosureChevron}>

                  <Ionicons name={item.open ? "chevron-up" : FORWARD_CHEVRON} size={14} color={c.inkFaint} />

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

  }, [goToDetail, goToRefill, t, c.inkFaint, s.disclosure, s.disclosureChevron, s.disclosureIcon, s.disclosurePressed, s.disclosureRow, s.disclosureText, s.disclosureTouchable]);



  const keyExtractor = useCallback((item: ListItem) => item.kind === "disclosure" ? "__disclosure__" : item.rx.id, []);



  const header = (

    <View style={[s.header, { paddingTop: insets.top + 12 }]}> {

      canGoBack ? (

        <Pressable

          onPress={() => router.back()}

          hitSlop={10}

          accessibilityRole="button"

          accessibilityLabel={t("common.back")}

          style={s.backBtnTouchable}>

          {({ pressed }) => (

            <View style={[s.backBtn, pressed && s.backBtnPressed]}> <Ionicons name={BACK_CHEVRON} size={20} color={c.ink} /> </View>

          )}

        </Pressable>

      ) : (

        <View style={s.backBtn} />

      )

    }



      <Pressable

        onPress={goToAdd}

        accessibilityRole="button"

        accessibilityLabel={t("prescriptions.addTitle")}

        style={s.addPillTouchable}>

        {({ pressed }) => (

          <View style={[s.addPill, pressed && s.addPillPressed]}> <Ionicons name="add" size={14} color={c.accentDeep} style={IS_RTL ? { marginStart: 6 } : { marginEnd: 6 }} />

            <Text weight="black" style={s.addPillText}> {t("prescriptions.addShort")} </Text>

          </View>

        )}

      </Pressable>



      <View style={s.identityRow}>

        <View style={s.heroTile}> <Ionicons name="medkit" size={24} color={c.accentDeep} /> </View>

        <View style={s.identityText}>

          <Text weight="bold" style={s.eyebrow}> {t("prescriptions.listEyebrow")} </Text>

          <Text weight="black" style={s.title} accessibilityRole="header"> {t("prescriptions.listTitle")} </Text>

        </View>

      </View>

    </View>

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

          tint={c.danger}

          tintBg={c.dangerTint}

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

          tint={c.accentDeep}

          tintBg={c.accentTint}

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



      <View style={[s.statsBand, { flexDirection: flexRow(IS_RTL) }]}>

        <StatCell

          icon="alert-circle-outline"

          tint={c.warn}

          tintBg={c.warnTint}

          value={expiringCount}

          label={t("prescriptions.statExpiring")}

          divider

        />

        <StatCell

          icon="checkmark-circle-outline"

          tint={c.success}

          tintBg={c.successTint}

          value={readyCount}

          label={t("prescriptions.statReady")}

          divider

        />

        <StatCell

          icon="medkit-outline"

          tint={c.accentDeep}

          tintBg={c.accentTint}

          value={totalActive}

          label={t("prescriptions.statTotal")}

        />

      </View>



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

            <View style={s.filterEmptyIcon}> <Ionicons name="funnel-outline" size={22} color={c.inkFaint} /> </View>

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

            tintColor={c.accent}

            colors={[c.accent]}

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



function get_s(c: { canvas: string; surface: string; line: string; ink: string; inkSoft: string; inkFaint: string; accentDeep: string; accentTint: string; warn: string; warnTint: string; success: string; successTint: string; well: string; danger: string }) { return StyleSheet.create({

  screen: { flex: 1, backgroundColor: c.canvas },



  header: {

    paddingHorizontal: 20,

    paddingBottom:     20,

    gap:               18,

    backgroundColor:   c.surface,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: c.line,

    ...kit.shadow.raised,

  },

  navRow: {

    flexDirection:  flexRow(IS_RTL),

    alignItems:     "center",

    justifyContent: "space-between",

    minHeight:      38,

  },

  backBtnTouchable: {

    borderRadius: 14,

  },

  backBtn: {

    width:           38,

    height:          38,

    borderRadius:    14,

    backgroundColor: c.well,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

  },

  backBtnPressed: {

    opacity:   0.7,

    transform: [{ scale: 0.96 }],

  },

  addPillTouchable: {

    borderRadius: kit.radius.pill,

  },

  addPill: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    backgroundColor:   c.accentTint,

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

    color:              c.accentDeep,

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

    backgroundColor: c.accentTint,

    borderWidth:     1,

    borderColor:     c.line,

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

    color:              c.accentDeep,

    letterSpacing:      0.6,

    textTransform:      "uppercase",

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  title: {

    fontSize:           28,

    lineHeight:         34,

    color:              c.ink,

    letterSpacing:      -0.6,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },



  statsBand: {

    backgroundColor:   c.surface,

    borderBottomWidth: StyleSheet.hairlineWidth,

    borderBottomColor: c.line,

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

    borderEndColor: c.line,

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

    color:              c.ink,

    letterSpacing:      -0.4,

    includeFontPadding: false,

  },

  statLabel: {

    fontSize:           9,

    lineHeight:         13,

    color:              c.inkFaint,

    letterSpacing:      0.4,

    textTransform:      "uppercase",

    textAlign:          "center",

    includeFontPadding: false,

  },



  filterBar: {

    paddingHorizontal: 20,

    paddingTop:        14,

    paddingBottom:     2,

    backgroundColor:   c.canvas,

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

    backgroundColor: c.well,

    borderWidth:     1,

    borderColor:     c.line,

    alignItems:      "center",

    justifyContent:  "center",

  },

  filterEmptyText: {

    fontSize:           13,

    lineHeight:         19,

    color:              c.inkFaint,

    textAlign:          "center",

    includeFontPadding: false,

  },



  disclosureTouchable: {

    borderRadius: kit.radius.lg,

  },

  disclosure: {

    backgroundColor:   c.surface,

    borderRadius:      kit.radius.lg,

    borderWidth:       1,

    borderColor:       c.line,

    overflow:          "hidden",

  },

  disclosurePressed: {

    backgroundColor: c.well,

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

    backgroundColor: c.well,

    alignItems:      "center",

    justifyContent:  "center",

    flexShrink:      0,

  },

  disclosureText: {

    flex:               1,

    fontSize:           12,

    lineHeight:         18,

    color:              c.inkSoft,

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

    color:              c.ink,

    textAlign:          "center",

    letterSpacing:      -0.3,

    includeFontPadding: false,

  },

  emptyBody: {

    fontSize:           14,

    lineHeight:         22,

    color:              c.inkSoft,

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

    backgroundColor: c.surface,

    borderRadius:    kit.radius.lg,

    borderWidth:     1,

    borderColor:     c.line,

    overflow:        "hidden",

    ...kit.shadow.raised,

  },

  skeletonStripe: {

    height:          4,

    backgroundColor: c.well,

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

    backgroundColor: c.well,

    flexShrink:      0,

  },

  skeletonLine: {

    height:          12,

    borderRadius:    6,

    backgroundColor: c.well,

  },



  ctaBar: {

    position:          "absolute",

    start:             0,

    end:               0,

    bottom:            0,

    paddingHorizontal: 20,

    paddingTop:        12,

    backgroundColor:   c.surface,

    borderTopWidth:    StyleSheet.hairlineWidth,

    borderTopColor:    c.line,

  },

}); }
