/**
 * AddRxManual — manual Rx-number entry + debounced lookup. VIP 2026.
 *
 * State machine:
 *   idle       — empty input
 *   typing     — 1–(MIN_DIGITS-1) digits
 *   looking_up — MIN_DIGITS+ digits, debounce pending OR in-flight
 *   found      — lookup returned a match
 *   not_found  — lookup returned null
 *
 * Lookup fires DEBOUNCE_MS after the last keystroke for lengths in
 * [MIN_DIGITS, MAX_DIGITS]. pendingFor is set immediately so spinner
 * appears during the quiet period too.
 *
 * Until the pharmacy lookup API ships, lookupRxNumber() always resolves null
 * — the not-found callout guides the user to WhatsApp.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kit, Button } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { Text } from "@/shared/ui";
import { flexRow, isRtl, BACK_CHEVRON } from "@/utils/layout";
import { useAuth } from "@/features/auth";
import { usePrescriptionsStore, type Prescription } from "@/stores/prescriptionsStore";
// Direct import to break require cycle:
import { RxCard } from "@/shared/components/RxCard";
import { lookupRxNumber, type RxLookupResult } from "../lib/manualLookup";

const IS_RTL      = isRtl();
const MIN_DIGITS  = 7;
const MAX_DIGITS  = 10;
const DEBOUNCE_MS = 500;

type ScreenState = "idle" | "typing" | "looking_up" | "found" | "not_found";

const WHATSAPP_RX_URL =
  `https://wa.me/201112343212?text=${encodeURIComponent("مرحباً، أريد إضافة وصفة طبية إلى حسابي.")}`;

// ─── Digit display ─────────────────────────────────────────────────────────────

function DigitDisplay({ rxNumber }: { rxNumber: string }): React.ReactElement {
  const boxCount = Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, rxNumber.length));
  const boxes    = Array.from({ length: boxCount }, (_, i) => rxNumber[i] ?? "");

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        rxNumber.length === 0
          ? "لم يتم إدخال أرقام"
          : `الأرقام المدخلة: ${rxNumber.split("").join(" ")}`
      }
      style={[s.digitsRow, { flexDirection: flexRow(IS_RTL) }]}>
      {boxes.map((d, i) => (
        <View key={i} style={[s.digitBox, d !== "" && s.digitBoxFilled]}>
          <Text
            align="center"
            style={[
              s.digitChar,
              { color: d !== "" ? kit.color.accentDeep : kit.color.inkFaint },
            ]}>
            {d || "·"}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Keypad ────────────────────────────────────────────────────────────────────

interface KeypadProps {
  onDigit:     (d: string) => void;
  onBackspace: () => void;
  disabled?:   boolean;
}

const KEY_ROWS: (string | "del" | "blank")[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["blank", "0", "del"],
];

function Keypad({ onDigit, onBackspace, disabled }: KeypadProps): React.ReactElement {
  return (
    <View style={s.keypad}>
      {KEY_ROWS.map((row, ri) => (
        <View key={ri} style={s.keypadRow}>
          {row.map((key, ci) => {
            if (key === "blank") {
              return <View key={ci} style={s.keyBlank} />;
            }
            const isDel = key === "del";
            return (
              <Pressable
                key={ci}
                onPress={isDel ? onBackspace : () => onDigit(key)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={isDel ? "حذف آخر رقم" : `رقم ${key}`}
                style={({ pressed }) => [
                  s.key,
                  pressed && s.keyPressed,
                  disabled && { opacity: 0.45 },
                ]}>
                {isDel ? (
                  <Ionicons name="backspace-outline" size={22} color={kit.color.ink} />
                ) : (
                  <Text style={s.keyText}>{key}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Callouts ──────────────────────────────────────────────────────────────────

function PrivacyCallout(): React.ReactElement {
  return (
    <View style={[s.callout, s.calloutWarn, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name="shield-checkmark-outline" size={16} color={kit.color.warn} />
      <Text style={s.calloutText}>
        رقم وصفتك خاص. نستخدمه فقط للبحث عنها لدى مقدّم الرعاية الصحية.
      </Text>
    </View>
  );
}

function FoundCallout(): React.ReactElement {
  return (
    <View style={[s.callout, s.calloutSuccess, { flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name="checkmark-circle" size={16} color={kit.color.success} />
      <Text style={[s.calloutText, { color: kit.color.success }]}>
        وُجدت! تحقق من البيانات قبل الإضافة.
      </Text>
    </View>
  );
}

function NotFoundCallout(): React.ReactElement {
  return (
    <View style={[s.callout, s.calloutDanger, { gap: 12 }]}>
      <View style={[s.calloutRow, { flexDirection: flexRow(IS_RTL) }]}>
        <Ionicons name="alert-circle" size={16} color={kit.color.danger} />
        <Text style={[s.calloutText, { color: kit.color.danger }]}>
          لم نعثر على وصفة بهذا الرقم. تأكد من الرقم، أو أرسل صورة الوصفة عبر واتساب.
        </Text>
      </View>
      <Button
        variant="secondary"
        size="sm"
        full
        icon="logo-whatsapp"
        onPress={() => { void Linking.openURL(WHATSAPP_RX_URL).catch(() => {}); }}
        label="إرسال الوصفة عبر واتساب"
      />
    </View>
  );
}

// ─── Preview Rx builder ────────────────────────────────────────────────────────

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

// ─── Screen ────────────────────────────────────────────────────────────────────

export function AddRxManual(): React.ReactElement {
  const router          = useRouter();
  const insets          = useSafeAreaInsets();
  const { user }        = useAuth();
  const addPrescription = usePrescriptionsStore((s) => s.addPrescription);

  const [rxNumber, setRxNumber] = useState("");
  const [lookup, setLookup]     = useState<RxLookupResult | null | undefined>(undefined);
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

  const onDigit     = useCallback((d: string) => {
    setRxNumber((prev) => prev.length >= MAX_DIGITS ? prev : prev + d);
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

  return (
    <View style={s.screen}>

      {/* VIP header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={s.backBtn}>
            <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
          </Pressable>
        </View>
        <View style={[s.identityRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.heroTile}>
            <Ionicons name="keypad-outline" size={22} color={kit.color.warn} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>إضافة وصفة</Text>
            <Text style={s.title}>رقم الوصفة</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop:        16,
          paddingBottom:     insets.bottom + 88,
          gap:               14,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        <Text style={s.hint}>
          رقم مكوّن من {MIN_DIGITS}–{MAX_DIGITS} أرقام، تجده على ملصق الزجاجة أو ورقة الوصفة
        </Text>

        <DigitDisplay rxNumber={rxNumber} />

        {screenState === "looking_up" && (
          <View style={[s.lookupRow, { flexDirection: flexRow(IS_RTL) }]}>
            <ActivityIndicator size="small" color={kit.color.accent} />
            <Text style={s.lookupText}>جارٍ البحث…</Text>
          </View>
        )}

        {screenState === "found" && previewRx && (
          <>
            <RxCard prescription={previewRx} variant="list" />
            <FoundCallout />
          </>
        )}

        {screenState === "not_found" && <NotFoundCallout />}

        {(screenState === "idle" || screenState === "typing") && <PrivacyCallout />}

        <Keypad
          onDigit={onDigit}
          onBackspace={onBackspace}
          disabled={screenState === "looking_up"}
        />

      </ScrollView>

      {screenState === "found" && (
        <View
          style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
          pointerEvents="box-none">
          <Button
            variant="primary"
            full
            onPress={onSubmit}
            label="إضافة إلى وصفاتي"
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

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     18,
    gap:               16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    alignItems: "center",
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  identityRow: {
    alignItems: "center",
    gap:        14,
  },
  heroTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.warnTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    textAlign:          "right",
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         36,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          "right",
    includeFontPadding: false,
  },

  // ── Hint ─────────────────────────────────────────────────────────────────────
  hint: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          "right",
    includeFontPadding: false,
  },

  // ── Digit display ─────────────────────────────────────────────────────────────
  digitsRow: {
    justifyContent:  "center",
    gap:             6,
    paddingVertical: 8,
  },
  digitBox: {
    width:           40,
    height:          52,
    borderRadius:    kit.radius.control,
    backgroundColor: kit.color.surface,
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  digitBoxFilled: {
    borderColor:     kit.color.accent,
    backgroundColor: kit.color.accentTint,
  },
  digitChar: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    lineHeight:         28,
    includeFontPadding: false,
  },

  // ── Lookup state ──────────────────────────────────────────────────────────────
  lookupRow: {
    alignItems:      "center",
    justifyContent:  "center",
    gap:             8,
    paddingVertical: 8,
  },
  lookupText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },

  // ── Callouts ─────────────────────────────────────────────────────────────────
  callout: {
    alignItems:   "flex-start",
    gap:          8,
    padding:      12,
    borderRadius: kit.radius.lg,
    borderWidth:  1,
  },
  calloutRow: {
    alignItems: "flex-start",
    gap:        8,
  },
  calloutWarn: {
    backgroundColor: kit.color.warnTint,
    borderColor:     kit.color.warn,
  },
  calloutSuccess: {
    backgroundColor: kit.color.successTint,
    borderColor:     kit.color.success,
  },
  calloutDanger: {
    backgroundColor: kit.color.dangerTint,
    borderColor:     kit.color.danger,
  },
  calloutText: {
    flex:               1,
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          "right",
    includeFontPadding: false,
  },

  // ── Keypad ────────────────────────────────────────────────────────────────────
  keypad: {
    gap:       8,
    marginTop: 4,
  },
  keypadRow: {
    flexDirection:  "row",
    gap:            8,
    justifyContent: "center",
  },
  key: {
    flex:            1,
    height:          64,
    maxWidth:        110,
    borderRadius:    kit.radius.lg,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.raised,
  },
  keyPressed: {
    backgroundColor: kit.color.well,
    transform:       [{ scale: 0.97 }],
  },
  keyBlank: {
    flex:     1,
    height:   64,
    maxWidth: 110,
  },
  keyText: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    lineHeight:         28,
    color:              kit.color.ink,
    includeFontPadding: false,
  },

  // ── CTA bar ───────────────────────────────────────────────────────────────────
  ctaBar: {
    position:          "absolute",
    left:              0,
    right:             0,
    bottom:            0,
    paddingHorizontal: 20,
    paddingTop:        12,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },
});
