import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { kit } from "@pharmacy/ui-native";
import { PressableScale } from "@/shared/motion";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth";
import { useNotifications, type AppNotification, type NotifType } from "@/features/notifications";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDarkColors } from "@/hooks/useDarkColors";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Type config — all kit tokens ────────────────────────────────────────────
const TYPE_CONFIG: Record<NotifType, { icon: IoniconsName; color: string; bg: string; labelKey: string }> = {
  order:  { icon: "bag-handle",       color: c.accentDeep,  bg: c.accentTint,        labelKey: "notifications.typeOrder"  },
  offer:  { icon: "pricetag",         color: c.warn,         bg: c.warnTint,          labelKey: "notifications.typeOffer"  },
  health: { icon: "heart",            color: c.danger,       bg: c.dangerTint,        labelKey: "notifications.typeHealth" },
  system: { icon: "settings-outline", color: c.inkSoft,     bg: c.well,               labelKey: "notifications.typeSystem" },
};

type Filter = "all" | NotifType;

const FILTER_CONFIGS: { key: Filter; labelKey: string }[] = [
  { key: "all",    labelKey: "notifications.filterAll"  },
  { key: "order",  labelKey: "notifications.typeOrder"  },
  { key: "offer",  labelKey: "notifications.typeOffer"  },
  { key: "health", labelKey: "notifications.typeHealth" },
  { key: "system", labelKey: "notifications.typeSystem" },
];

// ─── Time ago ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return t("notifications.timeNow");
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return m === 1 ? t("notifications.timeMinuteAgo") : t("notifications.timeMinutesAgo", { count: m });
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return h === 1 ? t("notifications.timeHourAgo") : t("notifications.timeHoursAgo", { count: h });
  }
  if (diff < 172800) return t("notifications.timeYesterday");
  if (diff < 604800) {
    const d = Math.floor(diff / 86400);
    return t("notifications.timeDaysAgo", { count: d });
  }
  const w = Math.floor(diff / 604800);
  return w === 1 ? t("notifications.timeWeekAgo") : t("notifications.timeWeeksAgo", { count: w });
}

// ─── Date grouping ────────────────────────────────────────────────────────────
interface NotifSection {
  key:   "today" | "yesterday" | "week" | "earlier";
  title: string;
  data:  AppNotification[];
}

function groupByDate(
  items: AppNotification[],
  t: (k: string) => string,
): NotifSection[] {
  const startOfDay  = (offset: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    return d.getTime();
  };
  const todayStart     = startOfDay(0);
  const yesterdayStart = startOfDay(1);
  const weekStart      = startOfDay(7);

  const buckets: Record<NotifSection["key"], AppNotification[]> = {
    today: [], yesterday: [], week: [], earlier: [],
  };
  for (const item of items) {
    const t0 = new Date(item.createdAt).getTime();
    if (t0 >= todayStart)          buckets.today.push(item);
    else if (t0 >= yesterdayStart) buckets.yesterday.push(item);
    else if (t0 >= weekStart)      buckets.week.push(item);
    else                           buckets.earlier.push(item);
  }

  const labels: Record<NotifSection["key"], string> = {
    today:     t("notifications.sectionToday"),
    yesterday: t("notifications.sectionYesterday"),
    week:      t("notifications.sectionThisWeek"),
    earlier:   t("notifications.sectionEarlier"),
  };

  return (Object.keys(buckets) as NotifSection["key"][])
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, title: labels[key], data: buckets[key] }));
}

// ─── Skeleton list ────────────────────────────────────────────────────────────
function NotificationsSkeleton({ insetsBottom }: { insetsBottom: number }) {
  const { c } = useDarkColors();

  return (
    <ScrollView
      contentContainerStyle={[
        s.listContent,
        { paddingBottom: insetsBottom + 40, paddingTop: 14 },
      ]}
      showsVerticalScrollIndicator={false}>
      {Array.from({ length: 8 }).map((_, i) => (
        <View key={i} style={s.notifCard}>
          <Skeleton width={46} height={46} radius={14} />
          <View style={{ flex: 1, gap: 10 }}>
            <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10 }}>
              <Skeleton width="62%" height={12} radius={6} />
              <Skeleton width={64} height={10} radius={5} />
            </View>
            <Skeleton width="92%" height={11} radius={6} />
            <Skeleton width="78%" height={11} radius={6} />
            <Skeleton width={90} height={18} radius={9} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// ─── Swipe-to-delete action ───────────────────────────────────────────────────
function DeleteAction({
  progress, onPress,
}: { progress: SharedValue<number>; onPress: () => void }) {
  const { t } = useTranslation();
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.7, 1], "clamp") }],
    opacity:   interpolate(progress.value, [0, 1], [0, 1], "clamp"),
  }));
  return (
    <View style={s.deleteActionWrap}>
      <Animated.View style={style}>
        <Pressable
          onPress={onPress}
          style={s.deleteActionBtn}
          accessibilityRole="button"
          accessibilityLabel={t("notifications.deleteAction")}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Notification row ─────────────────────────────────────────────────────────
const NotificationRow = React.memo(function NotificationRow({
  item, onPress, onDelete,
}: { item: AppNotification; onPress: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  const cfg   = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.system;

  const card = (
    <PressableScale
      onPress={onPress}
      scaleTo={0.985}
      hitSlop={6}
      android_ripple={{ color: c.well }}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      accessibilityState={{ selected: !item.isRead }}
      style={[
        s.notifCard,
        !item.isRead && s.notifCardUnread,
        item.isRead && s.notifCardRead,
      ]}>

      {/* Type icon */}
      <View style={[s.notifIcon, { backgroundColor: cfg.bg, borderColor: `${cfg.color}20` }]}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
      </View>

      {/* Content */}
      <View style={s.notifContent}>
        <View style={[s.notifTitleRow, { flexDirection: flexRow(IS_RTL) }]}>
          <UIText style={[s.notifTitle, !item.isRead && s.notifTitleUnread, { textAlign: TEXT_START }]} numberOfLines={1}>
            {item.title}
          </UIText>
          <UIText style={s.notifTime}>{timeAgo(item.createdAt, t)}</UIText>
        </View>
        <UIText style={[s.notifBody, { textAlign: TEXT_START }]} numberOfLines={2}>
          {item.body}
        </UIText>
        <View style={[s.notifTypePill, { backgroundColor: cfg.bg, flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.notifTypeDot, { backgroundColor: cfg.color }]} />
          <UIText style={[s.notifTypeText, { color: cfg.color }]}>{t(cfg.labelKey)}</UIText>
        </View>
      </View>
    </PressableScale>
  );

  const handleDelete = useCallback(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onDelete();
  }, [onDelete]);

  const renderAction = useCallback(
    (progress: SharedValue<number>) => <DeleteAction progress={progress} onPress={handleDelete} />,
    [handleDelete],
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={IS_RTL ? undefined : renderAction}
      renderLeftActions={IS_RTL ? renderAction : undefined}>
      {card}
    </ReanimatedSwipeable>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { c } = useDarkColors();

  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();
  const { user } = useAuth();

  const {
    items: notifications,
    unreadCount,
    isLoading: loading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    markRead,
    markAllRead,
    dismiss,
  } = useNotifications(user?.id);

  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const sections = useMemo(() => groupByDate(filtered, t), [filtered, t]);

  const handleMarkAllRead = useCallback(() => {
    if (!user?.id) return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    markAllRead();
  }, [user?.id, markAllRead]);

  const handleNotifPress = useCallback((item: AppNotification) => {
    if (!item.isRead) markRead(item.id);
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    if (item.actionUrl) router.push(item.actionUrl as never);
  }, [markRead, router]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(({ item, index }: { item: AppNotification; index: number }) => (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(200)}>
      <NotificationRow
        item={item}
        onPress={() => handleNotifPress(item)}
        onDelete={() => dismiss(item.id)}
      />
    </Animated.View>
  ), [handleNotifPress, dismiss]);

  const renderSectionHeader = useCallback(({ section }: { section: NotifSection }) => (
    <UIText style={[s.sectionHeader, { textAlign: TEXT_START }]}>{section.title}</UIText>
  ), []);

  const keyExtractor = useCallback((item: AppNotification) => item.id, []);

  return (
    <View style={s.screen}>

      {/* ── VIP Header ── */}
      <Animated.View entering={FadeIn.duration(240)} style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={[s.headerTopRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={() => router.back()}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}>
            <Ionicons name={BACK_CHEVRON} size={18} color={c.inkSoft} />
          </Pressable>

          <View style={s.iconTile}>
            <Ionicons name="notifications-outline" size={22} color={c.accentDeep} />
          </View>

          <View style={{ flex: 1 }}>
            <UIText style={s.headerEyebrow}>{t("notifications.title")}</UIText>
            {unreadCount > 0 && (
              <Animated.View entering={FadeIn.duration(200)} style={[s.unreadBadge, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={s.unreadDot} />
                <UIText style={s.unreadText}>{t("notifications.newBadge", { count: unreadCount })}</UIText>
              </Animated.View>
            )}
          </View>

          <Pressable
            onPress={() => router.push("/notification-preferences")}
            style={s.settingsBtn}
            hitSlop={6}
            accessibilityRole="button">
            <Ionicons name="settings-outline" size={17} color={c.inkSoft} />
          </Pressable>
        </View>

        {/* Filter chips + mark all */}
        <View style={[s.filterBar, { flexDirection: flexRow(IS_RTL) }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterRow, { flexDirection: flexRow(IS_RTL) }]}>
            {FILTER_CONFIGS.map((f) => {
              const active = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[s.filterChip, active && s.filterChipActive]}>
                  <UIText style={[s.filterChipText, active && s.filterChipTextActive]}>
                    {t(f.labelKey)}
                  </UIText>
                </Pressable>
              );
            })}
          </ScrollView>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead} hitSlop={8} accessibilityRole="button">
              <UIText style={s.markAllText}>{t("notifications.markAll")}</UIText>
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* ── List ── */}
      {loading && notifications.length === 0 ? (
        <NotificationsSkeleton insetsBottom={insets.bottom} />
      ) : isError && notifications.length === 0 ? (
        <View style={{ paddingTop: 60 }}>
          <EmptyState
            icon="wifi-outline"
            title={t("errors.network").split(".")[0]}
            description={t("errors.network")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            s.listContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          maxToRenderPerBatch={12}
          initialNumToRender={10}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => refetch()}
              tintColor={c.accent}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={c.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 60 }}>
              <EmptyState
                icon="notifications-off-outline"
                title={t("notifications.empty")}
                description={filter !== "all" ? t("notifications.emptyFiltered") : undefined}
                actionLabel={filter !== "all" ? t("notifications.filterAll") : undefined}
                onAction={filter !== "all" ? () => setFilter("all") : undefined}
              />
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.canvas },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingBottom:     14,
    gap:               12,
    backgroundColor:   c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
    ...kit.shadow.raised,
  },
  headerTopRow: { alignItems: "center", gap: 12 },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: c.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     c.line,
    ...kit.shadow.raised,
    flexShrink:      0,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: c.accentTint,
    borderWidth:     1,
    borderColor:     c.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerEyebrow: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.4,
    color:              c.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  unreadBadge: {
    alignItems:  "center",
    gap:         5,
    marginTop:   2,
  },
  unreadDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: c.accent,
    flexShrink:      0,
  },
  unreadText: {
    fontSize:           10,
    fontFamily:         theme.fonts.bold,
    color:              c.accentDeep,
    includeFontPadding: false,
  },
  settingsBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: c.well,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     c.line,
    flexShrink:      0,
  },

  // Filter bar
  filterBar: { alignItems: "center", gap: 8 },
  filterRow: { gap: 6, paddingEnd: 4 },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical:   7,
    borderRadius:      20,
    backgroundColor:   c.well,
    borderWidth:       1,
    borderColor:       c.line,
  },
  filterChipActive: {
    backgroundColor: c.ink,
    borderColor:     c.ink,
  },
  filterChipText: {
    fontSize:           10.5,
    fontFamily:         theme.fonts.bold,
    color:              c.inkSoft,
    includeFontPadding: false,
  },
  filterChipTextActive: {
    color:      "#fff",
    fontFamily: theme.fonts.black,
  },
  markAllText: {
    fontSize:           11,
    fontFamily:         theme.fonts.bold,
    color:              c.accentDeep,
    includeFontPadding: false,
    flexShrink:         0,
  },

  // Loading
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: {
    fontSize:   13,
    fontFamily: theme.fonts.semibold,
    color:      c.inkFaint,
  },

  // List + card row
  listContent: {
    paddingHorizontal: 16,
    paddingTop:        12,
  },
  sectionHeader: {
    fontSize:           11,
    fontFamily:         theme.fonts.black,
    letterSpacing:      0.4,
    textTransform:      "uppercase",
    color:              c.inkFaint,
    paddingTop:         14,
    paddingBottom:      8,
  },
  deleteActionWrap: {
    width:          72,
    alignItems:     "center",
    justifyContent: "center",
  },
  deleteActionBtn: {
    width:           48,
    height:          48,
    borderRadius:    14,
    backgroundColor: c.danger,
    alignItems:      "center",
    justifyContent:  "center",
  },
  notifCard: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "flex-start",
    gap:               14,
    paddingHorizontal: 16,
    paddingVertical:   16,
    backgroundColor:   c.surface,
    borderRadius:      18,
    borderWidth:       1,
    borderColor:       c.line,
    ...kit.shadow.raised,
  },
  notifCardUnread: {
    backgroundColor:  c.accentTint,
    borderColor:      `${c.accent}22`,
    borderStartWidth: 3,
    borderStartColor: c.accent,
  },
  notifCardRead: { backgroundColor: c.surface },
  notifIcon: {
    width:          46,
    height:         46,
    borderRadius:   14,
    alignItems:     "center",
    justifyContent: "center",
    marginTop:      1,
    flexShrink:     0,
    borderWidth:    1,
  },
  notifContent: { flex: 1, gap: 5 },
  notifTitleRow: {
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            8,
  },
  notifTitle: {
    flex:               1,
    fontSize:           13.5,
    fontFamily:         theme.fonts.bold,
    color:              c.inkSoft,
    includeFontPadding: false,
  },
  notifTitleUnread: {
    fontFamily: theme.fonts.black,
    color:      c.ink,
  },
  notifTime: {
    fontSize:           10,
    fontFamily:         theme.fonts.semibold,
    color:              c.inkFaint,
    includeFontPadding: false,
    writingDirection:   "ltr",
    fontVariant:        ["tabular-nums"],
  },
  notifBody: {
    fontSize:           12.5,
    fontFamily:         theme.fonts.regular,
    color:              c.inkSoft,
    lineHeight:         19,
    includeFontPadding: false,
  },
  notifTypePill: {
    alignSelf:         "flex-start",
    alignItems:        "center",
    gap:               4,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   3,
    marginTop:         3,
    borderWidth:       1,
    borderColor:       "rgba(0,0,0,0.04)",
  },
  notifTypeDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.8 },
  notifTypeText: {
    fontSize:           9,
    fontFamily:         theme.fonts.bold,
    includeFontPadding: false,
  },
});
