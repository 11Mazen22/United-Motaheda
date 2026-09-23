/**
 * DriverCancelScreen — reason-chip picker + note, cancels an order this
 * driver is assigned to, before pickup.
 *
 * Same UX shape as IssueReportScreen (this app's established pattern for a
 * driver reason-based action), but a materially different backend
 * operation: this calls cancelOrder() -> the cancel-order Edge Function ->
 * execute_order_cancellation(), which terminates the order (assignment
 * supersession, inventory release, refund, customer notification) rather
 * than just logging a flag for the ops team to review. get_order_actions()
 * only allows this up through driver_accepted (see the route guard in
 * app/(driver)/cancel/[orderId].tsx and the stage check in
 * DeliveryExecutionScreen before this screen is ever reachable) — once
 * picked up, cancellation is no longer possible for any actor and "Report
 * an issue" is the only path.
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText, Input, useTheme } from "@pharmacy/ui-native";
import { Button } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useDriverMutations } from "../hooks/useDriverMutations";
import type { DriverCancelReasonCode } from "../api";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { getDriverActionErrorMessage } from "../lib/errorMessage";
import { useAuth } from "@/features/auth";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const REASONS: { code: DriverCancelReasonCode; icon: React.ComponentProps<typeof Ionicons>["name"]; labelKey: string }[] = [
  { code: "CUSTOMER_UNREACHABLE", icon: "call-outline",                        labelKey: "driver.cancelReasonCustomerUnreachable" },
  { code: "ADDRESS_UNREACHABLE",  icon: "location-outline",                    labelKey: "driver.cancelReasonAddressUnreachable" },
  { code: "VEHICLE_ISSUE",        icon: "car-sport-outline",                   labelKey: "driver.cancelReasonVehicleIssue" },
  { code: "SAFETY_ISSUE",         icon: "shield-outline",                      labelKey: "driver.cancelReasonSafetyIssue" },
  { code: "DELIVERY_PROBLEM",     icon: "alert-circle-outline",                labelKey: "driver.cancelReasonDeliveryProblem" },
  { code: "OTHER",                icon: "ellipsis-horizontal-circle-outline",  labelKey: "driver.cancelReasonOther" },
];

export function DriverCancelScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { pagePad } = useScreenLayout();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const [selected, setSelected] = useState<DriverCancelReasonCode | null>(null);
  const [note, setNote] = useState("");

  const mutations = useDriverMutations(user?.id);

  const s = useMemo(() => StyleSheet.create({
    content: { paddingBottom: 0 },
    warnNotice: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 8,
      backgroundColor: `${theme.colors.status.error}14`,
      marginHorizontal: pagePad,
      marginBottom: 14,
      padding: 12,
      borderRadius: 12,
    },
    noteInputContainer: { marginHorizontal: pagePad, marginTop: 8 },
    noteInput: { minHeight: 90, textAlignVertical: "top" },
    submitWrap: { marginHorizontal: pagePad, marginTop: 20 },
    reasonGrid: { flexDirection: flexRow(IS_RTL), flexWrap: "wrap", gap: 8 },
    reasonGridCell: { width: "48%", marginBottom: 8 },
  }), [theme, pagePad]);

  const handleSubmit = async () => {
    if (!orderId || !selected) return;
    try {
      await mutations.cancel.mutateAsync({ orderId, reason: selected });
      showSuccessSheet(t("driver.cancelledTitle"), t("driver.cancelledBody"), () => router.replace("/(driver)" as never));
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), getDriverActionErrorMessage(e, t, t("driver.actionFailedBody")));
    }
  };

  return (
    <Screen edgeTop keyboardAvoiding background={theme.colors.canvas.background} contentStyle={s.content}>
      <DriverScreenHeader title={t("driver.cancelOrderTitle")} subtitle={t("driver.cancelReasonPrompt")} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={s.warnNotice}>
          <Ionicons name="warning-outline" size={18} color={theme.colors.status.error} />
          <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START, color: theme.colors.status.error }}>
            {t("driver.cancelWarning")}
          </UIText>
        </View>

        <UIText variant="card-title" style={{ paddingHorizontal: pagePad, textAlign: TEXT_START }}>
          {t("driver.cancelReasonPrompt")}
        </UIText>

        <View style={{ paddingHorizontal: pagePad, marginTop: 10 }}>
          <View style={s.reasonGrid}>
            {REASONS.map((r) => {
              const active = selected === r.code;
              return (
                <View key={r.code} style={s.reasonGridCell}>
                  <ReasonRow
                    active={active}
                    icon={r.icon}
                    label={t(r.labelKey)}
                    onPress={() => setSelected(r.code)}
                  />
                </View>
              );
            })}
          </View>
        </View>

        <UIText variant="card-title" style={{ paddingHorizontal: pagePad, marginTop: 20, textAlign: TEXT_START }}>
          {t("driver.additionalNotes")}
        </UIText>
        <Input
          value={note}
          onChangeText={setNote}
          placeholder={t("driver.additionalNotesPlaceholder")}
          multiline
          numberOfLines={4}
          containerStyle={s.noteInputContainer}
          style={s.noteInput}
        />

        <View style={s.submitWrap}>
          <Button
            label={t("driver.confirmCancelOrder")}
            icon="close-circle-outline"
            variant="danger"
            onPress={() => void handleSubmit()}
            disabled={!selected}
            loading={mutations.cancel.isPending}
            full
            size="lg"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function ReasonRow({
  active, icon, label, onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    reasonRow: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
    },
    reasonRowActive: {
      borderColor: theme.colors.status.error,
      backgroundColor: `${theme.colors.status.error}14`,
    },
    reasonRowIcon: {
      width: 30, height: 30, borderRadius: 15,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.canvas.surfaceMuted,
    },
    reasonRowIconActive: {
      backgroundColor: theme.colors.status.error,
    },
  }), [theme]);

  return (
    <Pressable onPress={onPress} style={[s.reasonRow, active && s.reasonRowActive]} accessibilityRole="radio" accessibilityState={{ checked: active }}>
      <View style={[s.reasonRowIcon, active && s.reasonRowIconActive]}>
        <Ionicons name={icon} size={16} color={active ? theme.colors.text.inverse : theme.colors.text.secondary} />
      </View>
      <UIText
        variant="body-sm"
        weight={active ? "bold" : "regular"}
        color={active ? "primary" : "secondary"}
        style={{ textAlign: TEXT_START, flex: 1 }}>
        {label}
      </UIText>
      {active && <Ionicons name="checkmark-circle" size={18} color={theme.colors.status.error} />}
    </Pressable>
  );
}
