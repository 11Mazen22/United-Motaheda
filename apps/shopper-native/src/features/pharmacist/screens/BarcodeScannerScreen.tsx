/**
 * BarcodeScannerScreen — pharmacist barcode/QR scanner.
 *
 * Modes (toggled via segment control):
 *   • medicine   — scan barcode → product lookup → stock card
 *   • order      — scan QR token → order detail navigation
 *   • inventory  — scan barcode → inline stock adjustment (±)
 *
 * Design:
 *   - Full-screen CameraView with a square scan window overlay
 *   - Torch toggle button
 *   - 1-second debounce between scans so a single barcode doesn't fire
 *     multiple lookups in rapid succession
 *   - Result card slides up from bottom; dismissable by tapping outside
 *     or pressing the X button
 *   - Haptic feedback on successful scan and on error
 *   - Graceful permission request flow with a human-readable explanation
 *
 * Uses expo-camera v17's CameraView + useCameraPermissions hook.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons }         from "@expo/vector-icons";
import { useTranslation }   from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics         from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";

import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { kit }                    from "@pharmacy/ui-native";

import { BACK_CHEVRON, edgeEnd, edgeStart, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice }            from "@/utils/format";
import { newIdempotencyKey }      from "@/lib/idempotency";

import { adjustInventory, getProductByBarcode } from "../api/inventory";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";
import type { PharmacistProduct }  from "../api/types";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type ScanMode = "medicine" | "inventory" | "order";

// Minimum ms between processing two consecutive scans of the same value
const DEBOUNCE_MS = 1_500;

// ─── Permission gate ───────────────────────────────────────────────────────────

function PermissionGate({ onRequest }: { onRequest: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={pg.root}>
      <View style={pg.iconWell}>
        <Ionicons name="camera-outline" size={48} color={c.accentDeep} />
      </View>
      <UIText variant="section-head" style={{ textAlign: "center" }}>
        {t("pharmacist.scannerPermissionTitle", "إذن الكاميرا مطلوب")}
      </UIText>
      <UIText variant="body-sm" color="secondary" style={{ textAlign: "center", lineHeight: 22 }}>
        {t(
          "pharmacist.scannerPermissionBody",
          "يحتاج الماسح إلى الوصول للكاميرا لقراءة الباركود والرموز QR.",
        )}
      </UIText>
      <Pressable
        onPress={onRequest}
        style={({ pressed }) => [pg.btn, pressed && pg.btnPressed]}
        accessibilityRole="button"
      >
        <UIText style={pg.btnText}>
          {t("pharmacist.scannerPermissionBtn", "منح الإذن")}
        </UIText>
      </Pressable>
    </View>
  );
}

const usePgStyles = (c: any) => StyleSheet.create({
  root:       { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  iconWell:   { width: 80, height: 80, borderRadius: 24, backgroundColor: c.accentTint, alignItems: "center", justifyContent: "center" },
  btn:        { paddingHorizontal: 32, paddingVertical: 14, borderRadius: kit.radius.lg, backgroundColor: c.accent, ...kit.shadow.brandGlow },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  btnText:    { fontSize: 14, fontFamily: kit.font.black, color: "#fff" },
});

// ─── Product result card ───────────────────────────────────────────────────────

function ProductCard({
  product,
  mode,
  adjustment,
  onAdjust,
  onSaveAdjustment,
  savingAdjustment,
  onDismiss,
  onOpenInventory,
}: {
  product: PharmacistProduct;
  mode: ScanMode;
  adjustment: number;
  onAdjust: (delta: number) => void;
  onSaveAdjustment: () => void;
  savingAdjustment: boolean;
  onDismiss: () => void;
  onOpenInventory: () => void;
}) {
  const { t } = useTranslation();
  const isLow = product.available <= 5;
  const adjustedAvailable = Math.max(0, product.available + adjustment);

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18).stiffness(220)}
      exiting={SlideOutDown.duration(200)}
      style={rc.root}
    >
      {/* Dismiss */}
      <Pressable onPress={onDismiss} style={rc.close} hitSlop={12} accessibilityRole="button">
        <Ionicons name="close-circle" size={22} color={c.inkFaint} />
      </Pressable>

      {/* Header */}
      <View style={[rc.header, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={rc.barcodeIcon}>
          <Ionicons name="barcode-outline" size={18} color={c.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <UIText variant="card-title" numberOfLines={2} style={{ textAlign: TEXT_START }}>
            {product.nameAr ?? product.nameEn ?? product.name}
          </UIText>
          {product.code && (
            <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
              {product.code}
            </UIText>
          )}
        </View>
        <UIText style={rc.price}>{formatPrice(product.effectivePrice)}</UIText>
      </View>

      {/* Stock grid */}
      <View style={[rc.stockGrid, { flexDirection: flexRow(IS_RTL) }]}>
        {[
          { label: t("pharmacist.onHand"),   value: product.onHand,   warn: false },
          { label: t("pharmacist.reserved"), value: product.reserved, warn: false },
          { label: t("pharmacist.available"),value: product.available, warn: isLow },
        ].map(({ label, value, warn }) => (
          <View key={label} style={rc.stockCell}>
            <UIText style={[rc.stockVal, warn && rc.stockValWarn]}>{value}</UIText>
            <UIText style={rc.stockLabel}>{label}</UIText>
          </View>
        ))}
      </View>

      {/* Low-stock warning */}
      {isLow && (
        <Animated.View entering={FadeIn.duration(200)} style={rc.warnRow}>
          <Ionicons name="warning-outline" size={13} color={c.danger} />
          <UIText style={rc.warnText}>
            {product.available === 0
              ? t("pharmacist.stockExhausted", "نفد المخزون")
              : t("pharmacist.stockLow", { count: product.available })}
          </UIText>
        </Animated.View>
      )}

      {/* Category */}
      {product.categoryName && (
        <View style={[rc.catRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="folder-outline" size={12} color={c.inkFaint} />
          <UIText variant="caption" color="secondary">{product.categoryName}</UIText>
        </View>
      )}

      {mode === "inventory" && (
        <View style={rc.adjustCard}>
          <View style={[rc.adjustHeader, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={{ flex: 1 }}>
              <UIText variant="body-sm" weight="bold" style={{ textAlign: TEXT_START }}>
                {t("pharmacist.inventoryAdjustTitle", "Quick stock review")}
              </UIText>
              <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
                {t("pharmacist.inventoryAdjustedAvailable", "Adjusted available")}: {adjustedAvailable}
              </UIText>
            </View>
            <Pressable onPress={onOpenInventory} style={rc.openInventoryBtn}>
              <UIText style={rc.openInventoryText}>
                {t("pharmacist.scannerOpenInventory", "Open inventory")}
              </UIText>
            </Pressable>
          </View>

          <View style={[rc.adjustRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable onPress={() => onAdjust(-1)} style={rc.adjustBtn} accessibilityRole="button">
              <Ionicons name="remove" size={18} color={c.accentDeep} />
            </Pressable>
            <View style={rc.adjustValueWrap}>
              <UIText style={rc.adjustValue}>{adjustment > 0 ? `+${adjustment}` : adjustment}</UIText>
              <UIText style={rc.adjustHint}>
                {t("pharmacist.inventoryAdjustHint", "Adjusts available stock")}
              </UIText>
            </View>
            <Pressable onPress={() => onAdjust(1)} style={rc.adjustBtn} accessibilityRole="button">
              <Ionicons name="add" size={18} color={c.accentDeep} />
            </Pressable>
          </View>
          {adjustment !== 0 && (
            <Pressable
              onPress={onSaveAdjustment}
              style={rc.saveAdjustmentBtn}
              disabled={savingAdjustment}
            >
              {savingAdjustment ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <UIText style={rc.saveAdjustmentText}>
                  {t("pharmacist.saveInventoryAdjustment", "Save adjustment")}
                </UIText>
              )}
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const useRcStyles = (c: any) => StyleSheet.create({
  root: {
    position:          "absolute",
    bottom:            0,
    start:              0,
    end:             0,
    backgroundColor:   c.surface,
    borderTopStartRadius:  kit.radius.xl,
    borderTopEndRadius: kit.radius.xl,
    padding:           kit.inset.card,
    paddingBottom:     28,
    gap:               12,
    ...kit.shadow.overlay,
  },
  close: {
    position: "absolute",
    top: 14,
    [edgeEnd(IS_RTL)]: 14,
    zIndex: 1,
  },
  header: { alignItems: "flex-start", gap: 12 },
  barcodeIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: c.accentTint,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  price:     { fontSize: 18, fontFamily: kit.font.black, color: c.accentDeep },
  stockGrid: { gap: 8 },
  stockCell: { flex: 1, alignItems: "center", backgroundColor: c.well, borderRadius: kit.radius.lg, paddingVertical: 10 },
  stockVal:  { fontSize: 22, fontFamily: kit.font.black, color: c.ink },
  stockValWarn: { color: c.danger },
  stockLabel:{ fontSize: 10, fontFamily: kit.font.bold, color: c.inkSoft, marginTop: 2 },
  warnRow:   { flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: kit.radius.lg, backgroundColor: c.dangerTint },
  warnText:  { fontSize: 12, fontFamily: kit.font.bold, color: c.danger, flex: 1 },
  catRow:    { alignItems: "center", gap: 6 },
  adjustCard: {
    gap:             12,
    padding:         12,
    borderRadius:    kit.radius.lg,
    backgroundColor: c.well,
    borderWidth:     1,
    borderColor:     c.line,
  },
  adjustHeader: {
    alignItems: "center",
    gap:        10,
  },
  openInventoryBtn: {
    paddingHorizontal: 12,
    paddingVertical:   8,
    borderRadius:      kit.radius.pill,
    backgroundColor:   c.accentTint,
  },
  openInventoryText: {
    fontSize:   11,
    fontFamily: kit.font.bold,
    color:      c.accentDeep,
  },
  adjustRow: {
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            12,
  },
  adjustBtn: {
    width:           42,
    height:          42,
    borderRadius:    14,
    backgroundColor: c.surface,
    borderWidth:     1,
    borderColor:     c.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  adjustValueWrap: {
    flex:       1,
    alignItems: "center",
    gap:        2,
  },
  adjustValue: {
    fontSize:   22,
    fontFamily: kit.font.black,
    color:      c.ink,
  },
  adjustHint: {
    fontSize:   10,
    fontFamily: kit.font.regular,
    color:      c.inkFaint,
  },
  saveAdjustmentBtn: {
    minHeight: 42,
    borderRadius: kit.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
  },
  saveAdjustmentText: { fontSize: 12, fontFamily: kit.font.bold, color: "#fff" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export function BarcodeScannerScreen(): React.ReactElement {
  const { c } = useDarkColors();
  const s = useSStyles(c);
  const rc = useRcStyles(c);
  const pg = usePgStyles(c);
  const { t }    = useTranslation();
  const router   = useRouter();
  const params   = useLocalSearchParams<{ barcode?: string; mode?: ScanMode }>();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode,         setMode]         = useState<ScanMode>("medicine");
  const [torchOn,      setTorchOn]      = useState(false);
  const [scanning,     setScanning]     = useState(false);
  const [result,       setResult]       = useState<PharmacistProduct | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [adjustment,   setAdjustment]   = useState(0);
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  // Debounce ref — stores the last scanned value + timestamp
  const lastScanRef = useRef<{ value: string; ts: number } | null>(null);
  const handledParamScanRef = useRef<string | null>(null);

  const dismissResult = useCallback(() => {
    setResult(null);
    setError(null);
    setAdjustment(0);
    setSavingAdjustment(false);
  }, []);

  useEffect(() => {
    if (params.mode === "medicine" || params.mode === "order" || params.mode === "inventory") {
      setMode(params.mode);
    }
  }, [params.mode]);

  const handleBarcode = useCallback(
    async (data: string) => {
      const value = data.trim();
      if (!value) {
        setError(t("pharmacist.scannerError", "حدث خطأ أثناء البحث. حاول مجدداً."));
        return;
      }

      // Debounce
      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.value === value &&
        now - lastScanRef.current.ts < DEBOUNCE_MS
      ) return;
      lastScanRef.current = { value, ts: now };

      setScanning(true);
      setError(null);
      setResult(null);
      setAdjustment(0);

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      if (mode === "order") {
        // QR token — navigate to order detail
        setScanning(false);
        router.push(`/(pharmacist)/order/${value}` as never);
        return;
      }

      // Medicine lookup
      try {
        const product = await getProductByBarcode(value);
        if (product) {
          setResult(product);
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }
        } else {
          setError(t("pharmacist.scannerNotFound", "لم يُعثر على منتج بهذا الباركود."));
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          }
        }
      } catch {
        setError(t("pharmacist.scannerError", "حدث خطأ أثناء البحث. حاول مجدداً."));
      } finally {
        setScanning(false);
      }
    },
    [mode, router, t],
  );

  const saveAdjustment = useCallback(async () => {
    if (!result || adjustment === 0 || savingAdjustment) return;
    setSavingAdjustment(true);
    try {
      await adjustInventory({
        productId: result.id,
        delta: adjustment,
        reason: "pharmacist_barcode_recount",
        idempotencyKey: newIdempotencyKey(),
      });
      setResult((current) => current ? {
        ...current,
        onHand: current.onHand + adjustment,
        stock: current.stock + adjustment,
        available: current.available + adjustment,
      } : current);
      setAdjustment(0);
    } catch (saveError) {
      setError(saveError instanceof Error
        ? saveError.message
        : t("pharmacist.scannerError", "حدث خطأ أثناء الحفظ."));
    } finally {
      setSavingAdjustment(false);
    }
  }, [adjustment, result, savingAdjustment, t]);

  useEffect(() => {
    if (!permission?.granted) return;
    const seededBarcode = typeof params.barcode === "string" ? params.barcode.trim() : "";
    if (!seededBarcode || handledParamScanRef.current === seededBarcode) return;
    handledParamScanRef.current = seededBarcode;
    void handleBarcode(seededBarcode);
  }, [handleBarcode, params.barcode, permission?.granted]);

  if (!permission) {
    return (
      <Screen edgeTop background={c.canvas}>
        <PharmacistScreenHeader title={t("pharmacist.scannerTitle", "الماسح الضوئي")} />
        <View style={s.centered}><ActivityIndicator size="large" color={c.accent} /></View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen edgeTop background={c.canvas}>
        <PharmacistScreenHeader title={t("pharmacist.scannerTitle", "الماسح الضوئي")} />
        <PermissionGate onRequest={requestPermission} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Camera */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={(event) => void handleBarcode(event.data)}
      />

      {/* Back button */}
      <View style={s.backBtn}>
        <Pressable
          onPress={() => router.back()}
          style={s.iconCircle}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name={BACK_CHEVRON} size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Mode selector */}
      <Animated.View entering={FadeIn.duration(300)} style={s.modeBar}>
        {(["medicine", "inventory", "order"] as ScanMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => { setMode(m); dismissResult(); }}
            style={[s.modeBtn, mode === m && s.modeBtnActive]}
            accessibilityRole="button"
          >
            <UIText style={[s.modeBtnText, mode === m && s.modeBtnTextActive]}>
              {m === "medicine"
                ? t("pharmacist.scanModeMedicine", "دواء")
                : m === "inventory"
                  ? t("pharmacist.scanModeInventory", "جرد")
                : t("pharmacist.scanModeOrder",    "طلب")}
            </UIText>
          </Pressable>
        ))}
      </Animated.View>

      {/* Scan window */}
      <View style={s.scanWindow}>
        <View style={[s.corner, s.cornerTL]} />
        <View style={[s.corner, s.cornerTR]} />
        <View style={[s.corner, s.cornerBL]} />
        <View style={[s.corner, s.cornerBR]} />
        {scanning && (
          <Animated.View entering={FadeIn.duration(150)} style={s.scanLine} />
        )}
      </View>

      {/* Instruction label */}
      <View style={s.instructionRow}>
        <UIText style={s.instruction}>
          {mode === "medicine"
            ? t("pharmacist.scannerInstructMedicine", "وجّه الكاميرا نحو باركود الدواء")
            : mode === "inventory"
              ? t("pharmacist.scannerInstructInventory", "امسح الباركود لمراجعة المخزون بسرعة")
            : t("pharmacist.scannerInstructOrder",    "امسح رمز QR الخاص بالطلب")}
        </UIText>
      </View>

      {/* Torch + scanning indicator */}
      <View style={[s.controls, { flexDirection: flexRow(IS_RTL) }]}>
        <Pressable
          onPress={() => setTorchOn((v) => !v)}
          style={[s.iconCircle, torchOn && s.iconCircleActive]}
          accessibilityRole="button"
          accessibilityLabel={t("pharmacist.scannerTorch", "الفلاش")}
        >
          <Ionicons
            name={torchOn ? "flashlight" : "flashlight-outline"}
            size={20}
            color={torchOn ? c.accent : "#fff"}
          />
        </Pressable>

        {scanning && (
          <Animated.View entering={FadeIn.duration(150)} style={s.scanningPill}>
            <ActivityIndicator size="small" color="#fff" />
            <UIText style={s.scanningText}>
              {t("pharmacist.scanning", "جارٍ البحث…")}
            </UIText>
          </Animated.View>
        )}
      </View>

      {/* Error banner */}
      {error && !result && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          style={s.errorBanner}
        >
          <Ionicons name="alert-circle-outline" size={16} color={c.danger} />
          <UIText style={s.errorText}>{error}</UIText>
          {lastScanRef.current?.value ? (
            <Pressable onPress={() => void handleBarcode(lastScanRef.current!.value)} hitSlop={10} style={s.retryPill}>
              <UIText style={s.retryPillText}>{t("common.retry")}</UIText>
            </Pressable>
          ) : null}
          <Pressable onPress={dismissResult} hitSlop={10}>
            <Ionicons name="close" size={14} color={c.danger} />
          </Pressable>
        </Animated.View>
      )}

      {/* Product result */}
      {result && (
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissResult} accessible={false}>
          <ProductCard
            product={result}
            mode={mode}
            adjustment={adjustment}
            onAdjust={(delta) => setAdjustment((value) => Math.max(-result.available, value + delta))}
            onSaveAdjustment={() => void saveAdjustment()}
            savingAdjustment={savingAdjustment}
            onDismiss={dismissResult}
            onOpenInventory={() => {
              dismissResult();
              router.push({
                pathname: "/(pharmacist)/inventory" as never,
                params: result.barcode ? { query: result.barcode } : undefined,
              });
            }}
          />
        </Pressable>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const WINDOW_SIZE = 240;

const useSStyles = (c: any) => StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  backBtn: {
    position: "absolute",
    top: 56,
    [edgeStart(IS_RTL)]: 16,
  },

  modeBar: {
    position:          "absolute",
    top:               56,
    alignSelf:         "center",
    flexDirection:     "row",
    backgroundColor:   "rgba(0,0,0,0.55)",
    borderRadius:      kit.radius.pill,
    padding:           3,
    gap:               3,
  },
  modeBtn: {
    paddingHorizontal: 18,
    paddingVertical:   8,
    borderRadius:      kit.radius.pill,
  },
  modeBtnActive: { backgroundColor: c.accent },
  modeBtnText: { fontSize: 12, fontFamily: kit.font.bold, color: "rgba(255,255,255,0.7)" },
  modeBtnTextActive: { color: "#fff" },

  scanWindow: {
    position:      "absolute",
    top:           "50%",
    start:          "50%",
    width:         WINDOW_SIZE,
    height:        WINDOW_SIZE,
    marginTop:     -(WINDOW_SIZE / 2) - 30,
    marginStart:    -(WINDOW_SIZE / 2),
  },
  corner: {
    position:  "absolute",
    width:     28,
    height:    28,
    borderColor: c.accent,
    borderWidth: 3,
  },
  cornerTL: { top: 0, start: 0,  borderEndWidth: 0, borderBottomWidth: 0, borderTopStartRadius:     8 },
  cornerTR: { top: 0, end: 0, borderStartWidth:  0, borderBottomWidth: 0, borderTopEndRadius:    8 },
  cornerBL: { bottom: 0, start: 0,  borderEndWidth: 0, borderTopWidth: 0, borderBottomStartRadius:  8 },
  cornerBR: { bottom: 0, end: 0, borderStartWidth:  0, borderTopWidth: 0, borderBottomEndRadius: 8 },
  scanLine: {
    position:        "absolute",
    start:            8,
    end:           8,
    top:             "50%",
    height:          2,
    backgroundColor: c.accent,
    opacity:         0.8,
  },

  instructionRow: {
    position:   "absolute",
    bottom:     180,
    start:       0,
    end:      0,
    alignItems: "center",
  },
  instruction: {
    fontSize:          13,
    fontFamily:        kit.font.bold,
    color:             "rgba(255,255,255,0.85)",
    backgroundColor:   "rgba(0,0,0,0.4)",
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      kit.radius.pill,
  },

  controls: {
    position:          "absolute",
    bottom:            48,
    start:              24,
    end:             24,
    justifyContent:    "space-between",
    alignItems:        "center",
  },
  iconCircle: {
    width:           46,
    height:          46,
    borderRadius:    23,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     "rgba(255,255,255,0.2)",
  },
  iconCircleActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor:     c.accent,
  },
  scanningPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    backgroundColor:   "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderRadius:      kit.radius.pill,
  },
  scanningText: { fontSize: 12, fontFamily: kit.font.bold, color: "#fff" },

  errorBanner: {
    position:          "absolute",
    bottom:            120,
    start:              24,
    end:             24,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               8,
    backgroundColor:   c.dangerTint,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       c.danger,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  errorText: { flex: 1, fontSize: 12, fontFamily: kit.font.bold, color: c.danger },
  retryPill: {
    paddingHorizontal: 10,
    paddingVertical:   6,
    borderRadius:      kit.radius.pill,
    backgroundColor:   "rgba(255,255,255,0.55)",
  },
  retryPillText: {
    fontSize:   10,
    fontFamily: kit.font.bold,
    color:      c.danger,
  },
});
