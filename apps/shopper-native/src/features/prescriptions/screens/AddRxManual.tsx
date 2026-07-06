/**
 * AddRxManual — manual Rx-number entry, now a real create flow.
 *
 * There is no external pharmacy lookup API (see the removed manualLookup
 * stub) — instead, once a well-formed, non-duplicate number is entered, the
 * user names it and saves it directly to their account via Supabase
 * (usePrescriptionMutations). This replaces the old "look it up and hope it
 * matches" flow, which could never actually succeed.
 *
 * Redesign (2026 visual pass):
 *   • Digit display uses 10 fixed OTP boxes that scale fluidly with screen
 *     width. Boxes always render in natural left-to-right numeral order
 *     (see `d.row` below) regardless of app language — Arabic UI still
 *     reads numbers left-to-right, so this row is intentionally NOT
 *     direction-mirrored the way most row layouts in this app are.
 *   • A hidden TextInput backs the boxes so tapping them opens the native
 *     numeric keyboard (keyboardType="number-pad") on both platforms, with
 *     correct cursor/paste behaviour for free. The on-screen custom keypad
 *     remains as a second, branded input method — both write to the same
 *     state, so neither can conflict with the other.
 *   • The keypad lives in its own fixed footer above the bottom safe-area
 *     so it never floats relative to the scrollable content.
 *   • All typography forces Cairo via Text `weight` props rather than
 *     style.fontFamily so font precedence cannot be lost on re-render.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
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
import { usePrescriptions } from "../hooks/usePrescriptions";
import { usePrescriptionMutations } from "../hooks/usePrescriptionMutations";
import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";

const IS_RTL      = isRtl();
const TEXT_START  = textAlignStart(IS_RTL);
const MIN_DIGITS  = 7;
const MAX_DIGITS  = 10;

type ScreenState = "idle" | "typing" | "duplicate" | "ready";

// ─── Digit display ────────────────────────────────────────────────────────────

interface DigitDisplayProps {
  rxNumber: string;
  reduced:  boolean;
  onPress:  () => void;
}

/**
 * 10-box OTP-style row. The "active" box (next empty slot) gets a 2pt
 * accent ring + accent-tint background and a blinking caret. Tapping
 * anywhere on the row focuses the hidden TextInput (see parent), opening
 * the native numeric keyboard.
 */
function DigitDisplay({ rxNumber, reduced, onPress }: DigitDisplayProps): React.ReactElement {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  // Boxes scaled to fit the screen with 24pt outer padding + tighter gutters
  // for higher counts. Sized for MAX_DIGITS so users can see and enter the
  // full 7-10 digit range, not just the 7-digit minimum.
  const boxCount  = MAX_DIGITS;
  const outerPad  = 48;             // 24 each side
  const gutters   = (boxCount - 1) * 6;
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
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        rxNumber.length === 0
          ? t("prescriptions.manualA11yNoDigits")
          : t("prescriptions.manualA11yDigits", { digits: rxNumber.split("").join(" ") })
      }
      // Numbers always read left-to-right in this app regardless of UI
      // language (matches phone numbers, prices, etc.) — deliberately NOT
      // flexRow(IS_RTL) here, unlike almost every other row in this app.
      // Mirroring this row was the "reversed digit order" bug.
      style={d.row}>
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
    </Pressable>
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
                style={k.keyTouchable}>
                {({ pressed }) => (
                  <View style={[k.key, pressed && k.keyPressed, disabled && k.keyDisabled]}>
                    {isDel ? (
                      <Ionicons name="backspace-outline" size={24} color={kit.color.ink} />
                    ) : (
                      <Text weight="black" style={k.keyText}>{key}</Text>
                    )}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AddRxManual(): React.ReactElement {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const reduced   = useReducedMotion() ?? false;
  const { t }     = useTranslation();
  const { user }  = useAuth();
  const existing  = usePrescriptions();
  const { create } = usePrescriptionMutations(user?.id);

  const inputRef = useRef<TextInput>(null);
  const [rxNumber, setRxNumber] = useState("");
  const [name,     setName]     = useState("");

  const isDuplicate = useMemo(
    () => rxNumber.length >= MIN_DIGITS && existing.some((rx) => rx.rxNumber === rxNumber),
    [existing, rxNumber],
  );

  const screenState: ScreenState = useMemo(() => {
    if (rxNumber.length === 0)        return "idle";
    if (rxNumber.length < MIN_DIGITS) return "typing";
    if (isDuplicate)                   return "duplicate";
    return "ready";
  }, [rxNumber, isDuplicate]);

  // Shared by the hidden TextInput (paste/native keyboard) and the custom
  // keypad — both funnel through here so digits can never get out of sync
  // or accidentally reversed regardless of input method.
  const applyDigits = useCallback((raw: string) => {
    setRxNumber(raw.replace(/[^0-9]/g, "").slice(0, MAX_DIGITS));
  }, []);
  const onDigit = useCallback((digit: string) => {
    setRxNumber((prev) => (prev.length >= MAX_DIGITS ? prev : prev + digit));
  }, []);
  const onBackspace = useCallback(() => {
    setRxNumber((prev) => prev.slice(0, -1));
  }, []);
  const focusHiddenInput = useCallback(() => inputRef.current?.focus(), []);

  const canSave = screenState === "ready" && name.trim().length > 0 && !create.isPending && !!user?.id;

  const onSave = useCallback(async () => {
    if (!canSave) return;
    try {
      const created = await create.mutateAsync({ input: { name: name.trim(), rxNumber } });
      showSuccessSheet(
        t("prescriptions.manualSavedTitle"),
        t("prescriptions.manualSavedBody"),
        () => router.replace(`/prescriptions/${created.id}` as never),
      );
    } catch {
      showErrorSheet(t("prescriptions.manualSaveErrorTitle"), t("prescriptions.manualSaveErrorBody"));
    }
  }, [canSave, create, name, rxNumber, router, t]);

  // Whether the bottom CTA bar is mounted — affects keypad footer offset.
  const showCta = screenState === "ready";

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
            style={s.backBtnTouchable}>
            {({ pressed }) => (
              <View style={[s.backBtn, pressed && s.backBtnPressed]}>
                <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
              </View>
            )}
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

        <DigitDisplay rxNumber={rxNumber} reduced={reduced} onPress={focusHiddenInput} />

        {/* Hidden native input — invisible, but focusable via the row above.
            Gives the field a real numeric keyboard, cursor, and paste
            handling on both platforms for free; onChangeText strips
            anything non-numeric so pasted text can't reorder digits. */}
        <TextInput
          ref={inputRef}
          value={rxNumber}
          onChangeText={applyDigits}
          keyboardType="number-pad"
          maxLength={MAX_DIGITS}
          style={s.hiddenInput}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />

        {screenState === "duplicate" && (
          <InfoBanner tone="not_found" text={t("prescriptions.manualDuplicateBody")} />
        )}

        {screenState === "ready" && (
          <View style={s.nameField}>
            <Text weight="bold" style={s.nameLabel}>
              {t("prescriptions.manualNameLabel")}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t("prescriptions.manualNamePh")}
              placeholderTextColor={kit.color.inkFaint}
              style={s.nameInput}
              textAlign={TEXT_START as "left" | "right"}
              editable={!create.isPending}
            />
          </View>
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
          disabled={create.isPending}
        />
      </View>

      {/* ── CTA bar (only once the number is valid + not a duplicate) ── */}
      {showCta && (
        <View
          style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}
          pointerEvents="box-none">
          <Button
            variant="primary"
            full
            onPress={onSave}
            label={t("prescriptions.manualSaveCta")}
            icon="checkmark"
            loading={create.isPending}
            disabled={!canSave}
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
    minHeight:     38,
  },
  backBtnTouchable: {
    borderRadius: 14,
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
  // Invisible but focusable — see the comment where it's rendered.
  hiddenInput: {
    position: "absolute",
    width:    1,
    height:   1,
    opacity:  0,
  },
  nameField: {
    gap: 8,
  },
  nameLabel: {
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  nameInput: {
    height:            52,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    backgroundColor:   kit.color.surface,
    paddingHorizontal: 16,
    fontSize:          15,
    color:             kit.color.ink,
    ...kit.shadow.raised,
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
    // Always physical LTR (never mirrored) — see the comment where this
    // style is applied for why numbers must not follow RTL row-reversal.
    // A hardcoded `flexDirection: "row"` is NOT LTR-safe: per utils/layout.ts,
    // under forceRTL (Arabic) a literal "row" already flows right-to-left —
    // that was the actual bug (active/first box rendered on the right,
    // digits filled right-to-left in Arabic mode). `flexRow(false)` is this
    // codebase's own idiom for "force LTR regardless of language".
    flexDirection:   flexRow(false),
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
  // Bare touchable: only `flex` (for row distribution) + radius (for ripple
  // shape). All visual styling lives on the inner View via function-as-
  // children — a raw Pressable's own function-computed `style` has proven
  // unreliable in this app's RN/Fabric setup (loses sizing/background
  // entirely in some cases, not just when `gap` is present).
  keyTouchable: {
    flex:         1,
    borderRadius: kit.radius.lg,
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
