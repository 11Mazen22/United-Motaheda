/**
 * DriverProfileScreen — driver identity, vehicle info, availability, and
 * settings.
 *
 * Confirmed bug fixed here: this screen never queried useMyDriverProfile at
 * all, so vehicle/document info (already collected by the application
 * wizard and already present on DriverProfileRecord) was never fetched or
 * shown — despite the file's own previous header comment claiming that flow
 * hadn't shipped yet, when it had. Also adds the availability toggle here
 * too (not just the home screen) and a real confirmation before sign-out,
 * which neither of this app's two sign-out entry points had before.
 */
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import Animated from "react-native-reanimated";

import { Screen, Text as UIText, useTheme, PressableScale } from "@pharmacy/ui-native";
import { theme as legacyTheme, gradients } from "@pharmacy/design-tokens";
import { useAuth } from "@/features/auth";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { FORWARD_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { displayNameFromEmail } from "@/utils/displayName";
import { useScreenLayout } from "@/utils/responsive";
import { showConfirmSheet, showErrorSheet } from "@/shared/store/appSheetStore";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { useDriverManifest, useMyAcceptanceRate } from "../hooks/useDriverManifest";
import { useMyDriverProfile } from "../hooks/useDriverProfile";
import { useDriverMutations } from "../hooks/useDriverMutations";
import { getDriverActionErrorMessage } from "../lib/errorMessage";

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
    <PressableScale
      onPress={onPress}
      style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", padding: 16, gap: 14 }}
      accessibilityRole="button"
    >
      <View style={[{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, { backgroundColor: danger ? `${theme.colors.status.error}1A` : theme.colors.brand.primaryLight }]}>
        <Ionicons name={icon} size={18} color={danger ? theme.colors.status.error : theme.colors.brand.primary} />
      </View>
      <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START, color: danger ? theme.colors.status.error : theme.colors.text.primary, fontFamily: legacyTheme.fonts.bold }}>
        {label}
      </UIText>
      {!danger && <Ionicons name={FORWARD_CHEVRON} size={16} color={theme.colors.text.muted} />}
    </PressableScale>
  );
}

function StatTile({ icon, label, value, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: React.ReactNode; onPress?: () => void }) {
  const { theme } = useTheme();
  const content = (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <View style={[{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, { backgroundColor: theme.colors.brand.primaryLight }]}>
        <Ionicons name={icon} size={20} color={theme.colors.brand.primary} />
      </View>
      <UIText variant="caption" color="secondary" style={{ textAlign: "center", marginTop: 8 }}>{label}</UIText>
      <UIText style={{ fontSize: 20, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.primary, marginTop: 4, textAlign: "center" }}>{value}</UIText>
    </View>
  );
  
  const tileStyle = { width: "50%" as const, paddingVertical: 20, paddingHorizontal: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border.subtle };
  
  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" style={tileStyle}>
        {content}
      </PressableScale>
    );
  }
  return <View style={tileStyle}>{content}</View>;
}

const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: "driverApplication.vehicleMotorcycle",
  car: "driverApplication.vehicleCar",
  van: "driverApplication.vehicleVan",
};

const VEHICLE_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  motorcycle: "bicycle-outline",
  car: "car-sport-outline",
  van: "car-outline",
};

function RatingStars({ value }: { value: number }) {
  const { theme } = useTheme();
  const rounded = Math.round(value);
  return (
    <View style={{ flexDirection: flexRow(IS_RTL), gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= rounded ? "star" : "star-outline"} size={14} color={theme.colors.status.warning} />
      ))}
    </View>
  );
}

function formatMemberSince(iso: string, language: string): string {
  try {
    return new Date(iso).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export function DriverProfileScreen(): React.ReactElement {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const { isTablet, pagePad } = useScreenLayout();
  const manifestQuery = useDriverManifest(user?.id);
  const acceptanceRateQuery = useMyAcceptanceRate(user?.id);
  const profileQuery = useMyDriverProfile(user?.id);
  const mutations = useDriverMutations(user?.id);

  const orders = manifestQuery.data ?? [];
  const completedCount = orders.filter((o) => o.status === "delivered").length;
  const activeCount = orders.length;
  const profile = profileQuery.data;
  const isOnline = profile?.isOnline ?? false;

  const nextLanguage = language === "ar" ? "en" : "ar";
  const languageLabel = language === "ar" ? "العربية" : "English";

  const handleToggleAvailability = async () => {
    try {
      await mutations.setAvailability.mutateAsync({ isOnline: !isOnline });
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
    }
  };

  const handleSignOut = () => {
    showConfirmSheet(
      t("driver.signOutConfirmTitle", "Sign out?"),
      t("driver.signOutConfirmBody", "You'll stop receiving new delivery offers until you sign back in."),
      () => void signOut(),
      { danger: true, confirmLabel: t("driver.signOut") },
    );
  };

  const s = useMemo(() => StyleSheet.create({
    scroll: { paddingBottom: 60 },
    heroGradient: { paddingHorizontal: pagePad, paddingBottom: 48, paddingTop: 16, alignItems: "center" },
    avatarContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#fff", padding: 4, ...theme.shadows[2], marginBottom: 12 },
    avatar: { flex: 1, borderRadius: 45, alignItems: "center", justifyContent: "center" },
    avatarLetter: { fontSize: 38, fontFamily: legacyTheme.fonts.black, color: "#fff" },
    heroName: { fontSize: 22, fontFamily: legacyTheme.fonts.black, color: "#fff", textAlign: "center" },
    heroEmail: { fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 4 },
    badgesRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 },
    roleBadge: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.2)" },
    newDriverBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.2)" },
    availabilityCard: { marginHorizontal: pagePad, marginTop: -24, padding: 16, borderRadius: 20, backgroundColor: theme.colors.canvas.surfaceElevated, ...theme.shadows[3], zIndex: 10, flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 16 },
    availabilityToggle: { width: 56, height: 32, borderRadius: 16, padding: 3, justifyContent: "center" },
    availabilityKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#fff", ...theme.shadows[1] },
    section: { marginHorizontal: pagePad, marginTop: 16, borderRadius: 20, backgroundColor: theme.colors.canvas.surfaceElevated, ...theme.shadows[1], overflow: "hidden" },
    statsGrid: { flexDirection: flexRow(IS_RTL), flexWrap: "wrap" },
    divider: { height: 1, backgroundColor: theme.colors.border.subtle, marginHorizontal: 16 },
    vehicleRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", padding: 16, gap: 14 },
    statTileEmpty: { width: "50%", paddingVertical: 20, paddingHorizontal: 12, borderRightWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border.subtle }
  }), [theme, pagePad]);

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.profileTitle")} />
      <ScrollView
        contentContainerStyle={[s.scroll, isTablet && { maxWidth: 640, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={gradients.brandPrimary as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroGradient}>
          <View style={s.avatarContainer}>
            <View style={[s.avatar, { backgroundColor: theme.colors.brand.primary }]}>
              <UIText style={s.avatarLetter}>{(user?.name ?? user?.email ?? "D").charAt(0).toUpperCase()}</UIText>
            </View>
          </View>
          <UIText style={s.heroName} numberOfLines={1}>{user?.name || displayNameFromEmail(user?.email) || t("driver.unnamed")}</UIText>
          <UIText style={s.heroEmail} numberOfLines={1}>{user?.email || ""}</UIText>

          <View style={s.badgesRow}>
            <View style={s.roleBadge}>
              <Ionicons name={VEHICLE_ICONS[profile?.vehicleType ?? "motorcycle"] ?? "bicycle-outline"} size={14} color="#fff" />
              <UIText variant="caption" style={{ color: "#fff", fontFamily: legacyTheme.fonts.bold }}>{t("driver.roleLabel")}</UIText>
            </View>
            {profile && profile.totalDeliveries > 0 ? (
              <RatingStars value={profile.rating} />
            ) : profile ? (
              <View style={s.newDriverBadge}>
                <UIText variant="caption" style={{ color: "#fff", fontFamily: legacyTheme.fonts.bold }}>{t("driver.newDriverBadge", "سائق جديد")}</UIText>
              </View>
            ) : null}
          </View>
          {profile?.createdAt ? (
            <UIText variant="caption" style={{ color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
              {t("driver.memberSince", { date: formatMemberSince(profile.createdAt, language) })}
            </UIText>
          ) : null}
        </LinearGradient>

        <Pressable
          onPress={() => void handleToggleAvailability()}
          disabled={mutations.setAvailability.isPending}
          style={s.availabilityCard}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOnline }}
        >
          <View style={{ flex: 1 }}>
            <UIText variant="label" style={{ color: theme.colors.text.primary, textAlign: TEXT_START, fontFamily: legacyTheme.fonts.bold, fontSize: 16 }}>
              {isOnline ? t("driver.statusOnline", "You're Online") : t("driver.statusOffline", "You're Offline")}
            </UIText>
            <UIText numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, color: theme.colors.text.muted, marginTop: 4 }}>
              {isOnline ? t("driver.onlineSubtitle") : t("driver.offlineSubtitle")}
            </UIText>
          </View>
          <View style={[s.availabilityToggle, { backgroundColor: isOnline ? theme.colors.status.success : "rgba(128,128,128,0.2)" }]}>
            <Animated.View style={[s.availabilityKnob, { transform: [{ translateX: isOnline ? (IS_RTL ? -24 : 24) : 0 }] }]} />
          </View>
        </Pressable>

        {profile ? (
          <View style={s.section}>
            <View style={s.vehicleRow}>
              <View style={[{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, { backgroundColor: theme.colors.brand.primaryLight }]}>
                <Ionicons name="bicycle-outline" size={18} color={theme.colors.brand.primary} />
              </View>
              <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START, fontFamily: legacyTheme.fonts.bold }}>
                {t(VEHICLE_LABELS[profile.vehicleType] ?? "driverApplication.vehicleMotorcycle")}
                {profile.vehiclePlate ? ` · ${profile.vehiclePlate}` : ""}
              </UIText>
            </View>
            {profile.vehicleModel || profile.vehicleColor ? (
              <>
                <View style={s.divider} />
                <View style={s.vehicleRow}>
                  <View style={[{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                    <Ionicons name="color-palette-outline" size={18} color={theme.colors.text.secondary} />
                  </View>
                  <UIText variant="body-sm" color="secondary" style={{ flex: 1, textAlign: TEXT_START }}>
                    {[profile.vehicleModel, profile.vehicleColor].filter(Boolean).join(" · ")}
                  </UIText>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={s.section}>
          <View style={s.statsGrid}>
            <StatTile icon="checkmark-done-outline" label={t("driver.completed")} value={completedCount} />
            <StatTile icon="list-outline" label={t("driver.activeOrders")} value={activeCount} />
            <StatTile icon="trending-up-outline" label={t("driver.acceptanceRate")} value={acceptanceRateQuery.data != null ? `${acceptanceRateQuery.data}%` : "—"} />
            {profile ? (
              <StatTile icon="wallet-outline" label={t("driver.lifetimeEarnings")} value={formatPrice(profile.totalEarnings)} onPress={() => router.push("/(driver)/earnings" as never)} />
            ) : (
              <View style={s.statTileEmpty} />
            )}
          </View>
        </View>

        <View style={s.section}>
          <MenuRow icon="notifications-outline" label={t("driver.profileNotifications")} onPress={() => router.push("/driver-notifications" as never)} />
          <View style={s.divider} />
          <MenuRow icon="language-outline" label={`${t("driver.profileLanguage")} · ${languageLabel}`} onPress={() => { void setLanguage(nextLanguage); }} />
          <View style={s.divider} />
          <MenuRow icon="lock-closed-outline" label={t("driver.profileSecurity")} onPress={() => router.push("/change-password" as never)} />
          <View style={s.divider} />
          <MenuRow icon="help-circle-outline" label={t("driver.profileHelp")} onPress={() => router.push("/faq" as never)} />
        </View>

        <View style={[s.section, { marginBottom: 24 }]}>
          <MenuRow icon="log-out-outline" label={t("driver.signOut")} onPress={handleSignOut} danger />
        </View>
      </ScrollView>
    </Screen>
  );
}
