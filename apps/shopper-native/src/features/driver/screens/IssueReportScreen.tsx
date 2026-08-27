/**
 * IssueReportScreen — reason-chip picker + note, submits to delivery_issues.
 * Shows the driver's own prior reports for this order so they don't silently
 * submit a duplicate.
 */
import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText, Input, useTheme } from "@pharmacy/ui-native";
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
  const { theme } = useTheme();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuth();
  const [selected, setSelected] = useState<IssueReasonCode | null>(null);
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const priorIssuesQuery = useMyIssuesForOrder(orderId, user?.id);
  const mutations = useDriverMutations(user?.id);

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showErrorSheet(t("driver.actionFailedTitle"), t("driver.photoPermissionRequired", "Photo library access is required to attach a photo."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  };

  const s = useMemo(() => StyleSheet.create({
    content: { paddingBottom: 0 },
    priorNotice: {
      flexDirection: flexRow(IS_RTL),
      alignItems: "center",
      gap: 8,
      backgroundColor: `${theme.colors.status.warning}1A`,
      marginHorizontal: kit.inset.screen,
      marginBottom: 14,
      padding: 12,
      borderRadius: 12,
    },
    noteInputContainer: {
      marginHorizontal: kit.inset.screen,
      marginTop: 8,
    },
    noteInput: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    submitWrap: {
      marginHorizontal: kit.inset.screen,
      marginTop: 20,
    },
    reasonGrid: { flexDirection: flexRow(IS_RTL), flexWrap: 'wrap', gap: 8 },
    reasonGridCell: { width: '48%', marginBottom: 8 },
    priorItem: { marginTop: 8, padding: 10, backgroundColor: theme.colors.canvas.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border.default },
    photoPicker: {
      flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10,
      marginHorizontal: kit.inset.screen, marginTop: 10,
      padding: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: theme.colors.border.default,
    },
    photoPickerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.canvas.surfaceMuted },
    photoPreviewWrap: { marginHorizontal: kit.inset.screen, marginTop: 10, borderRadius: 12, overflow: "hidden" },
    photoPreview: { width: "100%", height: 160, borderRadius: 12 },
    photoRemoveBtn: { position: "absolute", top: 8, end: 8, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
  }), [theme]);

  const handleSubmit = async () => {
    if (!orderId || !selected) return;
    try {
      await mutations.report.mutateAsync({ orderId, reasonCode: selected, note: note.trim() || undefined, photoUri: photoUri ?? undefined });
      showSuccessSheet(t("driver.issueReportedTitle"), t("driver.issueReportedBody"), () => router.back());
    } catch (e) {
      showErrorSheet(t("driver.actionFailedTitle"), e instanceof Error ? e.message : t("driver.actionFailedBody"));
    }
  };

  const priorOpen = (priorIssuesQuery.data ?? []).find((i) => i.status !== "resolved");

  return (
    <Screen edgeTop keyboardAvoiding background={theme.colors.canvas.background} contentStyle={s.content}>
      <DriverScreenHeader title={t("driver.reportIssueTitle")} subtitle={t("driver.whatWentWrong")} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {priorOpen && (
          <View style={s.priorNotice}>
            <Ionicons name="information-circle" size={18} color={theme.colors.status.warning} />
            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START, color: theme.colors.status.warning }}>
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
        <Input
          value={note}
          onChangeText={setNote}
          placeholder={t("driver.additionalNotesPlaceholder")}
          multiline
          numberOfLines={4}
          containerStyle={s.noteInputContainer}
          style={s.noteInput}
        />

        {photoUri ? (
          <View style={s.photoPreviewWrap}>
            <Image source={{ uri: photoUri }} style={s.photoPreview} resizeMode="cover" />
            <Pressable onPress={() => setPhotoUri(null)} style={s.photoRemoveBtn} accessibilityRole="button" accessibilityLabel={t("common.remove", "Remove")}>
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => void handlePickPhoto()} style={s.photoPicker} accessibilityRole="button">
            <View style={s.photoPickerIcon}><Ionicons name="camera-outline" size={18} color={theme.colors.text.secondary} /></View>
            <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, flex: 1 }}>
              {t("driver.attachPhoto", "Attach a photo (optional)")}
            </UIText>
          </Pressable>
        )}

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
                <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6 }}>
                  <UIText variant="body-sm" style={{ flex: 1 }}>{t(REASONS.find((r) => r.code === p.reasonCode)?.labelKey ?? "driver.reasonOther")}</UIText>
                  {p.photoUrl ? <Ionicons name="camera-outline" size={14} color={theme.colors.text.muted} /> : null}
                </View>
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
      borderColor: theme.colors.brand.primary,
      backgroundColor: theme.colors.brand.primaryLight,
    },
    reasonRowIcon: {
      width: 30, height: 30, borderRadius: 15,
      alignItems: "center", justifyContent: "center",
      backgroundColor: theme.colors.canvas.surfaceMuted,
    },
    reasonRowIconActive: {
      backgroundColor: theme.colors.brand.primary,
    },
  }), [theme]);

  return (
    <Pressable onPress={onPress} style={[s.reasonRow, active && s.reasonRowActive]}>
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
      {active && <Ionicons name="checkmark-circle" size={18} color={theme.colors.brand.primary} />}
    </Pressable>
  );
}
