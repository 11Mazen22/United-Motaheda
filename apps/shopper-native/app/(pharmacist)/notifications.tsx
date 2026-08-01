/**
 * Pharmacist notifications screen.
 * Uses the shared useNotifications hook (scoped to auth.uid() via RLS).
 * Pharmacist, driver, and customer all see only their own notifications.
 */
import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons }          from "@expo/vector-icons";
import { useTranslation }    from "react-i18next";
import { useRouter }         from "expo-router";

import { Screen, Text as UIText }  from "@/shared/ui";
import { kit }                     from "@/shared/kit";
import { isRtl, textAlignStart }   from "@/utils/layout";
import { useAuth }                 from "@/features/auth";
import {
  useNotifications,
  type AppNotification,
} from "@/features/notifications";
import { PharmacistScreenHeader }  from "@/features/pharmacist/components/PharmacistScreenHeader";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function timeAgo(
  dateStr: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const diff = Date.now() - Date.parse(dateStr);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return t("notifications.justNow");
  if (mins < 60) return t("notifications.minsAgo",  { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return t("notifications.hoursAgo", { count: hrs });
  return t("notifications.daysAgo", { count: Math.floor(hrs / 24) });
}

export default function PharmacistNotificationsScreen() {
  const { t }   = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { user }= useAuth();

  const {
    items: notifications,
    isLoading,
    markRead,
    markAllRead,
  } = useNotifications(user?.id);

  const handlePress = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) markRead(n.id);
      if (n.actionUrl) router.push(n.actionUrl as never);
    },
    [markRead, router],
  );

  const sections = useMemo(() => {
    const today   = new Date().toDateString();
    const todayNs = notifications.filter(
      (n) => new Date(n.createdAt).toDateString() === today,
    );
    const olderNs = notifications.filter(
      (n) => new Date(n.createdAt).toDateString() !== today,
    );
    const out: { title: string; data: AppNotification[] }[] = [];
    if (todayNs.length) out.push({ title: t("notifications.today"),   data: todayNs });
    if (olderNs.length) out.push({ title: t("notifications.earlier"), data: olderNs });
    return out;
  }, [notifications, t]);

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader
        title={t("notifications.title")}
        trailing={
          <Pressable
            onPress={() => markAllRead()}
            style={s.markAllBtn}
            accessibilityRole="button"
          >
            <UIText variant="caption" color="brand">
              {t("notifications.markAllRead")}
            </UIText>
          </Pressable>
        }
      />

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={kit.color.accent} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.centered}>
          <Ionicons name="notifications-off-outline" size={44} color={kit.color.inkFaint} />
          <UIText variant="card-title" style={{ marginTop: 12, textAlign: "center" }}>
            {t("notifications.emptyTitle")}
          </UIText>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <UIText variant="caption" color="secondary">{section.title}</UIText>
            </View>
          )}
          renderItem={({ item: n }) => (
            <Pressable
              onPress={() => handlePress(n)}
              style={[s.card, !n.isRead && s.cardUnread]}
              accessibilityRole="button"
            >
              <View style={s.dotCol}>
                {!n.isRead && <View style={s.unreadDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <UIText
                  variant="body-sm"
                  weight="bold"
                  numberOfLines={1}
                  style={{ textAlign: TEXT_START }}
                >
                  {n.title}
                </UIText>
                <UIText
                  variant="body-sm"
                  color="secondary"
                  numberOfLines={2}
                  style={{ textAlign: TEXT_START }}
                >
                  {n.body}
                </UIText>
                <UIText
                  variant="caption"
                  color="muted"
                  style={{ textAlign: TEXT_START, marginTop: 3 }}
                >
                  {timeAgo(n.createdAt, t)}
                </UIText>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  centered:    { flex: 1, alignItems: "center", justifyContent: "center" },
  markAllBtn:  { paddingHorizontal: 10, paddingVertical: 6 },
  sectionHeader: {
    paddingHorizontal: kit.inset.screen,
    paddingTop:        14,
    paddingBottom:     6,
    backgroundColor:   kit.color.canvas,
  },
  card: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    gap:               12,
    paddingHorizontal: kit.inset.screen,
    paddingVertical:   14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    backgroundColor:   kit.color.surface,
  },
  cardUnread: { backgroundColor: kit.color.accentTint },
  dotCol:     { width: 8, paddingTop: 5 },
  unreadDot:  {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: kit.color.accent,
  },
});
