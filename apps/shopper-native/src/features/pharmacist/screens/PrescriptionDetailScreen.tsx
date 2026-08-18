import React, { useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, TextInput, View, Image, Dimensions
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation }       from "react-i18next";

import { Screen, Text as UIText, Button, kit } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { flexRow, isRtl } from "@/utils/layout";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

import { usePrescription, usePrescriptionImage } from "../hooks/usePharmacistQueries";
import { usePharmacistMutations }  from "../hooks/usePharmacistMutations";
import { PharmacistScreenHeader }  from "../components/PharmacistScreenHeader";

const IS_RTL     = isRtl();
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function PrescriptionDetailScreen(): React.ReactElement {
  const { t }  = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const rxQuery   = usePrescription(id);
  const mutations = usePharmacistMutations();

  const [rejectionReason,  setRejectionReason]  = useState("");
  const [showRejectForm,   setShowRejectForm]   = useState(false);

  const rx = rxQuery.data;
  const isPending = rx?.reviewStatus === "pending_review";
  const imageQuery = usePrescriptionImage(rx?.imagePath);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await mutations.reviewRx.mutateAsync({ id, input: { reviewStatus: "approved" } });
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
        <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail", "Prescription Detail")} />
        <View style={s.centered}><ActivityIndicator size="large" color={kit.color.accent} /></View>
      </Screen>
    );
  }

  if (!rx) {
    return (
      <Screen edgeTop background={kit.color.canvas}>
        <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail", "Prescription Detail")} />
        <View style={s.centered}>
          <UIText variant="card-title">{t("pharmacist.rxNotFound", "Prescription not found")}</UIText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail", "Prescription Detail")} hideBack={false} />
      
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Document viewer (Takes min 50% height) */}
        <View style={s.imageViewer}>
          {imageQuery.isLoading ? (
            <ActivityIndicator size="large" color={kit.color.accent} />
          ) : imageQuery.error ? (
            <UIText variant="caption" color="danger">{t("pharmacist.rxDocumentError", "Failed to load document")}</UIText>
          ) : imageQuery.data ? (
            <Image
              source={{ uri: imageQuery.data }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
          ) : (
            <UIText variant="caption" color="secondary">{t("pharmacist.noDocument", "No document available")}</UIText>
          )}
        </View>

        <View style={s.content}>
          {/* Patient info */}
          <View style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}>
            <View>
              <UIText variant="body">{rx.customerName}</UIText>
              <UIText variant="caption" color="secondary">
                {new Date(rx.addedAt).toLocaleString()}
              </UIText>
            </View>
            {/* Status */}
            <View style={[s.statusBadge, {
              backgroundColor: rx.reviewStatus === "approved" ? kit.color.successTint :
                               rx.reviewStatus === "rejected" ? kit.color.dangerTint :
                               kit.color.warnTint
            }]}>
              <UIText variant="caption" weight="bold" style={{
                color: rx.reviewStatus === "approved" ? kit.color.success :
                       rx.reviewStatus === "rejected" ? kit.color.danger :
                       kit.color.warn
              }}>
                {rx.reviewStatus === "approved" ? t("pharmacist.rxApproved", "Approved") :
                 rx.reviewStatus === "rejected" ? t("pharmacist.rxRejected", "Rejected") :
                 t("pharmacist.rxPending", "Pending")}
              </UIText>
            </View>
          </View>

          {/* Pharmacist note */}
          {rx.adminNotes ? (
            <View style={s.noteBox}>
              <UIText variant="caption" weight="bold">{t("pharmacist.adminNotes", "Pharmacist Note")}</UIText>
              <UIText variant="body-sm">{rx.adminNotes}</UIText>
            </View>
          ) : null}

          {/* Reject Reason */}
          {rx.rejectionReason ? (
            <View style={[s.noteBox, { backgroundColor: kit.color.dangerTint }]}>
              <UIText variant="caption" weight="bold" color="danger">{t("pharmacist.rejectionReason", "Rejection Reason")}</UIText>
              <UIText variant="body-sm" color="danger">{rx.rejectionReason}</UIText>
            </View>
          ) : null}

          {/* Actions */}
          {isPending && (
            <View style={s.actions}>
              {!showRejectForm ? (
                <>
                  <Button
                    label={t("pharmacist.actionApproveRx", "Approve")}
                    full
                    loading={mutations.reviewRx.isPending}
                    onPress={handleApprove}
                    style={{ backgroundColor: kit.color.success }}
                  />
                  {/* Request Info button can be added if backend supports it */}
                  <Button
                    label={t("pharmacist.actionRejectRx", "Reject")}
                    variant="outline"
                    full
                    onPress={() => setShowRejectForm(true)}
                    style={{ borderColor: kit.color.danger }}
                  />
                </>
              ) : (
                <>
                  <TextInput
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    placeholder={t("pharmacist.rejectionReasonPlaceholder", "Reason for rejection")}
                    placeholderTextColor={kit.color.inkFaint}
                    multiline
                    style={s.textInput}
                  />
                  <Button
                    label={t("pharmacist.confirmReject", "Confirm Reject")}
                    full
                    loading={mutations.reviewRx.isPending}
                    onPress={handleReject}
                    style={{ backgroundColor: kit.color.danger }}
                  />
                  <Button
                    label={t("common.cancel", "Cancel")}
                    variant="ghost"
                    full
                    onPress={() => setShowRejectForm(false)}
                  />
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 60, flexGrow: 1 },
  centered: { alignItems: "center", justifyContent: "center", flex: 1 },
  imageViewer: {
    width: "100%",
    minHeight: SCREEN_HEIGHT * 0.5,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: kit.inset.screen,
    backgroundColor: kit.color.surface,
    flex: 1,
  },
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: kit.radius.pill,
  },
  noteBox: {
    backgroundColor: kit.color.well,
    padding: 12,
    borderRadius: kit.radius.md,
    marginTop: 12,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  textInput: {
    backgroundColor: kit.color.well,
    borderRadius: kit.radius.md,
    borderWidth: 1,
    borderColor: kit.color.danger,
    padding: 12,
    fontSize: 14,
    fontFamily: theme.fonts.regular,
    color: kit.color.ink,
    textAlignVertical: "top",
    minHeight: 80,
  },
});
