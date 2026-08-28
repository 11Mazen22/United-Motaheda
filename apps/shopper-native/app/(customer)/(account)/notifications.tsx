import React, { useCallback, useMemo, useState } from "react";

import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";


import { PressableScale } from "@/shared/motion";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as Haptics from "expo-haptics";

import Animated, { FadeIn, FadeInDown, interpolate, useAnimatedStyle } from "react-native-reanimated";

import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";

import { useTranslation } from "react-i18next";

import { useAuth } from "@/features/auth";

import { useNotifications, type AppNotification, type NotifType } from "@/features/notifications";

import { useTheme, type NativeTheme, EmptyState, Skeleton } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";



const RTL = isRtl(), TA = textAlignStart(RTL);

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const getTypeConfig = (theme: NativeTheme): Record<NotifType, { icon: IconName; color: string; bg: string; labelKey: string }> => ({

  order: { icon: "bag-handle", color: theme.colors.brand.primary, bg: theme.colors.brand.primaryLight, labelKey: "notifications.typeOrder" },

  offer: { icon: "pricetag", color: theme.colors.status.warning, bg: `${theme.colors.status.warning}1A`, labelKey: "notifications.typeOffer" },

  health: { icon: "heart", color: theme.colors.status.error, bg: `${theme.colors.status.error}1A`, labelKey: "notifications.typeHealth" },

  system: { icon: "settings-outline", color: theme.colors.text.secondary, bg: theme.colors.canvas.surfaceMuted, labelKey: "notifications.typeSystem" },

});

type Filter = "all" | NotifType;

const FILTERS: { key: Filter; labelKey: string }[] = [

  { key: "all", labelKey: "notifications.filterAll" }, { key: "order", labelKey: "notifications.typeOrder" },

  { key: "offer", labelKey: "notifications.typeOffer" }, { key: "health", labelKey: "notifications.typeHealth" }, { key: "system", labelKey: "notifications.typeSystem" },

];



function timeAgo(dateStr: string, t: (k: string, opts?: Record<string, unknown>) => string): string {

  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);

  if (diff < 60) return t("notifications.timeNow");

  if (diff < 3600) { const m = Math.floor(diff / 60); return m === 1 ? t("notifications.timeMinuteAgo") : t("notifications.timeMinutesAgo", { count: m }); }

  if (diff < 86400) { const h = Math.floor(diff / 3600); return h === 1 ? t("notifications.timeHourAgo") : t("notifications.timeHoursAgo", { count: h }); }

  if (diff < 172800) return t("notifications.timeYesterday");

  if (diff < 604800) { const d = Math.floor(diff / 86400); return d === 1 ? t("notifications.timeDayAgo") : t("notifications.timeDaysAgo", { count: d }); }

  const w = Math.floor(diff / 604800);

  return w === 1 ? t("notifications.timeWeekAgo") : t("notifications.timeWeeksAgo", { count: w });

}



interface Section { key: "today" | "yesterday" | "week" | "earlier"; title: string; data: AppNotification[]; }



function groupByDate(items: AppNotification[], t: (k: string, opts?: Record<string, unknown>) => string): Section[] {

  const start = (off: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - off); return d.getTime(); };

  const today = start(0), yest = start(1), week = start(7);

  const b: Record<string, AppNotification[]> = { today: [], yesterday: [], week: [], earlier: [] };

  for (const item of items) {

    const t0 = new Date(item.createdAt).getTime();

    if (t0 >= today) b.today.push(item);

    else if (t0 >= yest) b.yesterday.push(item);

    else if (t0 >= week) b.week.push(item);

    else b.earlier.push(item);

  }

  const labels: Record<string, string> = { today: t("notifications.sectionToday"), yesterday: t("notifications.sectionYesterday"), week: t("notifications.sectionThisWeek"), earlier: t("notifications.sectionEarlier") };

  return Object.keys(b).filter(k => b[k].length > 0).map(k => ({ key: k as Section["key"], title: labels[k], data: b[k] }));

}



function SkeletonView({ bottom, styles: n }: { bottom: number; styles: ReturnType<typeof getStyles> }) {

  return <ScrollView contentContainerStyle={{ paddingBottom: bottom + 40, paddingTop: 14 }} showsVerticalScrollIndicator={false}>

    {Array.from({ length: 8 }).map((_, i) => <View key={i} style={n.card}>

      <Skeleton width={46} height={46} borderRadius={14} />

      <View style={{ flex: 1, gap: 10 }}>

        <View style={{ flexDirection: flexRow(RTL), alignItems: "center", gap: 10 }}><Skeleton width="62%" height={12} borderRadius={6} /><Skeleton width={64} height={10} borderRadius={5} /></View>

        <Skeleton width="92%" height={11} borderRadius={6} /><Skeleton width="78%" height={11} borderRadius={6} /><Skeleton width={90} height={18} borderRadius={9} />

      </View>

    </View>)}

  </ScrollView>;

}



function DeleteAction({ progress, onPress, styles: n }: { progress: { value: number }; onPress: () => void; styles: ReturnType<typeof getStyles> }) {

  const { t } = useTranslation();

  const style = useAnimatedStyle(() => ({

    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1], "clamp") }],

    opacity: interpolate(progress.value, [0, 1], [0, 1], "clamp"),

  }));

  return <View style={n.delWrap}><Animated.View style={style}><Pressable onPress={onPress} style={n.delBtn} accessibilityRole="button" accessibilityLabel={t("notifications.deleteAction")}>

    <Ionicons name="trash-outline" size={20} color="#fff" />

  </Pressable></Animated.View></View>;

}



const NotifRow = React.memo(function NotifRow({ item, onPress, onDelete, theme, styles: n, typeCfg }: { item: AppNotification; onPress: () => void; onDelete: () => void; theme: NativeTheme; styles: ReturnType<typeof getStyles>; typeCfg: ReturnType<typeof getTypeConfig> }) {

  const { t } = useTranslation();

  const cfg = typeCfg[item.type] ?? typeCfg.system;

  const handleDelete = useCallback(() => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); onDelete(); }, [onDelete]);

  const renderAction = useCallback((p: { value: number }) => <DeleteAction progress={p} onPress={handleDelete} styles={n} />, [handleDelete, n]);



  return <ReanimatedSwipeable friction={2} rightThreshold={40} overshootRight={false} overshootLeft={false}

    renderRightActions={RTL ? undefined : renderAction} renderLeftActions={RTL ? renderAction : undefined}>

    <PressableScale onPress={onPress} scaleTo={0.985} hitSlop={6} android_ripple={{ color: theme.colors.canvas.surfaceMuted }} accessibilityRole="button"

      accessibilityLabel={`${item.title}. ${item.body}`} accessibilityState={{ selected: !item.isRead }}

      style={[n.card, !item.isRead && n.unreadCard, item.isRead && n.read]}>

      <View style={[n.icon, { backgroundColor: cfg.bg, borderColor: `${cfg.color}20` }]}> <Ionicons name={cfg.icon} size={18} color={cfg.color} /> </View>

      <View style={n.content}>

        <View style={[n.titleRow, { flexDirection: flexRow(RTL) }]}> 

          <UIText style={[n.title, !item.isRead && n.titleU, { textAlign: TA }]} numberOfLines={1}>{item.title}</UIText>

          <UIText style={n.time}>{timeAgo(item.createdAt, t)}</UIText>

        </View>

        <UIText style={[n.body, { textAlign: TA }]} numberOfLines={2}>{item.body}</UIText>

        <View style={[n.typePill, { backgroundColor: cfg.bg, flexDirection: flexRow(RTL) }]}> 

          <View style={[n.typeDot, { backgroundColor: cfg.color }]} />

          <UIText style={[n.typeTxt, { color: cfg.color }]}>{t(cfg.labelKey)}</UIText>

        </View>

      </View>

    </PressableScale>

  </ReanimatedSwipeable>;

});



export default function NotificationsScreen() {

  const { theme } = useTheme();

  const n = useMemo(() => getStyles(theme), [theme]);

  const typeCfg = useMemo(() => getTypeConfig(theme), [theme]);

  const router = useRouter(), insets = useSafeAreaInsets(), { t } = useTranslation();

  const { user } = useAuth();

  const { items: notifications, unreadCount, isLoading: loading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch, markRead, markAllRead, dismiss } = useNotifications(user?.id);

  const [filter, setFilter] = useState<Filter>("all");



  const filtered = useMemo(() => filter === "all" ? notifications : notifications.filter(n => n.type === filter), [notifications, filter]);

  const sections = useMemo(() => groupByDate(filtered, t), [filtered, t]);



  const markAll = useCallback(() => { if (!user?.id) return; if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); markAllRead(); }, [user?.id, markAllRead]);

  const onPress = useCallback((item: AppNotification) => { if (!item.isRead) markRead(item.id); if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); if (item.actionUrl) router.push(item.actionUrl as never); }, [markRead, router]);

  const onEnd = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }, [hasNextPage, isFetchingNextPage, fetchNextPage]);



  return <View style={n.screen}>

    <Animated.View entering={FadeIn.duration(240)} style={[n.header, { paddingTop: insets.top + 10 }]}> 

      <View style={[n.hTop, { flexDirection: flexRow(RTL) }]}> 

        <Pressable onPress={() => router.back()} style={n.back} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.back")}>

          <Ionicons name={BACK_CHEVRON} size={18} color={theme.colors.text.secondary} />

        </Pressable>

        <View style={n.tile}><Ionicons name="notifications-outline" size={22} color={theme.colors.brand.primary} /></View>

        <View style={{ flex: 1, minWidth: 0 }}>

          <UIText style={[n.hTitle, { textAlign: TA }]}>{t("notifications.title")}</UIText>

          {unreadCount > 0 && <Animated.View entering={FadeIn.duration(200)} style={[n.unread, { flexDirection: flexRow(RTL) }]}> 

            <View style={n.dot} /><UIText style={n.unreadT}>{t("notifications.newBadge", { count: unreadCount })}</UIText>

          </Animated.View>}

        </View>

        <Pressable onPress={() => router.push("/notification-preferences")} style={n.setting} hitSlop={6} accessibilityRole="button">

          <Ionicons name="settings-outline" size={17} color={theme.colors.text.secondary} />

        </Pressable>

      </View>



      <View style={[n.filterBar, { flexDirection: flexRow(RTL) }]}> 

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[n.filterRow, { flexDirection: flexRow(RTL) }]}>{

          FILTERS.map(f => { const active = filter === f.key; return <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="button" accessibilityState={{ selected: active }} style={[n.chip, active && n.chipA]}> 

            <UIText style={[n.chipT, active && n.chipTA]}> {t(f.labelKey)} </UIText>

          </Pressable>; })}

        </ScrollView>

        {unreadCount > 0 && <Pressable onPress={markAll} hitSlop={8} accessibilityRole="button"><UIText style={n.markAll}>{t("notifications.markAll")}</UIText></Pressable>}

      </View>

    </Animated.View>



    {loading && notifications.length === 0 ? <SkeletonView bottom={insets.bottom} styles={n} />

      : isError && notifications.length === 0 ? <View style={{ paddingTop: 60 }}><EmptyState illustrationName="offline" title={t("errors.network").split(".")[0]} subtitle={t("errors.network")} action={{ label: t("common.retry"), onPress: () => refetch() }} /></View>

      : <SectionList sections={sections} keyExtractor={i => i.id} renderItem={({ item, index }) => <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(200)}><NotifRow item={item} onPress={() => onPress(item)} onDelete={() => dismiss(item.id)} theme={theme} styles={n} typeCfg={typeCfg} /></Animated.View>}

        renderSectionHeader={({ section }) => <View style={n.secHdr}><UIText style={[n.secHdrT, { textAlign: TA }]}>{section.title}</UIText></View>}

        stickySectionHeadersEnabled={false} contentContainerStyle={[n.list, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}

        ItemSeparatorComponent={() => <View style={{ height: 10 }} />} onEndReached={onEnd} onEndReachedThreshold={0.5}

        maxToRenderPerBatch={12} initialNumToRender={10} windowSize={7}

        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => refetch()} tintColor={theme.colors.brand.primary} />}

        ListFooterComponent={isFetchingNextPage ? <View style={{ paddingVertical: 16 }}><ActivityIndicator color={theme.colors.brand.primary} /></View> : null}

        ListEmptyComponent={<View style={{ paddingTop: 60 }}><EmptyState icon="notifications-off-outline" title={t("notifications.empty")} subtitle={filter !== "all" ? t("notifications.emptyFiltered") : undefined} action={filter !== "all" ? { label: t("notifications.filterAll"), onPress: () => setFilter("all") } : undefined} /></View>}

      />}

  </View>;

}



function getStyles(theme: NativeTheme) {

  return StyleSheet.create({

  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },

  header: { paddingHorizontal: 16, paddingBottom: 14, gap: 12, backgroundColor: theme.colors.canvas.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default, ...theme.shadows[1] },

  hTop: { alignItems: "center", gap: 12 },

  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.canvas.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1], flexShrink: 0 },

  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default, alignItems: "center", justifyContent: "center", flexShrink: 0 },

  hTitle: { fontFamily: legacyTheme.fonts.black, fontSize: 18, letterSpacing: -0.4, color: theme.colors.text.primary, textAlign: TA, includeFontPadding: false },

  unread: { alignItems: "center", gap: 5, marginTop: 2 },

  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.brand.primary, flexShrink: 0 },

  unreadT: { fontSize: 10, fontFamily: legacyTheme.fonts.bold, color: theme.colors.brand.primary, includeFontPadding: false },

  setting: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.canvas.surfaceMuted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.colors.border.default, flexShrink: 0 },

  filterBar: { alignItems: "center", gap: 8 },

  filterRow: { gap: 6, paddingEnd: 4 },

  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default },

  chipA: { backgroundColor: theme.colors.pharmacy.navy, borderColor: theme.colors.pharmacy.navy },

  chipT: { fontSize: 10.5, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.secondary, includeFontPadding: false },

  chipTA: { color: "#fff", fontFamily: legacyTheme.fonts.black },

  markAll: { fontSize: 11, fontFamily: legacyTheme.fonts.bold, color: theme.colors.brand.primary, includeFontPadding: false, flexShrink: 0 },



  list: { paddingHorizontal: 16, paddingTop: 12 },

  secHdr: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },

  secHdrT: { fontSize: 11, fontFamily: legacyTheme.fonts.black, letterSpacing: 0.4, textTransform: "uppercase", color: theme.colors.text.muted, includeFontPadding: false },

  delWrap: { width: 72, alignItems: "center", justifyContent: "center" },

  delBtn: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.status.error, alignItems: "center", justifyContent: "center" },



  card: { flexDirection: flexRow(RTL), alignItems: "flex-start", gap: 14, paddingHorizontal: 16, paddingVertical: 16, backgroundColor: theme.colors.canvas.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1] },

  unreadCard: { backgroundColor: theme.colors.brand.primaryLight, borderColor: `${theme.colors.brand.primary}22`, borderStartWidth: 3, borderStartColor: theme.colors.brand.primary },

  read: { backgroundColor: theme.colors.canvas.surface },

  icon: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0, borderWidth: 1 },

  content: { flex: 1, minWidth: 0, gap: 5 },

  titleRow: { alignItems: "center", justifyContent: "space-between", gap: 8 },

  title: { flex: 1, minWidth: 0, fontSize: 13.5, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.secondary, includeFontPadding: false },

  titleU: { fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary },

  time: { fontSize: 10, fontFamily: legacyTheme.fonts.semibold, color: theme.colors.text.muted, includeFontPadding: false, writingDirection: "ltr", fontVariant: ["tabular-nums"] },

  body: { fontSize: 12.5, fontFamily: legacyTheme.fonts.regular, color: theme.colors.text.secondary, lineHeight: 19, includeFontPadding: false },

  typePill: { alignSelf: "flex-start", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 3, borderWidth: 1, borderColor: "rgba(0,0,0,0.04)" },

  typeDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.8 },

  typeTxt: { fontSize: 9, fontFamily: legacyTheme.fonts.bold, includeFontPadding: false },

  });

}
