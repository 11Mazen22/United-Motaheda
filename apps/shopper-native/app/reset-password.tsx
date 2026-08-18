/**
 * /reset-password — handles the PKCE recovery link from Supabase.
 *
 * Flow:
 *   1. User taps the reset link in their email →
 *      OS opens `shopper://reset-password?code=<pkce_code>`
 *   2. This screen exchanges the code for a recovery session.
 *   3. User enters and confirms a new password.
 *   4. `supabase.auth.updateUser({ password })` commits the change.
 *   5. On success → navigate to the main app (tabs).
 *
 * Error paths:
 *   - No code / expired code → show "link expired" panel + "request again" CTA.
 *   - Weak password / mismatch → inline validation.
 *   - Network error → surface Arabic error message.
 *
 * VIP Phase 2: LinearGradient hero → VIP light surface header (Phase 2).
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kit } from "@pharmacy/ui-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { updatePassword, getAuthError } from "@/features/auth";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/crashReporter";
import { Input } from "@/components/ui/Input";
import { Button } from "@pharmacy/ui-native";
import { Text } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type Phase = "exchanging" | "form" | "success" | "expired";
const MIN_PASSWORD_LENGTH = 8;

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

export default function ResetPasswordScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();

  const [phase,       setPhase]       = useState<Phase>("exchanging");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Guards against the exchange being attempted twice (StrictMode double-invoke).
  const startedRef = useRef(false);

  useEffect(() => {
    // `resolved` tracks whether any strategy has already moved us out of the
    // "exchanging" phase. We check it — not startedRef — inside the timeout so
    // the timeout always fires even if the exchange started but never finished.
    let resolved  = false;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const finish = (success: boolean) => {
      if (resolved || cancelled) return;
      resolved = true;
      clearTimeout(timeoutId);
      if (success) {
        track("reset_password_link_opened");
        setPhase("form");
      } else {
        setPhase("expired");
      }
    };

    // ── Hard 8-second timeout ────────────────────────────────────────────────
    // Fires regardless of whether the exchange started. If exchangeCodeForSession
    // hangs (network timeout, invalid code, server unreachable), this is the
    // only escape hatch. The previous bug: we were guarding with `!exchangedRef`
    // which was set to true before the async call — so the timeout always no-oped.
    timeoutId = setTimeout(() => finish(false), 8_000);

    // ── Strategy A: Supabase fires PASSWORD_RECOVERY automatically ───────────
    // The Supabase client auto-detects the code/hash in the URL (detectSessionInUrl)
    // and fires this event. Also fires after a successful exchangeCodeForSession.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") finish(true);
    });

    // ── Strategy B: Manual PKCE exchange ────────────────────────────────────
    // Required on native where detectSessionInUrl is false. On web, Supabase
    // may have already fired the event before this listener was attached; in
    // that case getSession() catches it first (see Strategy C below).
    if (!startedRef.current) {
      startedRef.current = true;
      const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
      const code    = typeof rawCode === "string" ? rawCode.trim() : "";
      if (code) {
        supabase.auth
          .exchangeCodeForSession(code)
          .then(({ error: exErr }) => {
            // On success the PASSWORD_RECOVERY event fires → finish(true).
            // On error we move to expired directly.
            if (exErr) {
              if (__DEV__) 
              finish(false);
            }
            // Intentionally no `finish(true)` here — let the event do it so
            // we never double-call finish().
          })
          .catch(() => finish(false));
      }
    }

    // detectSessionInUrl is false on this client — Supabase never auto-processes
    // the URL, so there is no race to catch here. Do NOT call getSession() and
    // treat any existing session as a recovery; that would be a security hole
    // (any previously-signed-in user could open the password form).

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []); // intentionally runs once — params.code is read directly inside

  const validate = (): string | null => {
    if (password.length < MIN_PASSWORD_LENGTH) return t("resetPassword.minLengthError", { min: MIN_PASSWORD_LENGTH });
    if (!/[A-Za-z]/.test(password)) return t("resetPassword.noLetterError");
    if (password !== confirm)        return t("resetPassword.passwordsNoMatch");
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    track("reset_password_submitted");
    try {
      await updatePassword(password);
      track("reset_password_completed");
      setPhase("success");
    } catch (e) {
      if (__DEV__) 
      captureError(e, { surface: "reset-password" });
      setError(getAuthError(e, i18n.language));
    } finally {
      setLoading(false);
    }
  };

  const strength = getPasswordStrength(password);

  const phaseIcon = phase === "success" ? "checkmark-circle-outline"
                  : phase === "expired" ? "alert-circle-outline"
                  : "lock-open-outline";
  const phaseIconColor = phase === "success" ? kit.color.success
                       : phase === "expired"  ? kit.color.danger
                       : kit.color.accentDeep;
  const phaseIconBg   = phase === "success" ? kit.color.successTint
                       : phase === "expired"  ? kit.color.dangerTint
                       : kit.color.accentTint;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* ── VIP Header ── */}
        <Animated.View entering={FadeIn.duration(240)} style={s.header}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={10} accessibilityRole="button">
            <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
          </Pressable>
          <View style={[s.iconTile, { backgroundColor: phaseIconBg }]}>
            <Ionicons name={phaseIcon} size={22} color={phaseIconColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="card-title" align={TEXT_START} style={{ color: kit.color.ink }}>
              {phase === "success" ? t("resetPassword.titleSuccess")
               : phase === "expired" ? t("resetPassword.titleExpired")
               : t("resetPassword.titleDefault")}
            </Text>
            <Text variant="eyebrow" color="tertiary" align={TEXT_START}>
              {phase === "success" ? t("resetPassword.subtitleSuccess")
               : phase === "expired" ? t("resetPassword.subtitleExpired")
               : phase === "exchanging" ? t("resetPassword.subtitleVerifying")
               : t("resetPassword.subtitleDefault")}
            </Text>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Exchanging */}
          {phase === "exchanging" && (
            <Animated.View entering={FadeIn.duration(300)} style={s.centered}>
              <View style={s.spinnerRing}>
                <ActivityIndicator size="large" color={kit.color.accent} />
              </View>
              <Text variant="body" color="secondary" align="center" style={{ marginTop: 20 }}>
                {t("resetPassword.verifyingBody")}
              </Text>
            </Animated.View>
          )}

          {/* Expired */}
          {phase === "expired" && (
            <Animated.View entering={FadeInUp.duration(380)} style={s.stateBlock}>
              <View style={s.stateOuter}>
                <View style={[s.stateInner, { backgroundColor: kit.color.dangerTint, borderColor: `${kit.color.danger}25` }]}>
                  <Ionicons name="time-outline" size={34} color={kit.color.danger} />
                </View>
              </View>
              <Text variant="sheet-title" align="center">{t("resetPassword.expiredTitle")}</Text>
              <Text variant="body" color="secondary" align="center" style={s.stateBody}>
                {t("resetPassword.expiredBody")}
              </Text>
              <Button variant="primary" full onPress={() => router.replace("/(auth)/forgot-password")} label={t("resetPassword.requestNew")} />
              <Button variant="ghost"   full onPress={() => router.replace("/(auth)/login")}           label={t("resetPassword.backToLogin")} />
            </Animated.View>
          )}

          {/* Form */}
          {phase === "form" && (
            <Animated.View entering={FadeInUp.duration(380)} style={s.formBlock}>
              {error && (
                <Animated.View entering={FadeInDown.duration(200)} style={[s.errorBox, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={s.errorIcon}>
                    <Ionicons name="alert-circle" size={15} color={kit.color.danger} />
                  </View>
                  <Text variant="body-sm" align={TEXT_START} style={{ flex: 1, color: kit.color.danger, fontFamily: theme.fonts.bold }}>
                    {error}
                  </Text>
                </Animated.View>
              )}

              <Input
                label={t("resetPassword.newPasswordLabel")}
                placeholder={t("resetPassword.newPasswordPlaceholder")}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(null); }}
                secureTextEntry={!showPass}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={kit.color.inkFaint} />}
                rightIcon={
                  <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                    <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={kit.color.inkFaint} />
                  </Pressable>
                }
              />

              {password.length > 0 && (
                <Animated.View entering={FadeInDown.duration(200)} style={[s.strengthWrap, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={[s.strengthBarRow, { flexDirection: flexRow(IS_RTL) }]}>
                    {[0, 1, 2, 3].map((i) => (
                      <View key={i} style={[s.strengthSegment, i < strength.score && { backgroundColor: strength.color }]} />
                    ))}
                  </View>
                  <Text variant="eyebrow" style={{ color: strength.color }}>{t(strength.labelKey)}</Text>
                </Animated.View>
              )}

              <Input
                label={t("resetPassword.confirmPasswordLabel")}
                placeholder={t("resetPassword.confirmPlaceholder")}
                value={confirm}
                onChangeText={(v) => { setConfirm(v); setError(null); }}
                secureTextEntry={!showConfirm}
                leftIcon={<Ionicons name="lock-closed-outline" size={18} color={kit.color.inkFaint} />}
                rightIcon={
                  <Pressable onPress={() => setShowConfirm(!showConfirm)} hitSlop={8}>
                    <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color={kit.color.inkFaint} />
                  </Pressable>
                }
              />

              {confirm.length > 0 && (
                <Animated.View entering={FadeIn.duration(180)} style={[s.matchRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <Ionicons
                    name={password === confirm ? "checkmark-circle" : "close-circle"}
                    size={14}
                    color={password === confirm ? kit.color.success : kit.color.danger}
                  />
                  <Text variant="eyebrow" style={{ color: password === confirm ? kit.color.success : kit.color.danger }}>
                    {password === confirm ? t("resetPassword.passwordsMatch") : t("resetPassword.passwordsNoMatch")}
                  </Text>
                </Animated.View>
              )}

              <Button variant="primary" size="lg" full loading={loading} onPress={handleSubmit} style={{ marginTop: 8 }} label={t("resetPassword.saveBtn")} />
            </Animated.View>
          )}

          {/* Success */}
          {phase === "success" && (
            <Animated.View entering={FadeInUp.duration(380)} style={s.stateBlock}>
              <View style={s.stateOuter}>
                <View style={[s.stateInner, { backgroundColor: kit.color.successTint, borderColor: `${kit.color.success}30` }]}>
                  <Ionicons name="checkmark-circle-outline" size={34} color={kit.color.success} />
                </View>
              </View>
              <Text variant="sheet-title" align="center">{t("resetPassword.successTitle")}</Text>
              <Text variant="body" color="secondary" align="center" style={s.stateBody}>{t("resetPassword.successBody")}</Text>
              <Button variant="primary" full onPress={() => router.replace("/(tabs)")} label={t("resetPassword.goToApp")} />
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

  content: { padding: 20, gap: 16 },

  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  spinnerRing: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },

  // State blocks (success / expired)
  stateBlock: { alignItems: "center", gap: 16, paddingTop: 8 },
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
  stateBody: { lineHeight: 24, maxWidth: 300, textAlign: "center" },

  // Form
  formBlock: { gap: 14 },
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

  strengthWrap:   { alignItems: "center", gap: 8, paddingHorizontal: 4 },
  strengthBarRow: { flex: 1, gap: 4 },
  strengthSegment: {
    flex:             1,
    height:           4,
    borderRadius:     2,
    backgroundColor:  kit.color.lineStrong,
  },

  matchRow: { alignItems: "center", gap: 6, paddingHorizontal: 4 },
});
