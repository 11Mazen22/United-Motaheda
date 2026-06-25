/**
 * AddRxManual — manual Rx-number entry + debounced lookup.
 *
 * Redesign (2026 visual pass):
 *   • Digit display now uses 7 fixed OTP boxes that scale fluidly with
 *     screen width (no hardcoded 40pt). Active box (the next empty slot
 *     in input order) gets a 2px accent ring + glow; filled boxes get a
 *     soft accent tint; the cursor box gets a blinking caret.
 *   • The keypad lives in its own fixed footer above the bottom safe-area
 *     so it never floats relative to the scrollable content. Keys span
 *     the safe width minus 24pt symmetric padding with a 10pt inter-key
 *     gutter — strong tactile target while staying inside one-thumb reach.
 *   • Info banner (privacy / found / not-found) sits in the body between
 *     digits and keypad with breathing room above and below — never
 *     squeezed.
 *   • All typography forces Cairo via Text `weight` props rather than
 *     style.fontFamily so font precedence cannot be lost on re-render.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kit, Button } from "@/shared/kit";
import { Text } from "@/shared/ui";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useAuth } from "@/features/auth";
import { usePrescriptionsStore, type Prescription } from "@/stores/prescriptionsStore";
import { RxCard } from "@/shared/components/RxCard";
import { lookupRxNumber, type RxLookupResult } from "../lib/manualLookup";

const IS_RTL      = isRtl();
const TEXT_START  = textAlignStart(IS_RTL);
const MIN_DIGITS  = 7;
const MAX_DIGITS  = 10;
const DEBOUNCE_MS = 500;

const WHATSAPP_RX_URL =
  `https://wa.me/201112343212?text=${encodeURIComponent("مرحباً، أريد إضافة وصفة طبية إلى حسابي.")}`;

type ScreenState = "idle" | "typing" | "looking_up" | "found" | "not_found";

// ─── Digit display ────────────────────────────────────────────────────────────

interface DigitDisplayProps {
  rxNumber: string;
  reduced:  boolean;
}

/**
 * 7-box OTP-style row. The "active" box (next empty slot) gets a 2pt
 * accent ring + accent-tint background and a blinking caret.
 */
function DigitDisplay({ rxNumber, reduced }: DigitDisplayProps): React.ReactElement {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  // 7 boxes, scaled to fit the screen with 24pt outer padding + 8pt gutters
  const boxCount  = MIN_DIGITS;
  const outerPad  = 48;             // 24 each side
  const gutters   = (boxCount - 1) * 8;
  const boxSize   = Math.min(56, Math.floor((width - outerPad - gutters) / boxCount));
  const boxHeight = Math.round(boxSize * 1.25);

  const activeIndex = Math.min(rxNumber.length, boxCount - 1);

  // Blinking caret animation
  const caretOpacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) { caretOpacity.value = 1; return; }
    caretOpacity.value = withRepeat(
      withSequence(
        withTiming(0,   { duration: 480, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,   { duration: 480, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(caretOpacity);
  }, [reduced, caretOpacity]);

  const caretStyle = useAnimatedStyle(() => ({ opacity: caretOpacity.value }));

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        rxNumber.length === 0
          ? t("prescriptions.manualA11yNoDigits")
          : t("prescriptions.manualA11yDigits", { digits: rxNumber.split("").join(" ") })
      }
      style={[d.row, { flexDirection: flexRow(IS_RTL) }]}>
      {Array.from({ length: boxCount }).map((_, i) => {
        const digit    = rxNumber[i] ?? "";
        const isFilled = digit !== "";
        const isActive = i === activeIndex && !isFilled;

        return (
          <View
            key={i}
            style={[
              d.box,
              { width: boxSize, height: boxHeight, borderRadius: kit.radius.lg },
              isFilled && d.boxFilled,
              isActive && d.boxActive,
            ]}>
            {isFilled ? (
              <Text weight="black" style={[d.char, { fontSize: Math.round(boxSize * 0.46) }]}>
                {digit}
              </Text>
            ) : isActive ? (
              <Animated.View style={[d.caret, caretStyle]} />
            ) : (
              <View style={d.dot} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Info banner (compact, single-line title + body) ─────────────────────────

interface InfoBannerProps {
  tone:    "privacy" | "found" | "not_found";
  text:    string;
  cta?:    { label: string; onPress: () => void; icon: React.ComponentProps<typeof Ionicons>["name"] };
}

function InfoBanner({ tone, text, cta }: InfoBannerProps): React.ReactElement {
  const palette = tone === "found"
    ? { bg: kit.color.successTint, border: kit.color.success, icon: kit.color.success, name: "checkmark-circle" as const }
    : tone === "not_found"
    ? { bg: kit.color.dangerTint,  border: kit.color.danger,  icon: kit.color.danger,  name: "alert-circle"      as const }
    : { bg: kit.color.warnTint,    border: kit.color.warn,    icon: kit.color.warn,    name: "shield-checkmark-outline" as const };

  return (
    <View
      style={[
        b.wrap,
        { backgroundColor: palette.bg, borderColor: palette.border + "55" },
      ]}>
      <View style={[b.row, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[b.iconWell, { backgroundColor: palette.icon + "22" }]}>
          <Ionicons name={palette.name} size={16} color={palette.icon} />
        </View>
        <Text style={[b.text, { color: palette.icon }]}>{text}</Text>
      </View>
      {cta && (
        <Button
          variant="secondary"
          size="sm"
          full
          icon={cta.icon}
          onPress={cta.onPress}
          label={cta.label}
        />
      )}
    </View>
  );
}

// ─── Keypad ───────────────────────────────────────────────────────────────────

interface KeypadProps {
  onDigit:     (d: string) => void;
  onBackspace: () => void;
  disabled?:   boolean;
}

const KEY_ROWS: ((string | "del" | "blank"))[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["blank", "0", "del"],
];

/** Tight 3-column keypad. Keys are uniform width via `flex: 1`. */
function Keypad({ onDigit, onBackspace, disabled }: KeypadProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View style={k.grid}>
      {KEY_ROWS.map((row, ri) => (
        <View key={ri} style={k.row}>
          {row.map((key, ci) => {
            if (key === "blank") return <View key={ci} style={k.cellBlank} />;
            const isDel = key === "del";
            return (
              <Pressable
                key={ci}
                onPress={isDel ? onBackspace : () => onDigit(key)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={isDel
                  ? t("prescriptions.manualA11yBackspace")
                  : t("prescriptions.manualA11yDigitKey", { digit: key })}
                style={({ pressed }) => [
                  k.key,
                  pressed && k.keyPressed,
                  disabled && k.keyDisabled,
                ]}>
                {isDel ? (
                  <Ionicons name="backspace-outline" size={24} color={kit.color.ink} />
                ) : (
                  <Text weight="black" style={k.keyText}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Preview Rx builder ──────────────────────────────────────────────────────

function buildPreviewRx(match: RxLookupResult, userId: string): Prescription {
  const stamp = new Date().toISOString();
  return {
    id:           "preview-match",
    userId,
    name:         match.name,
    dose:         match.dose,
    refills:      match.refills,
    nextRefill:   match.nextRefill,
    doctor:       match.doctor,
    status:       match.status,
    isControlled: match.isControlled,
    schedule:     match.schedule,
    addedAt:      stamp,
    updatedAt:    stamp,
  };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AddRxManual(): React.ReactElement {
  const router          = useRouter();
  const insets          = useSafeAreaInsets();
  const reduced         = useReducedMotion() ?? false;
  const { t }           = useTranslation();
  const { user }        = useAuth();
  const addPrescription = usePrescriptionsStore((s) => s.addPrescription);

  const [rxNumber,   setRxNumber]   = useState("");
  const [lookup,     setLookup]     = useState<RxLookupResult | null | undefined>(undefined);
  const [pendingFor, setPendingFor] = useState<string | null>(null);

  const screenState: ScreenState = useMemo(() => {
    if (rxNumber.length === 0)        return "idle";
    if (rxNumber.length < MIN_DIGITS) return "typing";
    if (pendingFor === rxNumber)      return "looking_up";
    if (lookup === null)              return "not_found";
    if (lookup !== undefined)         return "found";
    return "looking_up";
  }, [rxNumber, lookup, pendingFor]);

  useEffect(() => {
    if (rxNumber.length < MIN_DIGITS || rxNumber.length > MAX_DIGITS) {
      setLookup(undefined);
      setPendingFor(null);
      return;
    }
    setPendingFor(rxNumber);
    setLookup(undefined);
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      lookupRxNumber(rxNumber).then((result) => {
        if (cancelled) return;
        setLookup(result);
        setPendingFor(null);
      });
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [rxNumber]);

  const onDigit     = useCallback((digit: string) => {
    setRxNumber((prev) => prev.length >= MAX_DIGITS ? prev : prev + digit);
  }, []);
  const onBackspace = useCallback(() => {
    setRxNumber((prev) => prev.slice(0, -1));
  }, []);
  const onSubmit    = useCallback(() => {
    if (screenState !== "found" || !lookup || !user?.id) return;
    const created = addPrescription({ ...lookup, userId: user.id, rxNumber, status: "active" });
    router.replace(`/prescriptions/${created.id}` as never);
  }, [addPrescription, lookup, rxNumber, router, screenState, user?.id]);

  const previewRx = lookup && screenState === "found" && user?.id
    ? buildPreviewRx(lookup, user.id)
    : null;

  // Whether the bottom CTA bar is mounted — affects keypad footer offset.
  const showCta = screenState === "found";

  return (
    <View style={s.screen}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.navRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
            <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.identityRow}>
          <View style={s.heroTile}>
            <Ionicons name="keypad-outline" size={24} color={kit.color.warn} />
          </View>
          <View style={s.identityText}>
            <Text weight="bold" style={s.eyebrow}>
              {t("prescriptions.manualEyebrow")}
            </Text>
            <Text weight="black" style={s.title}>
              {t("prescriptions.manualTitle")}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Body (scrollable) ──────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <Text style={s.hint}>
          {t("prescriptions.manualHint", { min: MIN_DIGITS, max: MAX_DIGITS })}
        </Text>

        <DigitDisplay rxNumber={rxNumber} reduced={reduced} />

        {screenState === "looking_up" && (
          <View style={[s.lookupRow, { flexDirection: flexRow(IS_RTL) }]}>
            <ActivityIndicator size="small" color={kit.color.accent} />
            <Text weight="bold" style={s.lookupText}>
              {t("prescriptions.manualLooking")}
            </Text>
          </View>
        )}

        {screenState === "found" && previewRx && (
          <>
            <RxCard prescription={previewRx} variant="list" />
            <InfoBanner tone="found" text={t("prescriptions.manualFound")} />
          </>
        )}

        {screenState === "not_found" && (
          <InfoBanner
            tone="not_found"
            text={t("prescriptions.manualNotFound")}
            cta={{
              label:   t("prescriptions.manualSendWhatsApp"),
              icon:    "logo-whatsapp",
              onPress: () => { void Linking.openURL(WHATSAPP_RX_URL).catch(() => {}); },
            }}
          />
        )}

        {(screenState === "idle" || screenState === "typing") && (
          <InfoBanner tone="privacy" text={t("prescriptions.manualPrivacy")} />
        )}

      </ScrollView>

      {/* ── Keypad (fixed footer) ──────────────────────────────────── */}
      <View
        style={[
          s.keypadFooter,
          {
            paddingBottom: showCta ? 12 : Math.max(insets.bottom, 12) + 4,
          },
        ]}>
        <Keypad
          onDigit={onDigit}
          onBackspace={onBackspace}
          disabled={screenState === "looking_up"}
        />
      </View>

      {/* ── CTA bar (only when match found) ────────────────────────── */}
      {showCta && (
        <View
          style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}
          pointerEvents="box-none">
          <Button
            variant="primary"
            full
            onPress={onSubmit}
            label={t("prescriptions.manualAddCta")}
            icon="add"
          />
        </View>
      )}

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    minHeight:     36,
  },
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
  backBtnPressed: {
    opacity:   0.7,
    transform: [{ scale: 0.96 }],
  },
  identityRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
  },
  heroTile: {
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: kit.color.warnTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  identityText: {
    flex: 1,
    gap:  2,
  },
  eyebrow: {
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.6,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontSize:           28,
    lineHeight:         34,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Scroll body ─────────────────────────────────────────────────────────
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop:        20,
    paddingBottom:     16,
    gap:               18,
  },
  hint: {
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  lookupRow: {
    alignItems:      "center",
    justifyContent:  "center",
    gap:             10,
    paddingVertical: 6,
  },
  lookupText: {
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Keypad footer ───────────────────────────────────────────────────────
  keypadFooter: {
    paddingHorizontal: 16,
    paddingTop:        12,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },

  // ── Bottom CTA bar (only when "found") ─────────────────────────────────
  ctaBar: {
    paddingHorizontal: 20,
    paddingTop:        12,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },
});

// ─── Digit display styles ─────────────────────────────────────────────────────

const d = StyleSheet.create({
  row: {
    justifyContent:  "center",
    alignItems:      "center",
    gap:             8,
    paddingVertical: 4,
  },
  box: {
    backgroundColor: kit.color.surface,
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  boxFilled: {
    borderColor:     kit.color.accent,
    backgroundColor: kit.color.accentTint,
  },
  boxActive: {
    borderColor:     kit.color.accentDeep,
    borderWidth:     2,
    backgroundColor: kit.color.surface,
    ...kit.shadow.glow,
  },
  char: {
    lineHeight:         32,
    color:              kit.color.accentDeep,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  caret: {
    width:           2,
    height:          22,
    borderRadius:    1,
    backgroundColor: kit.color.accentDeep,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: kit.color.line,
  },
});

// ─── Info banner styles ───────────────────────────────────────────────────────

const b = StyleSheet.create({
  wrap: {
    gap:          12,
    padding:      14,
    borderRadius: kit.radius.lg,
    borderWidth:  1,
  },
  row: {
    alignItems: "flex-start",
    gap:        12,
  },
  iconWell: {
    width:           32,
    height:          32,
    borderRadius:    10,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  text: {
    flex:               1,
    fontSize:           13,
    lineHeight:         20,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
});

// ─── Keypad styles ────────────────────────────────────────────────────────────

const k = StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    gap:           10,
  },
  key: {
    flex:            1,
    height:          62,
    borderRadius:    kit.radius.lg,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  keyPressed: {
    backgroundColor: kit.color.accentTint,
    borderColor:     kit.color.accent,
    transform:       [{ scale: 0.97 }],
  },
  keyDisabled: {
    opacity: 0.45,
  },
  keyText: {
    fontSize:           26,
    lineHeight:         34,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  cellBlank: {
    flex: 1,
  },
});
