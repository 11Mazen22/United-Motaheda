/**
 * DriverProfileScreen — driver identity, settings, and sign-out.
 * Modeled on PharmacistProfileScreen; vehicle info is added once the
 * vetting/approval flow (driver-app-consolidation plan, Phase 3) lands.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, Text as UIText, useTheme, kit } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { FORWARD_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { useDriverManifest } from "../hooks/useDriverManifest";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface MenuRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuRow({ icon, label, onPress, danger = false }: MenuRowProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && { backgroundColor: theme.colors.canvas.surfaceMuted },
        { flexDirection: flexRow(IS_RTL) },
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? `${theme.colors.status.error}1A` : theme.colors.brand.primaryLight }]}>
        <Ionicons name={icon} size={16} color={danger ? theme.colors.status.error : theme.colors.brand.primary} />
      </View>
      <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START, color: danger ? theme.colors.status.error : theme.colors.text.primary }}>
        {label}
      </UIText>
      {!danger && <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.text.muted} />}
    </Pressable>
  );
}

export function DriverProfileScreen(): React.ReactElement {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const manifestQuery = useDriverManifest(user?.id);

  const orders = manifestQuery.data ?? [];
  const completedCount = orders.filter((o) => o.status === "delivered").length;
  const activeCount = orders.length;

  const nextLanguage = language === "ar" ? "en" : "ar";
  const languageLabel = language === "ar" ? "العربية" : "English";

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.profileTitle")} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.brand.primary }]}>
            <UIText style={styles.avatarLetter}>
              {(user?.name ?? user?.email ?? "D").charAt(0).toUpperCase()}
            </UIText>
          </View>
          <UIText variant="screen-title" style={{ textAlign: "center" }}>
            {user?.name || t("driver.unnamed")}
          </UIText>
          <UIText variant="body-sm" color="secondary" style={{ textAlign: "center" }}>
            {user?.email || ""}
          </UIText>
          <View style={[styles.roleBadge, { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }]}>
            <Ionicons name="bicycle-outline" size={12} color={theme.colors.brand.primary} />
            <UIText variant="eyebrow" style={{ color: theme.colors.brand.primary }}>
              {t("driver.roleLabel")}
            </UIText>
          </View>
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={[styles.menuIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
              <Ionicons name="checkmark-done-outline" size={16} color={theme.colors.brand.primary} />
            </View>
            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>
              {t("driver.completed")}
            </UIText>
            <UIText style={styles.statValue}>{completedCount}</UIText>
          </View>
          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={[styles.menuIcon, { backgroundColor: `${theme.colors.status.warning}1A` }]}>
              <Ionicons name="list-outline" size={16} color={theme.colors.status.warning} />
            </View>
            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>
              {t("driver.activeOrders")}
            </UIText>
            <UIText style={styles.statValue}>{activeCount}</UIText>
          </View>
        </View>

        {/* Menu */}
        <View style={[styles.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
          <MenuRow
            icon="notifications-outline"
            label={t("driver.profileNotifications")}
            onPress={() => router.push("/notifications")}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow
            icon="language-outline"
            label={`${t("driver.profileLanguage")} · ${languageLabel}`}
            onPress={() => { void setLanguage(nextLanguage); }}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow
            icon="lock-closed-outline"
            label={t("driver.profileSecurity")}
            onPress={() => router.push("/change-password")}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow
            icon="help-circle-outline"
            label={t("driver.profileHelp")}
            onPress={() => router.push("/faq")}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default, marginTop: 12 }]}>
          <MenuRow
            icon="log-out-outline"
            label={t("driver.signOut")}
            onPress={() => void signOut()}
            danger
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 60 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 28 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 34,
    fontFamily: "Cairo_900Black",
    color: "#fff",
  },
  roleBadge: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    marginTop: 4,
  },
  card: {
    marginHorizontal: kit.inset.screen,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  statsCard: {
    marginHorizontal: kit.inset.screen,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  statRow: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: kit.inset.card,
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 16,
    fontFamily: "Cairo_900Black",
  },
  menuRow: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: kit.inset.card,
    paddingVertical: 14,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: kit.inset.card,
  },
});
