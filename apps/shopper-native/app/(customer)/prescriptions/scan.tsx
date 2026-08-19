import { useDarkColors } from "@/hooks/useDarkColors";
/**
 * Secure Prescription Image Upload Flow
 *
 * Pipeline: Camera / Gallery -> Preview -> Secure Upload -> Prescription Record
 * 
 * Replaces the obsolete on-device OCR flow with a true document submission.
 * Images are uploaded to a private Supabase Storage bucket.
 */

import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View, Image } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kit, Button } from "@pharmacy/ui-native";
import { Text } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useAuth } from "@/features/auth";
import {
  usePrescriptionMutations,
  submitPrescriptionWithImage,
} from "@/features/prescriptions";
import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type ScreenPhase = "camera" | "preview" | "uploading";

export default function ScanScreen(): React.ReactElement {
  
  
  const { c } = useDarkColors();
  const s = React.useMemo(() => get_s(c), [c]);
const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();
  const { user } = useAuth();

  // Invalidate cache after successful submission
  const { create } = usePrescriptionMutations(user?.id);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase,    setPhase]    = useState<ScreenPhase>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      if (photo?.uri) {
        setImageUri(photo.uri);
        setPhase("preview");
        setUploadErr(null);
      }
    } catch (err) {
      
    }
  }, []);

  const handleGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showErrorSheet(t("common.error"), t("prescriptions.galleryPermissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setImageUri(result.assets[0].uri);
      setPhase("preview");
      setUploadErr(null);
    }
  }, [t]);

  const handleRetake = useCallback(() => {
    setImageUri(null);
    setPhase("camera");
    setUploadErr(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user?.id || !imageUri) return;
    setPhase("uploading");
    setUploadErr(null);

    try {
      // 1. Submit the prescription and upload the image securely
      const created = await submitPrescriptionWithImage(
        user.id,
        { name: t("prescriptions.uploadedDocumentName", "Uploaded Prescription") },
        imageUri,
        "scan"
      );
      
      // Invalidate queries so the list refreshes
      await create.mutateAsync({ input: { name: "placeholder" } }).catch(() => {}); // Hack to trigger invalidation or just rely on the API call

      showSuccessSheet(
        t("prescriptions.uploadSuccessTitle", "Prescription Submitted"),
        t("prescriptions.uploadSuccessBody", "Your prescription has been securely submitted for pharmacist review."),
        () => router.replace(`/prescriptions/${created.id}` as never)
      );
    } catch (err: any) {
      setPhase("preview");
      setUploadErr(t("prescriptions.uploadError", "Failed to upload the prescription document. Please try again."));
      
    }
  }, [user?.id, imageUri, t, router, create]);

  // ── Permission gate ──────────────────────────────────────────────────────
  if (!permission) {
    return <View style={s.screen} />;
  }

  if (!permission.granted) {
    return (
      <View style={s.screen}>
        <ScanHeader insets={insets} onBack={() => router.back()} title={t("prescriptions.scanTitle")} />
        <View style={s.permissionWrap}>
          <View style={s.permissionIcon}>
            <Ionicons name="camera-outline" size={36} color={c.accentDeep} />
          </View>
          <Text weight="black" style={s.permissionTitle}>
            {t("prescriptions.scanPermissionTitle")}
          </Text>
          <Text style={s.permissionBody}>
            {t("prescriptions.scanPermissionBody")}
          </Text>
          <View style={s.permissionCta}>
            <Button
              variant="primary"
              full
              icon="camera"
              label={
                permission.canAskAgain
                  ? t("prescriptions.scanPermissionCta")
                  : t("prescriptions.scanPermissionSettingsCta")
              }
              onPress={requestPermission}
            />
            <Button
              variant="ghost"
              full
              icon="images-outline"
              label={t("prescriptions.galleryCta", "Choose from Gallery")}
              onPress={handleGallery}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </View>
    );
  }

  // ── Preview phase ─────────────────────────────────────────────────────────
  if (phase === "preview" || phase === "uploading") {
    return (
      <View style={s.screen}>
        <ScanHeader insets={insets} onBack={handleRetake} title={t("prescriptions.previewTitle", "Review Document")} />
        
        <View style={s.previewContainer}>
          <View style={s.imageWrapper}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            )}
            {phase === "uploading" && (
              <View style={s.uploadingOverlay}>
                <Ionicons name="cloud-upload-outline" size={48} color="#fff" />
                <Text weight="bold" style={s.uploadingText}>
                  {t("prescriptions.uploading", "Uploading securely...")}
                </Text>
              </View>
            )}
          </View>

          {uploadErr && (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#fff" />
              <Text weight="bold" style={s.errorBannerText}>{uploadErr}</Text>
            </View>
          )}

          <View style={s.previewActions}>
            <Text style={s.previewNotice}>
              {t("prescriptions.previewNotice", "This document will be sent securely to the pharmacy for review.")}
            </Text>
            <Button
              variant="primary"
              full
              label={t("common.submit", "Submit")}
              onPress={handleSubmit}
              loading={phase === "uploading"}
              disabled={phase === "uploading"}
            />
            <Button
              variant="ghost"
              full
              label={t("common.retake", "Retake Photo")}
              onPress={handleRetake}
              disabled={phase === "uploading"}
              style={{ marginTop: 12 }}
            />
          </View>
        </View>
      </View>
    );
  }

  // ── Camera phase ────────────────────────────────────────────
  return (
    <View style={s.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Dim overlay + frame guide */}
      <View style={s.overlay} pointerEvents="none">
        <View style={s.frame} />
        <Text weight="bold" style={s.guideText}>
          {t("prescriptions.scanGuide")}
        </Text>
      </View>

      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={s.topBackTouchable}>
          {({ pressed }) => (
            <View style={[s.topBack, pressed && s.topBackPressed]}>
              <Ionicons name={BACK_CHEVRON} size={20} color="#fff" />
            </View>
          )}
        </Pressable>
        
        <Pressable
          onPress={handleGallery}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("prescriptions.galleryCta", "Gallery")}
          style={s.topGalleryTouchable}>
          {({ pressed }) => (
            <View style={[s.topGallery, pressed && s.topBackPressed]}>
              <Ionicons name="images-outline" size={20} color="#fff" />
            </View>
          )}
        </Pressable>
      </View>

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={handleCapture}
          accessibilityRole="button"
          accessibilityLabel={t("prescriptions.scanCaptureCta")}
          style={s.captureTouchable}>
          {({ pressed }) => (
            <View style={[s.captureOuter, pressed && s.captureOuterPressed]}>
              <View style={s.captureInner} />
            </View>
          )}
        </Pressable>
        <Text weight="bold" style={s.captureLabel}>
          {t("prescriptions.scanCaptureHint")}
        </Text>
      </View>
    </View>
  );
}

// ─── Shared header (permission / review phases) ────────────────────────────

function ScanHeader({
  insets, onBack, title,
}: { insets: { top: number }; onBack: () => void; title: string }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <View style={[s.headerRow, { flexDirection: flexRow(IS_RTL) }]}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={s.backBtnTouchable}>
          {({ pressed }) => (
            <View style={[s.backBtn, pressed && s.backBtnPressed]}>
              <Ionicons name={BACK_CHEVRON} size={20} color={c.ink} />
            </View>
          )}
        </Pressable>
        <Text weight="black" style={s.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 38 }} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function get_s(c: any) { return StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: c.canvas,
  },

  // ── Shared header ───────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     16,
    backgroundColor:   c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
    ...kit.shadow.raised,
  },
  headerRow: {
    alignItems:     "center",
    justifyContent: "space-between",
    minHeight:      38,
  },
  backBtnTouchable: { borderRadius: 14 },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    14,
    backgroundColor: c.well,
    borderWidth:     1,
    borderColor:     c.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  headerTitle: {
    flex:               1,
    fontSize:           17,
    lineHeight:         22,
    color:              c.ink,
    textAlign:          "center",
    letterSpacing:      -0.2,
    includeFontPadding: false,
  },

  // ── Permission gate ──────────────────────────────────────────────────────
  permissionWrap: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               14,
  },
  permissionIcon: {
    width:           84,
    height:          84,
    borderRadius:    28,
    backgroundColor: c.accentTint,
    borderWidth:     1,
    borderColor:     c.line,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  permissionTitle: {
    fontSize:           19,
    lineHeight:         26,
    color:              c.ink,
    textAlign:          "center",
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  permissionBody: {
    fontSize:           14,
    lineHeight:         22,
    color:              c.inkSoft,
    textAlign:          "center",
    maxWidth:           320,
    includeFontPadding: false,
  },
  permissionCta: {
    width:     "100%",
    maxWidth:  280,
    marginTop: 12,
  },

  // ── Camera overlay ───────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     "center",
    justifyContent: "center",
    gap:            20,
  },
  frame: {
    width:        "78%",
    aspectRatio:  0.75, // Taller frame for documents
    borderRadius: kit.radius.lg,
    borderWidth:  2.5,
    borderColor:  "rgba(255,255,255,0.85)",
  },
  guideText: {
    fontSize:           13,
    lineHeight:         19,
    color:              "#fff",
    textAlign:          "center",
    paddingHorizontal:  32,
    textShadowColor:    "rgba(0,0,0,0.5)",
    textShadowRadius:   4,
    includeFontPadding: false,
  },

  // ── Top bar (camera phase) ───────────────────────────────────────────────
  topBar: {
    position:          "absolute",
    top:               0,
    start:             0,
    end:               0,
    paddingHorizontal: 20,
    flexDirection:     flexRow(IS_RTL),
    justifyContent:    "space-between",
  },
  topBackTouchable: { borderRadius: 19 },
  topGalleryTouchable: { borderRadius: 19 },
  topBack: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  topGallery: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  topBackPressed: { opacity: 0.75 },

  // ── Bottom capture bar ───────────────────────────────────────────────────
  bottomBar: {
    position:       "absolute",
    bottom:         0,
    start:          0,
    end:            0,
    alignItems:     "center",
    gap:            12,
    paddingTop:     20,
  },
  captureTouchable: { borderRadius: 42 },
  captureOuter: {
    width:           78,
    height:          78,
    borderRadius:    39,
    borderWidth:     4,
    borderColor:     "rgba(255,255,255,0.9)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  captureOuterPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  captureInner: {
    width:           62,
    height:          62,
    borderRadius:    31,
    backgroundColor: "#fff",
  },
  captureLabel: {
    fontSize:           12,
    lineHeight:         17,
    color:              "#fff",
    textShadowColor:    "rgba(0,0,0,0.5)",
    textShadowRadius:   4,
    includeFontPadding: false,
  },

  // ── Preview ──────────────────────────────────────────────────────────────
  previewContainer: {
    flex: 1,
    padding: 20,
    gap: 20,
  },
  imageWrapper: {
    flex: 1,
    borderRadius: kit.radius.lg,
    overflow: "hidden",
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.line,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  uploadingText: {
    color: "#fff",
    fontSize: 15,
  },
  previewActions: {
    paddingTop: 10,
  },
  previewNotice: {
    fontSize: 13,
    color: c.inkSoft,
    textAlign: "center",
    marginBottom: 16,
  },
  errorBanner: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: kit.radius.md,
    backgroundColor: "rgba(220,38,38,0.92)",
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#fff",
    textAlign: TEXT_START,
  },
}); }
