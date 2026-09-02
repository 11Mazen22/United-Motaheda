/**
 * DriverApplicationEntry — the single "become a driver" entry point.
 * Decides between the application form and the status screen based on
 * whether the caller already has a DriverProfile row, so callers (the
 * customer profile menu) don't need to know which state to route to.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Screen, LoadingOverlay, Text as UIText, Button, useTheme } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { useMyDriverProfile } from "../hooks/useDriverProfile";
import { DriverApplicationScreen } from "./DriverApplicationScreen";
import { DriverApplicationPendingScreen } from "./DriverApplicationPendingScreen";

export function DriverApplicationEntry(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const profileQuery = useMyDriverProfile(user?.id);

  if (profileQuery.isLoading) {
    return <Screen edgeTop><View style={{ flex: 1 }}><LoadingOverlay /></View></Screen>;
  }

  if (profileQuery.isError) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <View style={[styles.center, { paddingHorizontal: 24 }]}>
          <UIText variant="h6" style={{ textAlign: "center", marginBottom: 8 }}>{t("errors.network")}</UIText>
          <UIText variant="body" color="secondary" style={{ textAlign: "center", marginBottom: 24 }}>{t("driver.applicationLoadError")}</UIText>
          <Button label={t("common.retry")} onPress={() => profileQuery.refetch()} fullWidth />
        </View>
      </Screen>
    );
  }

  return profileQuery.data ? <DriverApplicationPendingScreen /> : <DriverApplicationScreen />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
