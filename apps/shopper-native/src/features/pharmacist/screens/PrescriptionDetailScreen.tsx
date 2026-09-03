import React, { useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, View, Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Screen, Text as UIText, Button, Input, kit } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";
import { formatRxDateTime } from "../lib/formatRxDate";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

import { usePrescription, usePrescriptionImage } from "../hooks/usePharmacistQueries";
import { usePharmacistMutations } from "../hooks/usePharmacistMutations";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";
import { getPharmacistActionErrorMessage } from "../lib/errorMessage";

const IS_RTL = isRtl();
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAX_SCALE = 4;

// ─── ZoomableImage — pinch/pan document viewer for verifying prescriptions ────

function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) reset();
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value <= 1) return;
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composed = Gesture.Simultaneous(Gesture.Race(doubleTap, pan), pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={StyleSheet.absoluteFill}>
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, animatedStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

// ─── Status meta ────────────────────────────────────────────────────────────

function statusMeta(status: string, theme: ReturnType<typeof useTheme>["theme"]) {
  if (status === "approved") return { color: theme.colors.status.success, labelKey: "pharmacist.rxApproved" };
  if (status === "rejected") return { color: theme.colors.status.error, labelKey: "pharmacist.rxRejected" };
  return { color: theme.colors.status.warning, labelKey: "pharmacist.rxPending" };
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export function PrescriptionDetailScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const rxQuery = usePrescription(id);
  const mutations = usePharmacistMutations();

  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [adminNotesInput, setAdminNotesInput] = useState("");
  const [rejectionTouched, setRejectionTouched] = useState(false);

  const rejectionReasonInvalid = rejectionTouched && rejectionReason.trim().length === 0;

  const rx = rxQuery.data;
  const isPending = rx?.reviewStatus === "pending_review";
  const imageQuery = usePrescriptionImage(rx?.imagePath);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await mutations.reviewRx.mutateAsync({
        id,
        input: { reviewStatus: "approved", adminNotes: adminNotesInput.trim() || undefined },
      });
      showSuccessSheet(t("pharmacist.rxApprovedTitle"), t("pharmacist.rxApprovedBody"));
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), getPharmacistActionErrorMessage(e, t, t("pharmacist.actionFailedBody")));
    }
  };

  const handleReject = async () => {
    if (!id) return;
    // The review_prescription RPC hard-requires a non-empty rejection reason
    // (raises rejection_reason_required) — catch it here with a friendly
    // inline message instead of letting a raw Postgres error surface.
    if (rejectionReason.trim().length === 0) {
      setRejectionTouched(true);
      return;
    }
    try {
      await mutations.reviewRx.mutateAsync({
        id,
        input: {
          reviewStatus: "rejected",
          rejectionReason: rejectionReason.trim(),
          adminNotes: adminNotesInput.trim() || undefined,
        },
      });
      showSuccessSheet(t("pharmacist.rxRejectedTitle"), t("pharmacist.rxRejectedBody"));
      setShowRejectForm(false);
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), getPharmacistActionErrorMessage(e, t, t("pharmacist.actionFailedBody")));
    }
  };

  if (rxQuery.isLoading) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail", "Prescription Detail")} />
        <View style={s.centered}><ActivityIndicator size="large" color={theme.colors.brand.primary} /></View>
      </Screen>
    );
  }

  if (!rx) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail", "Prescription Detail")} />
        <View style={s.centered}>
          <UIText variant="card-title">{t("pharmacist.rxNotFound", "Prescription not found")}</UIText>
        </View>
      </Screen>
    );
  }

  const meta = statusMeta(rx.reviewStatus, theme);

  return (
    <Screen edgeTop background={theme.colors.canvas.background}>
      <PharmacistScreenHeader title={t("pharmacist.prescriptionDetail", "Prescription Detail")} hideBack={false} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Document Viewer — pinch/pan/double-tap to inspect handwriting closely */}
        <View style={[s.imageBoxer, { backgroundColor: theme.colors.pharmacy.navy }]}>
          {imageQuery.isLoading ? (
            <ActivityIndicator size="large" color={theme.colors.brand.primary} />
          ) : imageQuery.error ? (
            <UIText variant="caption" color="danger">{t("pharmacist.rxDocumentError", "Failed to load document")}</UIText>
          ) : imageQuery.data ? (
            <ZoomableImage uri={imageQuery.data} />
          ) : (
            <UIText variant="caption" color="secondary">{t("pharmacist.noDocument", "No document available")}</UIText>
          )}
          {imageQuery.data && (
            <View style={s.zoomHint} pointerEvents="none">
              <UIText variant="caption" style={{ color: "rgba(255,255,255,0.72)" }}>{t("pharmacist.pinchToZoom")}</UIText>
            </View>
          )}
        </View>

        <Animated.View entering={FadeIn.duration(240)} style={[s.content, { backgroundColor: theme.colors.canvas.surface }]}>
          {/* Patient info */}
          <View style={[s.row, { flexDirection: flexRow(IS_RTL), justifyContent: "space-between", marginBottom: 12 }]}>
            <View style={{ flex: 1, minWidth: 0, marginEnd: 8 }}>
              <UIText variant="body" numberOfLines={1}>{rx.customerName}</UIText>
              <UIText variant="caption" color="secondary">
                {formatRxDateTime(rx.addedAt ?? rx.createdAt, i18n.language === "ar" ? "ar-EG" : "en-US")}
              </UIText>
            </View>
            <View style={[s.statusBadge, { backgroundColor: `${meta.color}1A`, flexShrink: 0 }]}>
              <UIText variant="caption" weight="bold" style={{ color: meta.color }}>
                {t(meta.labelKey, meta.labelKey)}
              </UIText>
            </View>
          </View>

          {/* Pharmacist note */}
          {rx.adminNotes ? (
            <View style={[s.noteBox, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
              <UIText variant="caption" weight="bold">{t("pharmacist.adminNotes", "Pharmacist Note")}</UIText>
              <UIText variant="body-sm">{rx.adminNotes}</UIText>
            </View>
          ) : null}

          {/* Reject Reason */}
          {rx.rejectionReason ? (
            <View style={[s.noteView, { backgroundColor: `${theme.colors.status.error}1A` }]}>
              <UIText variant="caption" weight="bold" color="danger">{t("pharmacist.rejectionReason", "Rejection Reason")}</UIText>
              <UIText variant="body-sm" color="danger">{rx.rejectionReason}</UIText>
            </View>
          ) : null}

          {/* Actions */}
          {isPending && (
            <View style={s.actions}>
              <Input
                value={adminNotesInput}
                onChangeText={setAdminNotesInput}
                placeholder={t("pharmacist.adminNotesPlaceholder", "Add a note for this review (optional)")}
                multiline
                style={s.textInput}
              />
              {!showRejectForm ? (
                <>
                  <Button
                    label={t("pharmacist.actionApproveRx", "Approve")}
                    full
                    loading={mutations.reviewRx.isPending}
                    onPress={handleApprove}
                  />
                  <Button
                    label={t("pharmacist.actionRejectRx", "Reject")}
                    variant="outline"
                    full
                    onPress={() => setShowRejectForm(true)}
                  />
                </>
              ) : (
                <>
                  <Input
                    value={rejectionReason}
                    onChangeText={(v) => { setRejectionReason(v); if (rejectionTouched) setRejectionTouched(false); }}
                    placeholder={t("pharmacist.rejectionReasonPlaceholder", "Reason for rejection")}
                    multiline
                    style={s.textInput}
                  />
                  {rejectionReasonInvalid ? (
                    <UIText variant="caption" color="danger">
                      {t("pharmacist.rejectionReasonRequired", "A rejection reason is required.")}
                    </UIText>
                  ) : null}
                  <Button
                    label={t("pharmacist.confirmReject", "Confirm Reject")}
                    full
                    loading={mutations.reviewRx.isPending}
                    onPress={handleReject}
                    variant="danger"
                  />
                  <Button
                    label={t("common.cancel", "Cancel")}
                    variant="ghost"
                    full
                    onPress={() => { setShowRejectForm(false); setRejectionTouched(false); }}
                  />
                </>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: 60, flexGrow: 1 },
  centered: { alignItems: "center", justifyContent: "center", flex: 1 },
  imageBoxer: {
    width: "100%",
    minHeight: SCREEN_HEIGHT * 0.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zoomHint: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  content: {
    padding: kit.inset.screen,
    flex: 1,
  },
  row: {
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  noteBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  noteView: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  textInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
});
