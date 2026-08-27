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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextStyle,
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
import { Button, Text, useTheme, type NativeTheme } from "@pharmacy/ui-native";
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
  const { theme } = useTheme();
  const d = useMemo(() => getDigitStyles(theme), [theme]);
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
              { width: boxSize, height: boxHeight, borderRadius: 12 },
              isFilled && d.boxFilled,
              isActive && d.boxActive,
            ]}>
            {isFilled ? (
              <Text weight="black" color="brand" style={[d.char, { fontSize: Math.round(boxSize * 0.46) }]}>
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
  const { theme } = useTheme();
  const palette = tone === "found"
    ? { bg: `${theme.colors.status.success}1A`, border: theme.colors.status.success, icon: theme.colors.status.success, name: "checkmark-circle" as const }
    : tone === "not_found"
    ? { bg: `${theme.colors.status.error}1A`,  border: theme.colors.status.error,  icon: theme.colors.status.error,  name: "alert-circle"      as const }
    : { bg: `${theme.colors.status.warning}1A`,    border: theme.colors.status.warning,    icon: theme.colors.status.warning,    name: "shield-checkmark-outline" as const };

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
  const { theme } = useTheme();
  const k = useMemo(() => getKeypadStyles(theme), [theme]);
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
                      <Ionicons name="backspace-outline" size={24} color={theme.colors.text.primary} />
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
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
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
                <Ionicons name={BACK_CHEVRON} size={20} color={theme.colors.text.primary} />
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.identityRow}>
          <View style={s.heroTile}>
            <Ionicons name="keypad-outline" size={24} color={theme.colors.status.warning} />
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
          {...(Platform.OS === "android" ? { importantForAccessibility: "no-hide-descendants" as const } : null)}
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
              placeholderTextColor={theme.colors.text.muted}
              style={s.nameInput as TextStyle}
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

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: theme.colors.canvas.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
    ...theme.shadows[1],
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
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
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
    backgroundColor: `${theme.colors.status.warning}1A`,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
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
    color:              theme.colors.brand.primary,
    letterSpacing:      0.6,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontSize:           28,
    lineHeight:         34,
    color:              theme.colors.text.primary,
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
    color:              theme.colors.text.secondary,
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
    color:              theme.colors.text.primary,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  nameInput: {
    height:            52,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    backgroundColor:   theme.colors.canvas.surface,
    paddingHorizontal: 16,
    fontSize:          15,
    color:             theme.colors.text.primary,
    ...theme.shadows[1],
  },

  // ── Keypad footer ───────────────────────────────────────────────────────
  keypadFooter: {
    paddingHorizontal: 16,
    paddingTop:        12,
    backgroundColor:   theme.colors.canvas.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    theme.colors.border.default,
  },

  // ── Bottom CTA bar (only when "found") ─────────────────────────────────
  ctaBar: {
    paddingHorizontal: 20,
    paddingTop:        12,
    backgroundColor:   theme.colors.canvas.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    theme.colors.border.default,
  },
  });
}

// ─── Digit display styles ─────────────────────────────────────────────────────

function getDigitStyles(theme: NativeTheme) {
  return StyleSheet.create({
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
    backgroundColor: theme.colors.canvas.surface,
    borderWidth:     1.5,
    borderColor:     theme.colors.border.default,
    alignItems:      "center",
    justifyContent:  "center",
    ...theme.shadows[1],
  },
  boxFilled: {
    borderColor:     theme.colors.brand.primary,
    backgroundColor: theme.colors.brand.primaryLight,
  },
  boxActive: {
    borderColor:     theme.colors.brand.primary,
    borderWidth:     2,
    backgroundColor: theme.colors.canvas.surface,
    ...theme.shadows[2],
  },
  char: {
    lineHeight:         32,
    color:              theme.colors.brand.primary,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  caret: {
    width:           2,
    height:          22,
    borderRadius:    1,
    backgroundColor: theme.colors.brand.primary,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: theme.colors.border.default,
  },
  });
}

// ─── Info banner styles ───────────────────────────────────────────────────────

const b = StyleSheet.create({
  wrap: {
    gap:          12,
    padding:      14,
    borderRadius: 12,
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

function getKeypadStyles(theme: NativeTheme) {
  return StyleSheet.create({
  grid: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    gap:           10,
    height:        62,            // explicit height so children with flex:1 expand
  },
  // Bare touchable: only `flex` (for row distribution) + radius (for ripple
  // shape). All visual styling lives on the inner View via function-as-
  // children — a raw Pressable's own function-computed `style` has proven
  // unreliable in this app's RN/Fabric setup (loses sizing/background
  // entirely in some cases, not just when `gap` is present).
  keyTouchable: {
    flex:         1,
    borderRadius: 12,
    height:       62,             // explicit height so flex:1 on key resolves correctly
  },
  key: {
    flex:            1,
    height:          62,
    minHeight:       62,
    borderRadius:    12,
    backgroundColor: theme.colors.canvas.surface,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    alignItems:      "center",
    justifyContent:  "center",
    ...theme.shadows[1],
  },
  keyPressed: {
    backgroundColor: theme.colors.brand.primaryLight,
    borderColor:     theme.colors.brand.primary,
    transform:       [{ scale: 0.97 }],
  },
  keyDisabled: {
    opacity: 0.45,
  },
  keyText: {
    fontSize:           26,
    lineHeight:         34,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  cellBlank: {
    flex: 1,
  },
  });
}
