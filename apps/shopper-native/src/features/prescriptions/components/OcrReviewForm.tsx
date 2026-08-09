/**
 * OcrReviewForm — editable confirmation of OCR-extracted Rx fields.
 *
 * Redesign (2026 visual pass):
 *   • Premium form fields with explicit focus state — accent border + glow
 *     shadow + accent-tinted background. Idle state is hairline only so
 *     active fields visibly "wake up".
 *   • OCR "recognized" pill upgraded to a teal accent badge with sparkle
 *     icon + tight typography (10pt black caps, 0.4 tracking).
 *   • Warning banner restructured as a card with 36pt amber icon well
 *     and clear hierarchy (icon + body).
 *   • Footer CTA stack: primary "Add to my prescriptions" + secondary
 *     "Rescan" ghost button, both full-width with consistent radius.
 *   • All copy via t() — no module-load Arabic captures.
 *   • Pure UI: no router, no native deps, no store writes.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { kit, Button } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { Text } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import type { RxStatus } from "@/stores/prescriptionsStore";
import type { ParsedRx } from "../lib/parseRxText";

export interface OcrReviewFormSubmit {
  name:      string;
  dose?:     string;
  refills?:  number;
  doctor?:   string;
  rxNumber?: string;
  status:    RxStatus;
}

export interface OcrReviewFormProps {
  initial:  ParsedRx;
  onSubmit: (final: OcrReviewFormSubmit) => void;
  onRescan: () => void;
}

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Recognized badge ────────────────────────────────────────────────────────

function RecognizedBadge({ label }: { label: string }): React.ReactElement {
  return (
    <View
      accessibilityLabel={label}
      style={[s.badge, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name="sparkles" size={10} color={kit.color.accentDeep} />
      <Text weight="black" style={s.badgeText}>{label}</Text>
    </View>
  );
}

// ─── Field atom ──────────────────────────────────────────────────────────────

interface FieldProps {
  label:        string;
  recognized:   boolean;
  recognizedLabel: string;
  required?:    boolean;
  value:        string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  numeric?:     boolean;
}

function Field({
  label,
  recognized,
  recognizedLabel,
  required,
  value,
  onChangeText,
  placeholder,
  numeric,
}: FieldProps): React.ReactElement {
  const [focused, setFocused] = useState(false);
  const handleFocus = useCallback(() => setFocused(true),  []);
  const handleBlur  = useCallback(() => setFocused(false), []);

  return (
    <View style={s.fieldWrap}>
      <View style={[s.labelRow, { flexDirection: flexRow(IS_RTL) }]}>
        <Text weight="black" style={s.fieldLabel}>
          {label}{required ? " *" : ""}
        </Text>
        {recognized && <RecognizedBadge label={recognizedLabel} />}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={kit.color.inkFaint}
        keyboardType={numeric ? "number-pad" : "default"}
        textAlign={TEXT_START as "left" | "right"}
        style={[
          s.fieldInput,
          focused && s.fieldInputFocused,
        ]}
        accessibilityLabel={label}
        maxFontSizeMultiplier={1.3}
      />
    </View>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export function OcrReviewForm({
  initial,
  onSubmit,
  onRescan,
}: OcrReviewFormProps): React.ReactElement {
  const { t } = useTranslation();

  const [name,     setName]     = useState(initial.name     ?? "");
  const [dose,     setDose]     = useState(initial.dose     ?? "");
  const [refills,  setRefills]  = useState(
    initial.refills != null ? String(initial.refills) : "",
  );
  const [doctor,   setDoctor]   = useState(initial.doctor   ?? "");
  const [rxNumber, setRxNumber] = useState(initial.rxNumber ?? "");

  const recognized = useMemo(() => ({
    name:     initial.name     !== undefined,
    dose:     initial.dose     !== undefined,
    refills:  initial.refills  !== undefined,
    doctor:   initial.doctor   !== undefined,
    rxNumber: initial.rxNumber !== undefined,
  }), [initial]);

  const showNameMissingBanner = initial.name === undefined;
  const canSubmit             = name.trim().length > 0;

  const recognizedLabel = t("prescriptions.ocrRecognized");

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    const refillsParsed = refills.trim() === "" ? undefined : Number.parseInt(refills, 10);
    onSubmit({
      name:     name.trim(),
      dose:     dose.trim()     || undefined,
      refills:  Number.isFinite(refillsParsed) ? refillsParsed : undefined,
      doctor:   doctor.trim()   || undefined,
      rxNumber: rxNumber.trim() || undefined,
      status:   "active",
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {showNameMissingBanner && (
          <View style={s.banner}>
            <View style={[s.bannerRow, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={s.bannerIconWell}>
                <Ionicons name="warning" size={16} color={kit.color.warn} />
              </View>
              <View style={s.bannerText}>
                <Text weight="black" style={s.bannerTitle}>
                  {t("prescriptions.ocrMissingTitle")}
                </Text>
                <Text style={s.bannerBody}>
                  {t("prescriptions.ocrMissingBody")}
                </Text>
              </View>
            </View>
          </View>
        )}

        <Field
          label={t("prescriptions.ocrFieldName")}
          placeholder={t("prescriptions.ocrFieldNamePh")}
          recognized={recognized.name}
          recognizedLabel={recognizedLabel}
          required
          value={name}
          onChangeText={setName}
        />
        <Field
          label={t("prescriptions.ocrFieldDose")}
          placeholder={t("prescriptions.ocrFieldDosePh")}
          recognized={recognized.dose}
          recognizedLabel={recognizedLabel}
          value={dose}
          onChangeText={setDose}
        />
        <Field
          label={t("prescriptions.ocrFieldRefills")}
          placeholder={t("prescriptions.ocrFieldRefillsPh")}
          recognized={recognized.refills}
          recognizedLabel={recognizedLabel}
          value={refills}
          onChangeText={setRefills}
          numeric
        />
        <Field
          label={t("prescriptions.ocrFieldDoctor")}
          placeholder={t("prescriptions.ocrFieldDoctorPh")}
          recognized={recognized.doctor}
          recognizedLabel={recognizedLabel}
          value={doctor}
          onChangeText={setDoctor}
        />
        <Field
          label={t("prescriptions.ocrFieldRxNumber")}
          placeholder={t("prescriptions.ocrFieldRxNumberPh")}
          recognized={recognized.rxNumber}
          recognizedLabel={recognizedLabel}
          value={rxNumber}
          onChangeText={setRxNumber}
          numeric
        />

      </ScrollView>

      <View style={s.footer}>
        <Button
          variant="primary"
          full
          onPress={handleSubmit}
          disabled={!canSubmit}
          label={t("prescriptions.manualAddCta")}
          icon="add"
        />
        <Button
          variant="secondary"
          full
          onPress={onRescan}
          label={t("prescriptions.ocrRescan")}
          icon="refresh"
        />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop:        16,
    paddingBottom:     16,
    gap:               16,
  },

  // ── Warning banner ────────────────────────────────────────────────────────
  banner: {
    padding:         14,
    backgroundColor: kit.color.warnTint,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     "rgba(245,158,11,0.32)",
  },
  bannerRow: {
    alignItems: "flex-start",
    gap:        12,
  },
  bannerIconWell: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: "rgba(245,158,11,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  bannerText: {
    flex: 1,
    gap:  3,
  },
  bannerTitle: {
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.warn,
    letterSpacing:      0.3,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  bannerBody: {
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Field ────────────────────────────────────────────────────────────────
  fieldWrap: {
    gap: 8,
  },
  labelRow: {
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            10,
  },
  fieldLabel: {
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    letterSpacing:      0.3,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  fieldInput: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           15,
    lineHeight:         21,
    color:              kit.color.ink,
    backgroundColor:    kit.color.surface,
    borderRadius:       kit.radius.lg,
    borderWidth:        1.5,
    borderColor:        kit.color.line,
    paddingHorizontal:  14,
    paddingVertical:    14,
    minHeight:          52,
    includeFontPadding: false,
  },
  fieldInputFocused: {
    borderColor:     kit.color.accentDeep,
    backgroundColor: kit.color.accentTint,
    ...kit.shadow.glow,
  },

  // ── OCR "recognized" badge ───────────────────────────────────────────────
  badge: {
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 9,
    paddingVertical:   4,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       "rgba(14,126,116,0.28)",
  },
  badgeText: {
    fontSize:           9,
    lineHeight:         12,
    color:              kit.color.accentDeep,
    letterSpacing:      0.4,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },

  // ── Footer ───────────────────────────────────────────────────────────────
  footer: {
    gap:               10,
    paddingHorizontal: 20,
    paddingTop:        14,
    paddingBottom:     20,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
    backgroundColor:   kit.color.surface,
  },
});
