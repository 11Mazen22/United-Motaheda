/**
 * PrescriptionDetailScreen — pharmacist review of a single prescription.
 * Shows patient name, Rx details, submission source, and approve/reject actions.
 */
import React, { useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, TextInput, View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons }             from "@expo/vector-icons";
import { useTranslation }       from "react-i18next";

import { Screen, Text as UIText }  from "@pharmacy/ui-native";
import { Button, kit }             from "@pharmacy/ui-native";
import { theme }                   from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

import { usePrescription }         from "../hooks/usePharmacistQueries";
import { usePharmacistMutations }  from "../hooks/usePharmacistMutations";
import { PharmacistScreenHeader }  from "../components/PharmacistScreenHeader";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function PrescriptionDetailScreen(): React.ReactElement {
  const { t }  = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const rxQuery   = usePrescription(id);
  const mutations = usePharmacistMutations();

  const [adminNotes,       setAdminNotes]       = useState("");
  const [rejectionReason,  setRejectionReason]  = useState("");
  const [showRejectForm,   setShowRejectForm]   = useState(false);

  const rx = rxQuery.data;
  const isPending = rx?.reviewStatus === "pending_review";

  const handleApprove = async () => {
    if (!id) return;
    try {
      await mutations.reviewRx.mutateAsync({ id, input: { reviewStatus: "approved", adminNotes: adminNotes || undefined } });
      showSuccessSheet(t("pharmacist.rxApprovedTitle"), t("pharmacist.rxApprovedBody"));
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  const handleReject = async () => {
    if (!id) return;
    try {
      await mutations.reviewRx.mutateAsync({
        id,
        input: {
          reviewStatus:    "rejected",
          adminNotes:       adminNotes      || undefined,
          rejectionReason:  rejectionReason || undefined,
        },
      });
      showSuccessSheet(t("pharmacist.rxRejectedTitle"), t("pharmacist.rxRejectedBody"));
      setShowRejectForm(false);
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), e instanceof Error ? e.message : "");
    }
  };

  if (rxQuery.isLoading) {
    return (
      <Screen edgeTop background={kit.color.canvas}>
        <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail")} />
        <View style={s.centered}><ActivityIndicator size="large" color={kit.color.accent} /></View>
      </Screen>
    );
  }

  if (!rx) {
    return (
      <Screen edgeTop background={kit.color.canvas}>
        <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail")} />
        <View style={s.centered}>
          <UIText variant="card-title">{t("pharmacist.rxNotFound")}</UIText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail")} subtitle={rx.customerName} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Status banner */}
        <View style={[
          s.statusBanner,
          { backgroundColor:
            rx.reviewStatus === "approved" ? kit.color.successTint :
            rx.reviewStatus === "rejected" ? kit.color.dangerTint :
            kit.color.warnTint }
        ]}>
          <Ionicons
            name={rx.reviewStatus === "approved" ? "checkmark-circle" : rx.reviewStatus === "rejected" ? "close-circle" : "time"}
            size={18}
            color={rx.reviewStatus === "approved" ? kit.color.success : rx.reviewStatus === "rejected" ? kit.color.danger : kit.color.warn}
          />
          <UIText variant="body-sm" weight="bold" style={{
            color: rx.reviewStatus === "approved" ? kit.color.success : rx.reviewStatus === "rejected" ? kit.color.danger : kit.color.warn,
            flex: 1,
          }}>
            {rx.reviewStatus === "approved" ? t("pharmacist.rxApproved") : rx.reviewStatus === "rejected" ? t("pharmacist.rxRejected") : t("pharmacist.rxPending")}
          </UIText>
        </View>

        {/* Details card */}
        <View style={s.card}>
          {[
            { label: t("pharmacist.rxName"),    value: rx.name    },
            { label: t("pharmacist.rxDose"),    value: rx.dose    },
            { label: t("pharmacist.rxDoctor"),  value: rx.doctor  },
            { label: t("pharmacist.rxNumber"),  value: rx.rxNumber ?? "—" },
            { label: t("pharmacist.rxRefills"), value: String(rx.refills) },
            { label: t("pharmacist.rxSource"),  value: rx.submissionSource },
            { label: t("pharmacist.rxDate"),    value: new Date(rx.addedAt).toLocaleString() },
          ].map(({ label, value }) => (
            <View key={label} style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>
              <UIText variant="body-sm" color="secondary" style={{ flex: 1, textAlign: TEXT_START }}>{label}</UIText>
              <UIText variant="body-sm" weight="bold" style={{ maxWidth: "55%", textAlign: TEXT_START }}>{value || "—"}</UIText>
            </View>
          ))}
          {rx.rejectionReason ? (
            <View style={s.rejectionRow}>
              <UIText variant="caption" color="danger">{t("pharmacist.rejectionReason")}: {rx.rejectionReason}</UIText>
            </View>
          ) : null}
          {rx.adminNotes ? (
            <View style={s.notesRow}>
              <UIText variant="caption" color="secondary">{t("pharmacist.adminNotes")}: {rx.adminNotes}</UIText>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        {isPending && (
          <View style={s.actions}>
            <TextInput
              value={adminNotes}
              onChangeText={setAdminNotes}
              placeholder={t("pharmacist.adminNotesPlaceholder")}
              placeholderTextColor={kit.color.inkFaint}
              multiline
              numberOfLines={3}
              style={s.textInput}
            />
            <Button
              label={t("pharmacist.actionApproveRx")}
              icon="checkmark-circle-outline"
              full
              loading={mutations.reviewRx.isPending}
              onPress={() => void handleApprove()}
            />
            {!showRejectForm ? (
              <Button
                label={t("pharmacist.actionRejectRx")}
                icon="close-circle-outline"
                variant="ghost"
                full
                onPress={() => setShowRejectForm(true)}
              />
            ) : (
              <>
                <TextInput
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  placeholder={t("pharmacist.rejectionReasonPlaceholder")}
                  placeholderTextColor={kit.color.inkFaint}
                  multiline
                  numberOfLines={2}
                  style={[s.textInput, { borderColor: kit.color.danger }]}
                />
                <Button
                  label={t("pharmacist.confirmReject")}
                  variant="ghost"
                  full
                  loading={mutations.reviewRx.isPending}
                  onPress={() => void handleReject()}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll:  { paddingBottom: 60 },
  centered:{ alignItems: "center", justifyContent: "center", flex: 1 },
  statusBanner: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    gap:             10,
    marginHorizontal:kit.inset.screen,
    marginTop:       16,
    padding:         14,
    borderRadius:    kit.radius.xl,
  },
  card: {
    marginHorizontal: kit.inset.screen,
    marginTop:        14,
    backgroundColor:  kit.color.surface,
    borderRadius:     kit.radius.xl,
    padding:          kit.inset.card,
    gap:              10,
    borderWidth:      1,
    borderColor:      kit.color.line,
    ...kit.shadow.card,
  },
  row: {
    alignItems:     "flex-start",
    gap:            12,
    paddingVertical: 4,
  },
  rejectionRow: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  notesRow: {
    paddingTop: 4,
  },
  actions: {
    marginHorizontal: kit.inset.screen,
    marginTop:        18,
    gap:              10,
  },
  textInput: {
    backgroundColor:   kit.color.well,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    padding:           12,
    fontSize:          14,
    fontFamily:        theme.fonts.regular,
    color:             kit.color.ink,
    textAlignVertical: "top",
    minHeight:         72,
  },
});
