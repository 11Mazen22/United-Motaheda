/**
 * OcrReviewForm — editable confirmation of OCR-extracted Rx fields. VIP 2026.
 *
 * Pure UI. No router, no native deps, no store writes. Parent screen owns
 * the lifecycle (camera → OCR → parse → form → submit/rescan).
 *
 * Five fields, all in Arabic. A "تم التعرّف" badge appears next to a field's
 * label only if that field was populated in `initial` — visual hint about
 * which values came from OCR vs need manual entry.
 *
 * Submit is disabled until `name` is non-empty.
 */

import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { kit, Button } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { Text } from "@/shared/ui";
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

// ─── OCR badge ────────────────────────────────────────────────────────────────

function RecognizedBadge(): React.ReactElement {
  return (
    <View
      accessibilityLabel="هذا الحقل تم استخراجه من الصورة"
      style={[s.badge, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name="sparkles" size={10} color={kit.color.accentDeep} />
      <Text style={s.badgeText}>تم التعرّف</Text>
    </View>
  );
}

// ─── Form field atom ──────────────────────────────────────────────────────────

interface FieldProps {
  label:        string;
  recognized:   boolean;
  required?:    boolean;
  value:        string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  numeric?:     boolean;
}

function Field({
  label, recognized, required, value, onChangeText, placeholder, numeric,
}: FieldProps): React.ReactElement {
  return (
    <View style={s.fieldWrap}>
      <View style={[s.labelRow, { flexDirection: flexRow(IS_RTL) }]}>
        <Text style={s.fieldLabel}>
          {label}{required ? " *" : ""}
        </Text>
        {recognized && <RecognizedBadge />}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={kit.color.inkFaint}
        keyboardType={numeric ? "number-pad" : "default"}
        textAlign={TEXT_START as "left" | "right"}
        style={s.fieldInput}
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
          <View style={[s.banner, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.bannerIconWell}>
              <Ionicons name="warning" size={14} color={kit.color.warn} />
            </View>
            <Text style={s.bannerText}>
              لم نتعرّف على اسم الدواء تلقائياً. أدخله يدوياً أو حاول مرة أخرى مع إضاءة أفضل.
            </Text>
          </View>
        )}

        <Field
          label="اسم الدواء"
          recognized={recognized.name}
          required
          value={name}
          onChangeText={setName}
          placeholder="مثال: ليزينوبريل 10 ملغ"
        />
        <Field
          label="الجرعة المعتادة"
          recognized={recognized.dose}
          value={dose}
          onChangeText={setDose}
          placeholder="مثال: قرص واحد · صباحاً"
        />
        <Field
          label="عدد التجديدات المتبقية"
          recognized={recognized.refills}
          value={refills}
          onChangeText={setRefills}
          placeholder="مثال: 3"
          numeric
        />
        <Field
          label="الطبيب"
          recognized={recognized.doctor}
          value={doctor}
          onChangeText={setDoctor}
          placeholder="مثال: د. أحمد سامي"
        />
        <Field
          label="رقم الوصفة"
          recognized={recognized.rxNumber}
          value={rxNumber}
          onChangeText={setRxNumber}
          placeholder="مثال: 47820094"
          numeric
        />

      </ScrollView>

      <View style={s.footer}>
        <Button
          variant="primary"
          full
          onPress={handleSubmit}
          disabled={!canSubmit}
          label="إضافة إلى وصفاتي"
          icon="add"
        />
        <Button
          variant="secondary"
          full
          onPress={onRescan}
          label="إعادة المسح"
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
    gap:               14,
  },

  // ── Warning banner ────────────────────────────────────────────────────────────
  banner: {
    alignItems:      "flex-start",
    gap:             10,
    padding:         12,
    backgroundColor: kit.color.warnTint,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.warn,
  },
  bannerIconWell: {
    width:           28,
    height:          28,
    borderRadius:    9,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  bannerText: {
    flex:               1,
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Field ─────────────────────────────────────────────────────────────────────
  fieldWrap: {
    gap: 6,
  },
  labelRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  fieldLabel: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  fieldInput: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    backgroundColor:    kit.color.surface,
    borderRadius:       kit.radius.lg,
    borderWidth:        1.5,
    borderColor:        kit.color.line,
    paddingHorizontal:  14,
    paddingVertical:    12,
    includeFontPadding: false,
  },

  // ── OCR badge ────────────────────────────────────────────────────────────────
  badge: {
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.accent,
  },
  badgeText: {
    fontFamily:         theme.fonts.black,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  footer: {
    gap:               8,
    padding:           20,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
    backgroundColor:   kit.color.canvas,
  },
});
