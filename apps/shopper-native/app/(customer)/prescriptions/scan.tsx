import { useTheme, type NativeTheme } from "@pharmacy/ui-native";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Linking, Platform, Pressable, StyleSheet, View, Image } from "react-native";

import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";

import { CameraView, useCameraPermissions } from "@/shared/camera";

import * as ImagePicker from "expo-image-picker";

import * as Haptics from "expo-haptics";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useTranslation } from "react-i18next";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomerUI } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

import { useAuth } from "@/features/auth";

import { submitPrescriptionWithImage } from "@/features/prescriptions";

import { PrescriptionsHeader } from "@/features/prescriptions/components/PrescriptionsHeader";

import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";



const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);



type ScreenPhase = "camera" | "preview" | "uploading";



export default function ScanScreen(): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();
  const { user } = useAuth();



  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase,    setPhase]    = useState<ScreenPhase>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      if (photo?.uri) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setImageUri(photo.uri);
        setPhase("preview");
        setUploadErr(null);
      }
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, []);

  const handleGallery = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showErrorSheet(t("common.error"), t("prescriptions.galleryPermissionDenied", "Gallery access is needed to choose a photo."));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
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
      const created = await submitPrescriptionWithImage(
        user.id,
        { name: t("prescriptions.uploadedDocumentName", "Uploaded Prescription") },
        imageUri,
        "scan",
      );
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showSuccessSheet(
        t("prescriptions.uploadSuccessTitle", "Prescription Submitted"),
        t("prescriptions.uploadSuccessBody", "Your prescription has been securely submitted for pharmacist review."),
        () => router.replace(`/prescriptions/${created.id}` as never),
      );
    } catch {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPhase("preview");
      setUploadErr(t("prescriptions.uploadError", "Failed to upload the prescription document. Please try again."));
    }
  }, [user?.id, imageUri, t, router]);

  if (!permission) return <View style={s.screen} />;

  if (!permission.granted) {
    return (
      <View style={s.screen}>
        <ScanHeader insets={insets} onBack={() => router.back()} title={t("prescriptions.scanTitle")} />
        <View style={s.permissionWrap}>
          <View style={s.permissionIcon}>
            <Ionicons name="camera-outline" size={36} color={theme.colors.brand.primary} />
          </View>
          <Text weight="black" style={s.permissionTitle}>
            {t("prescriptions.scanPermissionTitle")}
          </Text>
          <Text style={s.permissionBody}>
            {t("prescriptions.scanPermissionBody")}
          </Text>
          <View style={s.permissionCta}>
            <CustomerUI.Button
              label={permission.canAskAgain
                ? t("prescriptions.scanPermissionCta")
                : t("prescriptions.scanPermissionSettingsCta")}
              onPress={permission.canAskAgain ? requestPermission : () => { void Linking.openSettings(); }}
              fullWidth
              icon={<Ionicons name="camera" size={18} color="#fff" />}
            />
            <View style={{ height: 12 }} />
            <CustomerUI.Button
              label={t("prescriptions.galleryCta", "Choose from Gallery")}
              onPress={handleGallery}
              variant="ghost"
              fullWidth
              icon={<Ionicons name="images-outline" size={18} color={theme.colors.brand.primary} />}
            />
          </View>
        </View>
      </View>
    );
  }

  if (phase === "preview" || phase === "uploading") {
    return (
      <View style={s.screen}>
        <ScanHeader insets={insets} onBack={handleRetake} title={t("prescriptions.previewTitle", "Review Document")} />
        <View style={s.previewContainer}>
          <Animated.View entering={FadeIn.duration(260)} style={[s.imageWrapper, theme.shadows[2]]}>
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
          </Animated.View>

          {uploadErr && (
            <Animated.View entering={FadeInDown.duration(240)} style={s.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#fff" />
              <Text weight="bold" style={s.errorBannerText}>{uploadErr}</Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(280).delay(80)} style={s.previewActions}>
            <View style={[s.previewNoticeRow, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.brand.primary} />
              <Text style={s.previewNotice}>
                {t("prescriptions.previewNotice", "This document will be sent securely to the pharmacy for review.")}
              </Text>
            </View>
            <CustomerUI.Button
              label={t("common.submit", "Submit")}
              onPress={handleSubmit}
              loading={phase === "uploading"}
              disabled={phase === "uploading"}
              fullWidth
              icon={<Ionicons name="checkmark" size={18} color="#fff" />}
            />
            <View style={{ height: 12 }} />
            <CustomerUI.Button
              label={t("common.retake", "Retake Photo")}
              onPress={handleRetake}
              variant="ghost"
              disabled={phase === "uploading"}
              fullWidth
            />
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <View style={s.overlay} pointerEvents="none">
        <ScanFrame theme={theme} />
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
              <View style={[s.captureInner, { backgroundColor: theme.colors.brand.primary }]}>
                <Ionicons name="camera" size={26} color="#fff" />
              </View>
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



// ─── ScanFrame — document-scanner corner brackets + sweeping scan line ────────
// Replaces the earlier plain rounded rectangle: a real document scanner
// (banking check-deposit, ID scanners) reads as "actively scanning" through
// corner brackets and motion, not a static outline — the frame alone gave no
// feedback that anything was happening while a customer lined up the shot.

function ScanFrame({ theme }: { theme: NativeTheme }): React.ReactElement {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [sweep]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * FRAME_HEIGHT }],
    opacity: 0.85,
  }));

  return (
    <View style={f.wrap}>
      <View style={f.corner__topStart} />
      <View style={f.corner__topEnd} />
      <View style={f.corner__bottomStart} />
      <View style={f.corner__bottomEnd} />
      <View style={f.clip} pointerEvents="none">
        <Animated.View style={[f.sweepLine, { backgroundColor: theme.colors.brand.primary }, lineStyle]} />
      </View>
    </View>
  );
}

const FRAME_HEIGHT = 300;
const CORNER_LEN = 34;
const CORNER_W = 4;

const f = StyleSheet.create({
  wrap: { width: "78%", aspectRatio: 0.75, height: FRAME_HEIGHT },
  clip: { ...StyleSheet.absoluteFillObject, borderRadius: 14, overflow: "hidden" },
  sweepLine: { position: "absolute", top: 0, start: 0, end: 0, height: 2.5, shadowColor: "#fff", shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  corner__topStart:    { position: "absolute", top: 0, start: 0, width: CORNER_LEN, height: CORNER_LEN, borderColor: "#fff", borderStartWidth: CORNER_W, borderTopWidth: CORNER_W, borderTopStartRadius: 14 },
  corner__topEnd:      { position: "absolute", top: 0, end: 0, width: CORNER_LEN, height: CORNER_LEN, borderColor: "#fff", borderEndWidth: CORNER_W, borderTopWidth: CORNER_W, borderTopEndRadius: 14 },
  corner__bottomStart: { position: "absolute", bottom: 0, start: 0, width: CORNER_LEN, height: CORNER_LEN, borderColor: "#fff", borderStartWidth: CORNER_W, borderBottomWidth: CORNER_W, borderBottomStartRadius: 14 },
  corner__bottomEnd:   { position: "absolute", bottom: 0, end: 0, width: CORNER_LEN, height: CORNER_LEN, borderColor: "#fff", borderEndWidth: CORNER_W, borderBottomWidth: CORNER_W, borderBottomEndRadius: 14 },
});

function ScanHeader({
  insets, onBack, title,
}: { insets: { top: number }; onBack: () => void; title: string }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <PrescriptionsHeader
      insetsTop={insets.top}
      icon="scan-outline"
      eyebrow={t("prescriptions.headerEyebrow")}
      title={title}
      onBack={onBack}
    />
  );
}



function get_s(theme: NativeTheme) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },
  header: {
    paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
    ...theme.shadows[1],
  },
  headerRow: { alignItems: "center", justifyContent: "space-between", minHeight: 38 },
  backBtnTouchable: { borderRadius: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center",
  },
  backBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  headerTitle: {
    flex: 1, fontSize: 17, lineHeight: 22, color: theme.colors.text.primary,
    textAlign: "center", letterSpacing: -0.2, includeFontPadding: false,
  },
  permissionWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 14,
  },
  permissionIcon: {
    width: 84, height: 84, borderRadius: 28,
    backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  permissionTitle: {
    fontSize: 19, lineHeight: 26, color: theme.colors.text.primary,
    textAlign: "center", letterSpacing: -0.3, includeFontPadding: false,
  },
  permissionBody: {
    fontSize: 14, lineHeight: 22, color: theme.colors.text.secondary,
    textAlign: "center", maxWidth: 320, includeFontPadding: false,
  },
  permissionCta: { width: "100%", maxWidth: 280, marginTop: 12 },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 20 },
  guideText: {
    fontSize: 13, lineHeight: 19, color: "#fff",
    textAlign: "center", paddingHorizontal: 32,
    textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4,
    includeFontPadding: false,
  },
  topBar: {
    position: "absolute", top: 0, start: 0, end: 0,
    paddingHorizontal: 20, flexDirection: flexRow(IS_RTL), justifyContent: "space-between",
  },
  topBackTouchable: { borderRadius: 19 },
  topGalleryTouchable: { borderRadius: 19 },
  topBack: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  topGallery: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  topBackPressed: { opacity: 0.75 },
  bottomBar: {
    position: "absolute", bottom: 0, start: 0, end: 0,
    alignItems: "center", gap: 12, paddingTop: 20,
  },
  captureTouchable: { borderRadius: 42 },
  captureOuter: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 4, borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center", justifyContent: "center",
  },
  captureOuterPressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  captureInner: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center" },
  captureLabel: {
    fontSize: 12, lineHeight: 17, color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4,
    includeFontPadding: false,
  },
  previewContainer: { flex: 1, padding: 20, gap: 20 },
  imageWrapper: {
    flex: 1, borderRadius: 12, overflow: "hidden",
    backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  uploadingText: { color: "#fff", fontSize: 15 },
  previewActions: { paddingTop: 10 },
  previewNoticeRow: {
    alignItems: "center", justifyContent: "center", gap: 6,
    marginBottom: 16,
  },
  previewNotice: {
    fontSize: 13, color: theme.colors.text.secondary, textAlign: "center",
    includeFontPadding: false, flexShrink: 1,
  },
  errorBanner: {
    flexDirection: flexRow(IS_RTL), alignItems: "center",
    gap: 8, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 8, backgroundColor: "rgba(220,38,38,0.92)",
  },
  errorBannerText: { flex: 1, fontSize: 13, color: "#fff", textAlign: TEXT_START },
}); }
