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
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, Text as UIText, StatusIndicator, useTheme, kit } from "@pharmacy/ui-native";
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

function StatTile({ icon, label, value, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: React.ReactNode; onPress?: () => void }) {
  const { theme } = useTheme();
  const content = (
    <>
      <View style={[styles.menuIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
        <Ionicons name={icon} size={16} color={theme.colors.brand.primary} />
      </View>
      <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>{label}</UIText>
      <UIText style={styles.statValue}>{value}</UIText>
      {onPress ? <Ionicons name={IS_RTL ? "chevron-back" : "chevron-forward"} size={14} color={theme.colors.text.muted} /> : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.statRow, { flexDirection: flexRow(IS_RTL) }, pressed && { opacity: 0.7 }]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>{content}</View>;
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
  const { isTablet } = useScreenLayout();
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
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
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

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driver.profileTitle")} />
      <ScrollView
        contentContainerStyle={[styles.scroll, isTablet && { maxWidth: 640, alignSelf: "center", width: "100%" }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.brand.primary }]}>
            <UIText style={styles.avatarLetter}>{(user?.name ?? user?.email ?? "D").charAt(0).toUpperCase()}</UIText>
          </View>
          <UIText variant="screen-title" style={{ textAlign: "center" }}>{user?.name || displayNameFromEmail(user?.email) || t("driver.unnamed")}</UIText>
          <UIText variant="body-sm" color="secondary" style={{ textAlign: "center" }}>{user?.email || ""}</UIText>
          <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8, marginTop: 4 }}>
            <View style={[styles.roleBadge, { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary, marginTop: 0 }]}>
              <Ionicons name={VEHICLE_ICONS[profile?.vehicleType ?? "motorcycle"] ?? "bicycle-outline"} size={12} color={theme.colors.brand.primary} />
              <UIText variant="eyebrow" style={{ color: theme.colors.brand.primary }}>{t("driver.roleLabel")}</UIText>
            </View>
            {profile && profile.totalDeliveries > 0 ? (
              <RatingStars value={profile.rating} />
            ) : profile ? (
              <View style={[styles.newDriverBadge, { backgroundColor: theme.colors.canvas.surfaceMuted, borderColor: theme.colors.border.default }]}>
                <UIText variant="eyebrow" color="secondary">{t("driver.newDriverBadge", "سائق جديد")}</UIText>
              </View>
            ) : null}
          </View>
          {profile?.createdAt ? (
            <UIText variant="caption" color="muted" style={{ marginTop: 2 }}>
              {t("driver.memberSince", { date: formatMemberSince(profile.createdAt, language) })}
            </UIText>
          ) : null}
        </View>

        <Pressable
          onPress={() => void handleToggleAvailability()}
          disabled={mutations.setAvailability.isPending}
          style={[styles.availabilityCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOnline }}
        >
          <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", width: "100%" }}>
            <StatusIndicator active={isOnline} pulse={isOnline} label={isOnline ? t("driver.online") : t("driver.offline")} />
            <UIText variant="caption" color="secondary" style={{ marginStart: "auto" }}>{t("driver.tapToToggle", "Tap to toggle")}</UIText>
          </View>
          <UIText numberOfLines={2} variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginTop: 6, width: "100%" }}>
            {isOnline ? t("driver.onlineSubtitle") : t("driver.offlineSubtitle")}
          </UIText>
        </Pressable>

        {profile ? (
          <View style={[styles.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={[styles.menuIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>
                <Ionicons name="bicycle-outline" size={16} color={theme.colors.brand.primary} />
              </View>
              <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>
                {t(VEHICLE_LABELS[profile.vehicleType] ?? "driverApplication.vehicleMotorcycle")}
                {profile.vehiclePlate ? ` · ${profile.vehiclePlate}` : ""}
              </UIText>
            </View>
            {profile.vehicleModel || profile.vehicleColor ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
                <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={[styles.menuIcon, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                    <Ionicons name="color-palette-outline" size={16} color={theme.colors.text.secondary} />
                  </View>
                  <UIText variant="body-sm" color="secondary" style={{ flex: 1, textAlign: TEXT_START }}>
                    {[profile.vehicleModel, profile.vehicleColor].filter(Boolean).join(" · ")}
                  </UIText>
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.statsCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
          <StatTile icon="checkmark-done-outline" label={t("driver.completed")} value={completedCount} />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <StatTile icon="list-outline" label={t("driver.activeOrders")} value={activeCount} />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <StatTile icon="trending-up-outline" label={t("driver.acceptanceRate")} value={acceptanceRateQuery.data != null ? `${acceptanceRateQuery.data}%` : "—"} />
          {profile ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
              <StatTile icon="wallet-outline" label={t("driver.lifetimeEarnings")} value={formatPrice(profile.totalEarnings)} onPress={() => router.push("/(driver)/earnings" as never)} />
            </>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
          <MenuRow icon="notifications-outline" label={t("driver.profileNotifications")} onPress={() => router.push("/driver-notifications" as never)} />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow icon="language-outline" label={`${t("driver.profileLanguage")} · ${languageLabel}`} onPress={() => { void setLanguage(nextLanguage); }} />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow icon="lock-closed-outline" label={t("driver.profileSecurity")} onPress={() => router.push("/change-password")} />
          <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />
          <MenuRow icon="help-circle-outline" label={t("driver.profileHelp")} onPress={() => router.push("/faq")} />
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default, marginTop: 12 }]}>
          <MenuRow icon="log-out-outline" label={t("driver.signOut")} onPress={handleSignOut} danger />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 60 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 28 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 34, fontFamily: "Cairo_900Black", color: "#fff" },
  roleBadge: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, marginTop: 4 },
  newDriverBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },
  availabilityCard: { marginHorizontal: kit.inset.screen, marginBottom: 12, borderRadius: 16, borderWidth: 1, alignItems: "center", padding: 14 },
  card: { marginHorizontal: kit.inset.screen, borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 12 },
  statsCard: { marginHorizontal: kit.inset.screen, marginBottom: 12, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  statRow: { alignItems: "center", gap: 12, paddingHorizontal: kit.inset.card, paddingVertical: 14 },
  statValue: { fontSize: 16, fontFamily: "Cairo_900Black" },
  menuRow: { alignItems: "center", gap: 12, paddingHorizontal: kit.inset.card, paddingVertical: 14 },
  menuIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: kit.inset.card },
});
