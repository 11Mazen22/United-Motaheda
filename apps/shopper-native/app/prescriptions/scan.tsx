/**
 * Camera scan flow — real implementation.
 *
 * Pipeline: camera viewfinder -> capture -> on-device ML Kit text
 * recognition -> parseRxText() heuristic field extraction -> OcrReviewForm
 * for user confirmation -> submit as a real prescription (review_status
 * 'pending_review', submission_source 'scan').
 *
 * Privacy: the captured photo is processed on-device only and never
 * uploaded or persisted anywhere — matching this app's existing camera
 * permission string ("text is extracted on your device only — we do not
 * upload or save images"). Only the extracted structured fields are saved.
 *
 * Known limitation: @react-native-ml-kit/text-recognition wraps Google's
 * on-device Text Recognition v2, which supports Latin/Chinese/Devanagari/
 * Japanese/Korean scripts — it does NOT support Arabic script recognition.
 * This flow works reliably for English-labeled prescriptions; Arabic-only
 * labels may not be recognized. There is no on-device Arabic OCR option in
 * this library — a real fix would require a different (likely cloud-based)
 * OCR engine, out of scope here.
 */

import React, { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
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
  parseRxText,
  OcrReviewForm,
  type OcrResult,
  type ParsedRx,
  type OcrReviewFormSubmit,
} from "@/features/prescriptions";
import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type ScreenPhase = "camera" | "processing" | "review";

export default function ScanScreen(): React.ReactElement {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();
  const { user } = useAuth();
  const { create } = usePrescriptionMutations(user?.id);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase,   setPhase]   = useState<ScreenPhase>("camera");
  const [parsed,  setParsed]  = useState<ParsedRx | null>(null);
  const [scanErr, setScanErr] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;
    setPhase("processing");
    setScanErr(false);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: true });
      if (!photo?.uri) throw new Error("no-uri");

      const recognized = await TextRecognition.recognize(photo.uri, TextRecognitionScript.LATIN);
      const ocrResult: OcrResult = {
        rawText: recognized.text,
        blocks:  recognized.blocks.map((b) => ({
          text:  b.text,
          lines: b.lines.map((l) => l.text),
        })),
      };

      setParsed(parseRxText(ocrResult));
      setPhase("review");
    } catch {
      setScanErr(true);
      setPhase("camera");
    }
  }, []);

  const handleRescan = useCallback(() => {
    setParsed(null);
    setPhase("camera");
  }, []);

  const handleSubmit = useCallback(async (final: OcrReviewFormSubmit) => {
    try {
      const created = await create.mutateAsync({
        input:  { name: final.name, dose: final.dose, doctor: final.doctor, rxNumber: final.rxNumber, refills: final.refills },
        source: "scan",
      });
      showSuccessSheet(
        t("prescriptions.manualSavedTitle"),
        t("prescriptions.manualSavedBody"),
        () => router.replace(`/prescriptions/${created.id}` as never),
      );
    } catch {
      showErrorSheet(t("prescriptions.manualSaveErrorTitle"), t("prescriptions.manualSaveErrorBody"));
    }
  }, [create, router, t]);

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
            <Ionicons name="camera-outline" size={36} color={kit.color.accentDeep} />
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
          </View>
        </View>
      </View>
    );
  }

  // ── Review phase ─────────────────────────────────────────────────────────
  if (phase === "review" && parsed) {
    return (
      <View style={s.screen}>
        <ScanHeader insets={insets} onBack={() => router.back()} title={t("prescriptions.ocrReviewTitle")} />
        <OcrReviewForm initial={parsed} onSubmit={handleSubmit} onRescan={handleRescan} />
      </View>
    );
  }

  // ── Camera / processing phase ────────────────────────────────────────────
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
      </View>

      {scanErr && (
        <View style={[s.errorBanner, { top: insets.top + 68 }]}>
          <Ionicons name="alert-circle" size={16} color="#fff" />
          <Text weight="bold" style={s.errorBannerText}>
            {t("prescriptions.scanErrorRetry")}
          </Text>
        </View>
      )}

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={handleCapture}
          disabled={phase === "processing"}
          accessibilityRole="button"
          accessibilityLabel={t("prescriptions.scanCaptureCta")}
          style={s.captureTouchable}>
          {({ pressed }) => (
            <View style={[s.captureOuter, pressed && s.captureOuterPressed]}>
              <View style={[s.captureInner, phase === "processing" && s.captureInnerBusy]} />
            </View>
          )}
        </Pressable>
        <Text weight="bold" style={s.captureLabel}>
          {phase === "processing"
            ? t("prescriptions.scanProcessing")
            : t("prescriptions.scanCaptureHint")}
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
              <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
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

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  // ── Shared header ───────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
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
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  headerTitle: {
    flex:               1,
    fontSize:           17,
    lineHeight:         22,
    color:              kit.color.ink,
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
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  permissionTitle: {
    fontSize:           19,
    lineHeight:         26,
    color:              kit.color.ink,
    textAlign:          "center",
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  permissionBody: {
    fontSize:           14,
    lineHeight:         22,
    color:              kit.color.inkSoft,
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
    aspectRatio:  1.35,
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
  },
  topBackTouchable: { borderRadius: 19 },
  topBack: {
    width:           38,
    height:          38,
    borderRadius:    19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  topBackPressed: { opacity: 0.75 },

  // ── Error banner ─────────────────────────────────────────────────────────
  errorBanner: {
    position:          "absolute",
    start:             20,
    end:               20,
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               8,
    paddingHorizontal: 14,
    paddingVertical:   10,
    borderRadius:      kit.radius.lg,
    backgroundColor:   "rgba(220,38,38,0.92)",
  },
  errorBannerText: {
    flex:               1,
    fontSize:           12,
    lineHeight:         17,
    color:              "#fff",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

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
  captureInnerBusy: {
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  captureLabel: {
    fontSize:           12,
    lineHeight:         17,
    color:              "#fff",
    textShadowColor:    "rgba(0,0,0,0.5)",
    textShadowRadius:   4,
    includeFontPadding: false,
  },
});
