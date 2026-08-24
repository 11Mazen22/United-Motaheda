/**
 * DriverApplicationPendingScreen — status view for an existing application.
 * Status->icon/title/body mapping and 30s poll are a direct port of
 * courier-mobile's app/(auth)/pending.tsx.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Screen, Text as UIText, Button, useTheme, kit } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { useMyDriverProfilePolling } from "../hooks/useDriverProfile";
import type { DriverApplicationStatus } from "../api";

const STATUS_CONFIG: Record<DriverApplicationStatus, { icon: React.ComponentProps<typeof Ionicons>["name"]; titleKey: string; bodyKey: string; color: "warning" | "success" | "error" | "muted" }> = {
  PENDING_APPROVAL: { icon: "time-outline", titleKey: "driverApplication.statusPendingTitle", bodyKey: "driverApplication.statusPendingBody", color: "warning" },
  APPROVED: { icon: "checkmark-circle-outline", titleKey: "driverApplication.statusApprovedTitle", bodyKey: "driverApplication.statusApprovedBody", color: "success" },
  ACTIVE: { icon: "checkmark-circle-outline", titleKey: "driverApplication.statusApprovedTitle", bodyKey: "driverApplication.statusApprovedBody", color: "success" },
  SUSPENDED: { icon: "pause-circle-outline", titleKey: "driverApplication.statusSuspendedTitle", bodyKey: "driverApplication.statusSuspendedBody", color: "error" },
  REJECTED: { icon: "close-circle-outline", titleKey: "driverApplication.statusRejectedTitle", bodyKey: "driverApplication.statusRejectedBody", color: "error" },
  INACTIVE: { icon: "pause-circle-outline", titleKey: "driverApplication.statusSuspendedTitle", bodyKey: "driverApplication.statusSuspendedBody", color: "muted" },
};

export function DriverApplicationPendingScreen(): React.ReactElement {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const profileQuery = useMyDriverProfilePolling(user?.id, true);
  const profile = profileQuery.data;

  const status = profile?.status ?? "PENDING_APPROVAL";
  const config = STATUS_CONFIG[status];
  const colorValue = config.color === "muted" ? theme.colors.text.muted : theme.colors.status[config.color];

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <DriverScreenHeader title={t("driverApplication.title")} />
      <View style={s.wrap}>
        <View style={[s.iconWrap, { backgroundColor: `${colorValue}1A` }]}>
          <Ionicons name={config.icon} size={40} color={colorValue} />
        </View>
        <UIText variant="screen-title" style={{ textAlign: "center", marginTop: 16 }}>
          {t(config.titleKey)}
        </UIText>
        <UIText variant="body-sm" color="secondary" style={{ textAlign: "center", marginTop: 8, paddingHorizontal: kit.inset.screen }}>
          {t(config.bodyKey)}
        </UIText>
        {status === "REJECTED" && profile?.rejectionReason && (
          <View style={[s.reasonCard, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <UIText variant="caption" color="secondary" style={{ textAlign: "center" }}>{profile.rejectionReason}</UIText>
          </View>
        )}
        <View style={{ height: 24 }} />
        <Button label={t("common.back")} variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  reasonCard: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, maxWidth: 320 },
});
