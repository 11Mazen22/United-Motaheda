import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText, Card } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";
import { formatPrice } from "@/utils/format";

const IS_RTL = isRtl();

interface DriverHeroProps {
  orders: any[];
  offers: number;
  onPressOffers?: () => void;
  onPressRoutes?: () => void;
  onPressHistory?: () => void;
}

export function DriverHero({ orders, offers, onPressOffers, onPressRoutes, onPressHistory }: DriverHeroProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const earnings = useMemo(() => orders.reduce((s, o) => s + Number(o.total ?? 0), 0), [orders]);
  const readyCount = useMemo(() => orders.filter((o) => o.status === "ready").length, [orders]);

  return (
    <Card style={h.wrap} elevation="lg">
      <View style={h.headerRow}>
        <View style={h.hello}>
          <UIText variant="screen-title" style={h.title}>{t("driver.greetingShort", "مرحباً")}</UIText>
          <UIText variant="body-sm" color="inverse-muted" style={h.subtitle}>
            {t("driver.todaySummary", "عرض سريع للطلبات والعمل الحالي")}
          </UIText>
        </View>
      </View>

      <View style={h.metricsRow}>
        <View style={h.metricCard}>
          <UIText style={h.metricValue}>{orders.length}</UIText>
          <UIText variant="caption" color="secondary" style={h.metricLabel}>{t("driver.activeOrders", "الطلبات النشطة")}</UIText>
        </View>
        <View style={h.metricCard}>
          <UIText style={h.metricValue}>{readyCount}</UIText>
          <UIText variant="caption" color="secondary" style={h.metricLabel}>{t("driver.readyNow", "جاهزة الآن")}</UIText>
        </View>
        <View style={h.metricCard}>
          <UIText style={h.metricValue}>{formatPrice(earnings)}</UIText>
          <UIText variant="caption" color="secondary" style={h.metricLabel}>{t("driver.todayEarnings", "الأرباح اليوم")}</UIText>
        </View>
      </View>

      <View style={h.actionsRow}>
        <Pressable
          onPress={onPressRoutes ?? (() => router.push("/(driver)/map" as never))}
          style={({ pressed }) => [h.actionBtn, pressed && h.actionBtnPressed]}
          accessibilityRole="button"
        >
          <Ionicons name="navigate-outline" size={18} color={kit.color.onAccent} />
          <UIText variant="body-sm" style={h.actionLabel}>{t("driver.heroRoutes", "الطرق")}</UIText>
        </Pressable>
        <Pressable
          onPress={onPressOffers ?? (() => router.push("/(driver)/offers" as never))}
          style={({ pressed }) => [h.actionBtn, pressed && h.actionBtnPressed, { backgroundColor: kit.color.surface }]}
          accessibilityRole="button"
        >
          <Ionicons name="flash-outline" size={18} color={kit.color.ink} />
          <UIText variant="body-sm" style={h.actionLabel}>{t("driver.heroOffers", "العروض")}</UIText>
          {offers > 0 ? <View style={h.badge}><UIText style={h.badgeText}>{offers}</UIText></View> : null}
        </Pressable>
        <Pressable
          onPress={onPressHistory ?? (() => router.push("/(driver)/history" as never))}
          style={({ pressed }) => [h.actionBtn, pressed && h.actionBtnPressed, { backgroundColor: kit.color.surface }]}
          accessibilityRole="button"
        >
          <Ionicons name="reader-outline" size={18} color={kit.color.ink} />
          <UIText variant="body-sm" style={h.actionLabel}>{t("driver.heroHistory", "السجل")}</UIText>
        </Pressable>
      </View>
    </Card>
  );
}

const h = StyleSheet.create({
  wrap: {
    marginHorizontal: kit.inset.screen,
    padding: 18,
    borderRadius: kit.radius.xl,
    backgroundColor: kit.color.ink,
    ...kit.shadow.raised,
  },
  headerRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    color: kit.color.onInk,
    fontFamily: theme.fonts.black,
  },
  subtitle: {
    marginTop: 6,
    color: kit.color.onInk,
    opacity: 0.85,
  },
  metricsRow: {
    flexDirection: flexRow(IS_RTL),
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.xl,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 22,
    fontFamily: theme.fonts.black,
    color: kit.color.ink,
  },
  metricLabel: {
    marginTop: 4,
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: flexRow(IS_RTL),
    gap: 10,
    marginTop: 18,
  },
  actionBtn: {
    flex: 1,
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: kit.radius.lg,
    backgroundColor: kit.color.accent,
  },
  actionBtnPressed: {
    opacity: 0.8,
  },
  actionLabel: {
    color: kit.color.onAccent,
  },
  badge: {
    marginStart: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: kit.color.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: theme.fonts.black,
  },
  hello: {
    flex: 1,
  },
});

export default DriverHero;
