/**
 * PharmacistProfileScreen — pharmacist identity, settings, and sign-out.
 *
 * Gradient identity header matches the rest of the pharmacist product
 * instead of a plain-background avatar floating on the page. Falls back to
 * a name derived from the account email (displayNameFromEmail) rather than
 * a generic "Pharmacist" placeholder whenever no display name was set at
 * sign-up — same fix already applied for driver/customer.
 */
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { gradients } from "@pharmacy/design-tokens";

import { Screen, Text as UIText, useTheme, kit, PressableScale, type NativeTheme } from "@pharmacy/ui-native";
import { fmtN } from "@/utils/format";

import { useAuth } from "@/features/auth";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { supabase } from "@/lib/supabase";
import { findBranchById } from "@/features/delivery/branches/data";
import { displayNameFromEmail } from "@/utils/displayName";
import { useScreenLayout } from "@/utils/responsive";
import { FORWARD_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { usePharmacistDashboard } from "../hooks/usePharmacistQueries";

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
  const styles = useMemo(() => StyleSheet.create({
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
  }), [theme]);
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.menuRow, { flexDirection: flexRow(IS_RTL) }]}
      accessibilityRole="button"
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? `${theme.colors.status.error}1A` : theme.colors.brand.primaryLight }]}>
        <Ionicons name={icon} size={16} color={danger ? theme.colors.status.error : theme.colors.brand.primary} />
      </View>
      <UIText
        variant="body-sm"
        style={{ flex: 1, minWidth: 0, textAlign: TEXT_START, color: danger ? theme.colors.status.error : theme.colors.text.primary }}
        numberOfLines={1}
      >
        {label}
      </UIText>
      {!danger && <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.text.muted} />}
    </PressableScale>
  );
}

export function PharmacistProfileScreen(): React.ReactElement {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const { pagePad, isTablet } = useScreenLayout();
  const statsQ = usePharmacistDashboard();

  // profiles.branch_id was added so a pharmacist's order queue can be scoped
  // to their own branch (see supabase/migrations/20260827090000_pharmacist_backend_fixes.sql).
  // No admin UI assigns it yet, so this reads whatever's there — null until
  // an admin calls set_pharmacist_branch(), which is the honest state to show.
  const branchQ = useQuery({
    queryKey: ["pharmacist", "profile", "branch", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as { branch_id: string | null } | null)?.branch_id ?? null;
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });
  const profileBranch = branchQ.data ? findBranchById(branchQ.data) : null;
  const branchName = profileBranch
    ? (language === "ar" ? profileBranch.nameAr : profileBranch.nameEn)
    : branchQ.data;

  const displayName = user?.name?.trim() || displayNameFromEmail(user?.email) || t("pharmacist.unnamed");

  const styles = useMemo(() => createStyles(theme, pagePad), [theme, pagePad]);

  const nextLanguage = language === "ar" ? "en" : "ar";
  const languageLabel = language === "ar" ? "العربية" : "English";

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <LinearGradient
        colors={gradients.brandPrimary as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <UIText style={styles.avatarLetter}>{displayName.charAt(0).toUpperCase()}</UIText>
          </View>
          <UIText variant="screen-title" style={{ color: "#fff", textAlign: "center" }} numberOfLines={1}>
            {displayName}
          </UIText>
          {user?.email ? (
            <UIText variant="body-sm" style={{ color: "rgba(255,255,255,0.78)", textAlign: "center" }} numberOfLines={1}>
              {user.email}
            </UIText>
          ) : null}
          <View style={[styles.badgeRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#fff" />
              <UIText variant="eyebrow" style={{ color: "#fff" }}>{t("pharmacist.roleLabel")}</UIText>
            </View>
            <View style={styles.roleBadge}>
              <Ionicons name="business-outline" size={12} color="#fff" />
              <UIText variant="eyebrow" style={{ color: "#fff" }} numberOfLines={1}>
                {branchName ?? t("pharmacist.branchUnassigned", "All branches")}
              </UIText>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={[styles.menuIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
              <Ionicons name="bag-handle-outline" size={16} color={theme.colors.brand.primary} />
            </View>
            <UIText variant="body-sm" style={{ flex: 1, minWidth: 0, textAlign: TEXT_START }} numberOfLines={1}>
              {t("pharmacist.statActiveOrders")}
            </UIText>
            <UIText style={styles.statValue}>{statsQ.data?.activeOrders ?? 0}</UIText>
          </View>
          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={[styles.menuIcon, { backgroundColor: `${theme.colors.status.warning}1A` }]}>
              <Ionicons name="document-text-outline" size={16} color={theme.colors.status.warning} />
            </View>
            <UIText variant="body-sm" style={{ flex: 1, minWidth: 0, textAlign: TEXT_START }} numberOfLines={1}>
              {t("pharmacist.statPendingRx")}
            </UIText>
            <UIText style={styles.statValue}>{statsQ.data?.pendingPrescriptions ?? 0}</UIText>
          </View>
          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={[styles.menuIcon, { backgroundColor: `${theme.colors.status.error}1A` }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.status.error} />
            </View>
            <UIText variant="body-sm" style={{ flex: 1, minWidth: 0, textAlign: TEXT_START }} numberOfLines={1}>
              {t("pharmacist.statLowStock")}
            </UIText>
            <UIText style={styles.statValue}>{fmtN(statsQ.data?.lowStockCount ?? 0)}</UIText>
          </View>
        </View>

        {/* Menu */}
        <View style={[styles.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
          <MenuRow
            icon="notifications-outline"
            label={t("pharmacist.profileNotifications")}
            onPress={() => router.push("/(pharmacist)/pharmacist-notifications" as never)}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow
            icon="language-outline"
            label={`${t("pharmacist.profileLanguage")} · ${languageLabel}`}
            onPress={() => { void setLanguage(nextLanguage); }}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow
            icon="lock-closed-outline"
            label={t("pharmacist.profileSecurity")}
            onPress={() => router.push("/change-password")}
          />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow
            icon="help-circle-outline"
            label={t("pharmacist.profileHelp")}
            onPress={() => router.push("/faq")}
          />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default, marginTop: 12 }]}>
          <MenuRow
            icon="log-out-outline"
            label={t("pharmacist.signOut")}
            onPress={() => void signOut()}
            danger
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(theme: NativeTheme, pagePad: number) {
  return StyleSheet.create({
    hero: { paddingBottom: 22 },
    scroll: { paddingBottom: 60, paddingTop: 16 },
    scrollTablet: { maxWidth: 640, alignSelf: "center", width: "100%" },
    avatarSection: { alignItems: "center", gap: 8, paddingVertical: 24, paddingHorizontal: pagePad },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.5)",
    },
    avatarLetter: {
      fontSize: 34,
      fontFamily: "Cairo_900Black",
      color: "#fff",
    },
    badgeRow: { gap: 8, marginTop: 4, flexWrap: "wrap", justifyContent: "center" },
    roleBadge: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 9999,
      backgroundColor: "rgba(255,255,255,0.16)",
    },
    card: {
      marginHorizontal: pagePad,
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      ...theme.shadows[1],
    },
    statsCard: {
      marginHorizontal: pagePad,
      marginBottom: 12,
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
      ...theme.shadows[1],
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
      color: theme.colors.text.primary,
      flexShrink: 0,
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
}
