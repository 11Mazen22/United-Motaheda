/**
 * IssueReportScreen — reason-chip picker + note, submits to delivery_issues.
 * Shows the driver's own prior reports for this order so they don't silently
 * submit a duplicate.
 */
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { Button, kit } from "@pharmacy/ui-native";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { useMyIssuesForOrder } from "../hooks/useDriverManifest";
import { useDriverMutations } from "../hooks/useDriverMutations";
import type { IssueReasonCode } from "../api";
import { DriverScreenHeader } from "../components/DriverScreenHeader";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const REASONS: { code: IssueReasonCode; icon: React.ComponentProps<typeof Ionicons>["name"]; labelKey: string }[] = [
  { code: "customer_unreachable", icon: "call-outline",         labelKey: "driver.reasonCustomerUnreachable" },
  { code: "wrong_address",        icon: "location-outline",     labelKey: "driver.reasonWrongAddress" },
  { code: "customer_refused",     icon: "hand-left-outline",    labelKey: "driver.reasonCustomerRefused" },
  { code: "item_damaged",         icon: "alert-circle-outline", labelKey: "driver.reasonItemDamaged" },
  { code: "item_missing",         icon: "help-circle-outline",  labelKey: "driver.reasonItemMissing" },
  { code: "access_issue",         icon: "lock-closed-outline",  labelKey: "driver.reasonAccessIssue" },
  { code: "vehicle_breakdown",    icon: "car-sport-outline",    labelKey: "driver.reasonVehicleBreakdown" },
  { code: "other",                icon: "ellipsis-horizontal-circle-outline", labelKey: "driver.reasonOther" },
];

export function IssueReportScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const [selected, setSelected] = useState<IssueReasonCode | null>(null);
  const [note, setNote] = useState("");

  const priorIssuesQuery = useMyIssuesForOrder(orderId, user?.id);
  const mutations = useDriverMutations(user?.id);

  const handleSubmit = async () => {
    if (!orderId || !selected) return;
    try {
      await mutations.report.mutateAsync({ orderId, reasonCode: selected, note: note.trim() || undefined });
      showSuccessSheet(t("driver.issueReportedTitle"), t("driver.issueReportedBody"), () => router.back());
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const priorOpen = (priorIssuesQuery.data ?? []).find((i) => i.status !== "resolved");

  return (
    <Screen edgeTop keyboardAvoiding background={kit.color.canvas} contentStyle={s.content}>
      <DriverScreenHeader title={t("driver.reportIssueTitle")} subtitle={t("driver.whatWentWrong")} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {priorOpen && (
          <View style={s.priorNotice}>
            <Ionicons name="information-circle" size={18} color={kit.color.warn} />
            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START, color: kit.color.warn }}>
              {t("driver.priorIssueOpenNotice")}
            </UIText>
          </View>
        )}

        <UIText variant="card-title" style={{ paddingHorizontal: kit.inset.screen, textAlign: TEXT_START }}>
          {t("driver.whatWentWrong")}
        </UIText>

        <View style={{ paddingHorizontal: kit.inset.screen, marginTop: 10 }}>
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

        <UIText variant="card-title" style={{ paddingHorizontal: kit.inset.screen, marginTop: 20, textAlign: TEXT_START }}>
          {t("driver.additionalNotes")}
        </UIText>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t("driver.additionalNotesPlaceholder")}
          placeholderTextColor={kit.color.inkFaint}
          multiline
          numberOfLines={4}
          style={s.noteInput}
        />

        <View style={s.submitWrap}>
          <Button
            label={t("driver.submitIssue")}
            icon="send"
            onPress={() => void handleSubmit()}
            disabled={!selected || Boolean(priorOpen)}
            loading={mutations.report.isPending}
            full
            size="lg"
          />
        </View>

        {/* Prior reports for context */}
        {(priorIssuesQuery.data ?? []).length > 0 && (
          <View style={{ paddingHorizontal: kit.inset.screen, marginTop: 14 }}>
            <UIText variant="caption" color="secondary">{t("driver.yourPreviousReports")}</UIText>
            {(priorIssuesQuery.data ?? []).map((p) => (
              <View key={p.id} style={s.priorItem}>
                <UIText variant="body-sm">{p.reasonCode}</UIText>
                {p.note ? <UIText variant="caption" color="secondary">{p.note}</UIText> : null}
              </View>
            ))}
          </View>
        )}
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
  return (
    <Pressable onPress={onPress} style={[s.reasonRow, active && s.reasonRowActive]}>
      <View style={[s.reasonRowIcon, active && s.reasonRowIconActive]}>
        <Ionicons name={icon} size={16} color={active ? kit.color.onInk : kit.color.inkSoft} />
      </View>
      <UIText
        variant="body-sm"
        weight={active ? "bold" : "regular"}
        color={active ? "primary" : "secondary"}
        style={{ textAlign: TEXT_START, flex: 1 }}>
        {label}
      </UIText>
      {active && <Ionicons name="checkmark-circle" size={18} color={kit.color.accent} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: { paddingBottom: 0 },
  priorNotice: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 8,
    backgroundColor: kit.color.warnTint,
    marginHorizontal: kit.inset.screen,
    marginBottom: 14,
    padding: 12,
    borderRadius: kit.radius.lg,
  },
  reasonRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 10,
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: kit.color.line,
  },
  reasonRowActive: {
    borderColor: kit.color.accent,
    backgroundColor: kit.color.accentTint,
  },
  reasonRowIcon: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    backgroundColor: kit.color.well,
  },
  reasonRowIconActive: {
    backgroundColor: kit.color.accent,
  },
  noteInput: {
    marginHorizontal: kit.inset.screen,
    marginTop: 8,
    borderWidth: 1,
    borderColor: kit.color.line,
    borderRadius: kit.radius.lg,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    fontSize: 14,
    color: kit.color.ink,
    textAlign: TEXT_START,
  },
  submitWrap: {
    marginHorizontal: kit.inset.screen,
    marginTop: 20,
  },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonGridCell: { width: '48%', marginBottom: 8 },
  priorItem: { marginTop: 8, padding: 10, backgroundColor: kit.color.surface, borderRadius: kit.radius.lg, borderWidth: 1, borderColor: kit.color.line },
});
