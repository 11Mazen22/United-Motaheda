/**
 * ChangePasswordScreen — in-app password change for authenticated users.
 *
 * Unlike reset-password.tsx (which requires a PKCE email recovery link),
 * this screen is accessible from the Security settings row for any signed-in
 * user. It calls the same underlying `updatePassword()` API function.
 *
 * Logic: unchanged. VIP kit migration + light header + layered ring (Phase 2).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { updatePassword, getAuthError } from "@/features/auth";
import { captureError } from "@/lib/crashReporter";
import { Input } from "@/components/ui/Input";
import { Button } from "@/shared/kit";
import { Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const MIN_PASSWORD_LENGTH = 8;
type Phase = "form" | "success";

// ─── Password strength ────────────────────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; labelKey: string; color: string } {
  let score = 0;
  if (pw.length >= 8)  score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 1) return { score: 1, labelKey: "resetPassword.strengthWeak",   color: kit.color.danger  };
  if (score === 2) return { score: 2, labelKey: "resetPassword.strengthFair",   color: kit.color.warn    };
  if (score === 3) return { score: 3, labelKey: "resetPassword.strengthGood",   color: kit.color.accent  };
  return              { score: 4, labelKey: "resetPassword.strengthStrong",  color: kit.color.success };
}

export default function ChangePasswordScreen() {
  const { t, i18n } = useTranslation();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();

  const [phase,       setPhase]       = useState<Phase>("form");
  const [newPass,     setNewPass]     = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    if (newPass.length < MIN_PASSWORD_LENGTH) { setError(t("changePassword.errorShort"));   return; }
    if (newPass !== confirm)                  { setError(t("changePassword.errorMismatch")); return; }

    setSaving(true);
    try {
      await updatePassword(newPass);
      if (mountedRef.current) setPhase("success");
    } catch (e) {
      if (__DEV__) console.warn("[change-password] updatePassword failed:", e);
      captureError(e, { surface: "change-password" });
      if (mountedRef.current) setError(getAuthError(e, i18n.language));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [newPass, confirm, t, i18n.language]);

  useEffect(() => {
    if (phase !== "success") return;
    const id = setTimeout(() => { if (mountedRef.current) router.back(); }, 1500);
    return () => clearTimeout(id);
  }, [phase, router]);

  const strength = getPasswordStrength(newPass);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* ── VIP Header ── */}
        <Animated.View entering={FadeIn.duration(240)} style={s.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            android_ripple={{ color: kit.color.well, borderless: true }}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={({ pressed }) => [
              s.backBtn,
              pressed && { opacity: 0.86, transform: [{ scale: 0.96 }] },
            ]}>
            <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
          </Pressable>
          <View style={[s.iconTile, { backgroundColor: phase === "success" ? kit.color.successTint : kit.color.accentTint }]}>
            <Ionicons
              name={phase === "success" ? "checkmark-circle-outline" : "lock-closed-outline"}
              size={22}
              color={phase === "success" ? kit.color.success : kit.color.accentDeep}
            />
          </View>
          <View style={{ flex: 1 }}>
            <UIText style={[s.headerTitle, { textAlign: TEXT_START }]}>{t("changePassword.title")}</UIText>
            <UIText style={[s.headerSub, { textAlign: TEXT_START }]}>{t("changePassword.subtitle")}</UIText>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Success ── */}
          {phase === "success" && (
            <Animated.View entering={FadeIn.duration(320)} style={s.stateBlock}>
              <View style={s.stateOuter}>
                <View style={[s.stateInner, { backgroundColor: kit.color.successTint, borderColor: `${kit.color.success}30` }]}>
                  <Ionicons name="checkmark-circle-outline" size={34} color={kit.color.success} />
                </View>
              </View>
              <UIText style={s.stateTitle}>{t("changePassword.successTitle")}</UIText>
              <UIText style={s.stateBody}>{t("changePassword.successBody")}</UIText>
            </Animated.View>
          )}

          {/* ── Form ── */}
          {phase === "form" && (
            <Animated.View entering={FadeInUp.duration(320)} style={s.form}>

              {/* Layered ring icon */}
              <Animated.View entering={FadeInDown.duration(340).delay(40)} style={s.ringWrap}>
                <View style={s.ringOuter}>
                  <View style={s.ringInner}>
                    <Ionicons name="lock-closed-outline" size={30} color={kit.color.accentDeep} />
                  </View>
                </View>
              </Animated.View>

              {/* Error banner */}
              {error && (
                <Animated.View entering={FadeInDown.duration(200)} style={[s.errorBox, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={s.errorIcon}>
                    <Ionicons name="alert-circle" size={15} color={kit.color.danger} />
                  </View>
                  <UIText style={[s.errorText, { textAlign: TEXT_START }]}>{error}</UIText>
                </Animated.View>
              )}

              <Input
                label={t("changePassword.newLabel")}
                placeholder={t("changePassword.newPlaceholder")}
                value={newPass}
                onChangeText={(v) => { setNewPass(v); setError(null); }}
                secureTextEntry={!showNew}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={kit.color.inkFaint} />}
                rightIcon={
                  <Pressable onPress={() => setShowNew((p) => !p)} hitSlop={8}>
                    <Ionicons name={showNew ? "eye-off-outline" : "eye-outline"} size={18} color={kit.color.inkFaint} />
                  </Pressable>
                }
              />

              {newPass.length > 0 && (
                <Animated.View entering={FadeInDown.duration(200)} style={[s.strengthWrap, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={[s.strengthBarRow, { flexDirection: flexRow(IS_RTL) }]}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={[s.strengthSegment, i < strength.score && { backgroundColor: strength.color }]} />
                    ))}
                  </View>
                  <UIText style={[s.strengthLabel, { color: strength.color }]}>{t(strength.labelKey)}</UIText>
                </Animated.View>
              )}

              <Input
                label={t("changePassword.confirmLabel")}
                placeholder={t("changePassword.confirmPlaceholder")}
                value={confirm}
                onChangeText={(v) => { setConfirm(v); setError(null); }}
                secureTextEntry={!showConfirm}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={kit.color.inkFaint} />}
                rightIcon={
                  <Pressable onPress={() => setShowConfirm((p) => !p)} hitSlop={8}>
                    <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color={kit.color.inkFaint} />
                  </Pressable>
                }
                onSubmitEditing={handleSave}
                returnKeyType="done"
              />

              {confirm.length > 0 && (
                <Animated.View entering={FadeIn.duration(180)} style={[s.matchRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <Ionicons
                    name={newPass === confirm ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={newPass === confirm ? kit.color.success : kit.color.danger}
                  />
                  <UIText style={[s.matchText, { color: newPass === confirm ? kit.color.success : kit.color.danger }]}>
                    {newPass === confirm ? t("resetPassword.passwordsMatch") : t("changePassword.errorMismatch")}
                  </UIText>
                </Animated.View>
              )}

              <Button
                variant="primary"
                size="lg"
                full
                loading={saving}
                onPress={handleSave}
                style={{ marginTop: 8 }}
                label={saving ? t("changePassword.saving") : t("changePassword.saveBtn")}
              />
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    flexShrink:      0,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.3,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  headerSub: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  content: { padding: 20, gap: 0 },

  // State block (success)
  stateBlock: { alignItems: "center", gap: 16, paddingTop: 32 },
  stateOuter: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  stateInner: {
    width:           68,
    height:          68,
    borderRadius:    22,
    borderWidth:     1,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },
  stateTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    letterSpacing:      -0.3,
    color:              kit.color.success,
    includeFontPadding: false,
  },
  stateBody: {
    fontFamily:         theme.fonts.regular,
    fontSize:           14,
    lineHeight:         22,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    maxWidth:           280,
    includeFontPadding: false,
  },

  // Form
  form: { gap: 14, marginTop: 8 },
  ringWrap: { alignItems: "center", marginBottom: 4 },
  ringOuter: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  ringInner: {
    width:           68,
    height:          68,
    borderRadius:    22,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },

  errorBox: {
    alignItems:      "center",
    gap:             8,
    padding:         12,
    backgroundColor: kit.color.dangerTint,
    borderRadius:    12,
    borderWidth:     1,
    borderColor:     `${kit.color.danger}25`,
  },
  errorIcon: {
    width:           28,
    height:          28,
    borderRadius:    9,
    backgroundColor: `${kit.color.danger}10`,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  errorText: {
    flex:               1,
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.danger,
    includeFontPadding: false,
  },

  strengthWrap:   { alignItems: "center", gap: 8, paddingHorizontal: 4 },
  strengthBarRow: { flex: 1, gap: 4 },
  strengthSegment: {
    flex:            1,
    height:          4,
    borderRadius:    2,
    backgroundColor: kit.color.lineStrong,
  },
  strengthLabel: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    includeFontPadding: false,
  },

  matchRow:  { alignItems: "center", gap: 6, paddingHorizontal: 4 },
  matchText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    includeFontPadding: false,
  },
});
