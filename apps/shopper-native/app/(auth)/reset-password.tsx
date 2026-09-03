/**
 * /(auth)/reset-password — the screen the password-reset email link opens.
 *
 * Flow (unchanged, and load-bearing — do not "simplify" it away):
 *   1. Exchange the `code` param for a recovery session (the same PKCE
 *      handshake /auth-callback performs).
 *   2. Show a "set new password" form and call updatePassword() on submit.
 *   3. Success -> sign the recovery session out and return to login, so the
 *      user actually proves the new password works.
 *   4. Missing/invalid/expired code -> a clear dead-end pointing back at
 *      "forgot password" rather than a silently inert form.
 *
 * This rewrite is visual, not behavioural. It drops the bespoke bare-
 * TextInput rows this screen used to carry and adopts the shared AuthField
 * used by every other auth screen, so the reset flow stops looking like a
 * different app than the one the user just signed in to. The strength meter
 * and rule checklist are kept — they are the only reason a user has to
 * understand *why* a password was rejected.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { supabase } from "@/lib/supabase";
import { updatePassword, getAuthError, LangSwitcher } from "@/features/auth";
import { AuthField } from "@/features/auth/components/AuthField";
import { track } from "@/lib/analytics";
import { Button, Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { isRtl, textAlignStart, flexRow, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type Stage = "verifying" | "form" | "success" | "error";

export default function ResetPasswordScreen(): React.ReactElement {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const codeStr = typeof code === "string" ? code : "";

  const [stage, setStage] = useState<Stage>("verifying");
  const ran = useRef(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Exchange the recovery code for a session once, on mount.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!codeStr) { setStage("error"); return; }
    track("reset_password_link_opened");
    (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(codeStr);
      setStage(exchangeError ? "error" : "form");
    })();
  }, [codeStr]);

  const rules = useMemo(() => ([
    { ok: password.length >= 8,      label: t("auth.ruleLength", { defaultValue: "At least 8 characters" }) },
    { ok: /[A-Z]/.test(password),    label: t("auth.ruleUpper",  { defaultValue: "One uppercase letter" }) },
    { ok: /[0-9]/.test(password),    label: t("auth.ruleNumber", { defaultValue: "One number" }) },
  ]), [password, t]);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length > 5) score += 1;
    if (password.length > 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const strengthColor = strength <= 1
    ? theme.colors.status.error
    : strength <= 3 ? theme.colors.status.warning : theme.colors.status.success;

  const strengthLabel = password.length === 0
    ? ""
    : strength <= 1 ? t("auth.strengthWeak",   { defaultValue: "Weak" })
    : strength <= 3 ? t("auth.strengthMedium", { defaultValue: "Fair" })
    :                 t("auth.strengthStrong", { defaultValue: "Strong" });

  const buzz = (type: Haptics.NotificationFeedbackType) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(type).catch(() => {});
  };

  const handleSave = async () => {
    if (!password || !confirm) {
      setError(t("auth.errorEmptyFields", { defaultValue: "Please fill in all required fields." }));
      buzz(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password !== confirm) {
      setError(t("auth.errorPasswordMismatch", { defaultValue: "Passwords do not match." }));
      buzz(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password.length < 6) {
      setError(t("auth.errorPasswordTooShort", { defaultValue: "Password must be at least 6 characters." }));
      buzz(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError(null);
    setSaving(true);
    track("reset_password_submitted");
    try {
      await updatePassword(password);
      track("reset_password_completed");
      buzz(Haptics.NotificationFeedbackType.Success);
      setStage("success");
    } catch (err: unknown) {
      setError(getAuthError(err));
      buzz(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const goToLogin = () => {
    // The recovery session is scoped to this reset; drop it so the user signs
    // in with the credential they just chose.
    supabase.auth.signOut().catch(() => {});
    router.replace("/(auth)/login");
  };

  const Shell = ({ children, showBack = true }: { children: React.ReactNode; showBack?: boolean }) => (
    <View style={[s.root, { backgroundColor: theme.colors.canvas.background }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 4, flexDirection: flexRow(IS_RTL) }]}>
        {showBack ? (
          <Pressable onPress={goToLogin} hitSlop={12} style={s.backBtn} accessibilityRole="button">
            <Ionicons name={BACK_CHEVRON} size={26} color={theme.colors.text.primary} />
          </Pressable>
        ) : <View style={s.backBtn} />}
        <LangSwitcher />
      </View>
      {children}
    </View>
  );

  // ── Verifying ───────────────────────────────────────────────────────────
  if (stage === "verifying") {
    return (
      <Shell showBack={false}>
        <View style={s.centerStack}>
          <Animated.View entering={FadeIn.duration(320)} style={s.centerInner}>
            <View style={[s.heroTile, {
              backgroundColor: theme.colors.canvas.surface,
              borderColor: theme.colors.border.default,
            }]}>
              <View style={[s.heroInner, { backgroundColor: theme.colors.brand.primaryLight }]}>
                <Ionicons name="shield-checkmark-outline" size={36} color={theme.colors.brand.primary} />
              </View>
            </View>
            <UIText variant="sheet-title" align="center" style={s.title}>
              {t("auth.resetVerifyingTitle", { defaultValue: "Checking your link" })}
            </UIText>
            <UIText variant="body" color="secondary" align="center" style={s.bodyText}>
              {t("auth.resetVerifying", { defaultValue: "Verifying your reset link..." })}
            </UIText>
          </Animated.View>
        </View>
      </Shell>
    );
  }

  // ── Invalid / expired link ──────────────────────────────────────────────
  if (stage === "error") {
    return (
      <Shell>
        <View style={s.centerStack}>
          <Animated.View entering={FadeInDown.duration(420)} style={s.centerInner}>
            <View style={[s.heroTile, {
              backgroundColor: theme.colors.canvas.surface,
              borderColor: `${theme.colors.status.error}33`,
            }]}>
              <View style={[s.heroInner, { backgroundColor: `${theme.colors.status.error}14` }]}>
                <Ionicons name="link-outline" size={36} color={theme.colors.status.error} />
              </View>
            </View>
            <UIText variant="sheet-title" align="center" style={s.title}>
              {t("auth.resetLinkInvalidTitle", { defaultValue: "This link has expired" })}
            </UIText>
            <UIText variant="body" color="secondary" align="center" style={s.bodyText}>
              {t("auth.resetLinkInvalidBody", { defaultValue: "Reset links can only be used once, and expire after 24 hours. Request a fresh one to continue." })}
            </UIText>

            <View style={s.errorActions}>
              <Button
                label={t("auth.resetRequestNewBtn", { defaultValue: "Request a new link" })}
                icon="refresh-outline"
                onPress={() => router.replace("/(auth)/forgot-password")}
                fullWidth
              />
              <Button
                label={t("auth.verify.backToLogin", { defaultValue: "Back to sign in" })}
                variant="ghost"
                onPress={goToLogin}
                fullWidth
              />
            </View>
          </Animated.View>
        </View>
      </Shell>
    );
  }

  // ── Success ─────────────────────────────────────────────────────────────
  if (stage === "success") {
    return (
      <Shell showBack={false}>
        <View style={s.centerStack}>
          <Animated.View entering={FadeInDown.duration(460).springify().damping(18)} style={s.centerInner}>
            <View style={[s.heroTile, {
              backgroundColor: theme.colors.canvas.surface,
              borderColor: `${theme.colors.status.success}33`,
            }]}>
              <View style={[s.heroInner, { backgroundColor: `${theme.colors.status.success}14` }]}>
                <Ionicons name="checkmark-circle" size={38} color={theme.colors.status.success} />
              </View>
            </View>
            <UIText variant="sheet-title" align="center" style={s.title}>
              {t("auth.resetSuccessTitle", { defaultValue: "Password updated" })}
            </UIText>
            <UIText variant="body" color="secondary" align="center" style={s.bodyText}>
              {t("auth.resetSuccessBody", { defaultValue: "Your password has been changed. Sign in with your new password to continue." })}
            </UIText>

            <View style={s.errorActions}>
              <Button
                label={t("auth.resetContinueBtn", { defaultValue: "Continue to sign in" })}
                icon="arrow-forward-outline"
                iconEnd
                onPress={goToLogin}
                fullWidth
              />
            </View>
          </Animated.View>
        </View>
      </Shell>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(460)} style={s.formHeader}>
            <View style={[s.headerTile, { backgroundColor: theme.colors.brand.primaryLight }]}>
              <Ionicons name="lock-open-outline" size={26} color={theme.colors.brand.primary} />
            </View>
            <UIText variant="eyebrow" color="tertiary" style={{ textAlign: TEXT_START }}>
              {t("auth.resetEyebrow", { defaultValue: "ACCOUNT SECURITY" })}
            </UIText>
            <UIText variant="sheet-title" style={[s.title, { textAlign: TEXT_START }]}>
              {t("auth.resetTitle", { defaultValue: "Set a new password" })}
            </UIText>
            <UIText variant="body" color="secondary" style={[s.bodyText, { textAlign: TEXT_START }]}>
              {t("auth.resetNewPasswordInstruction", { defaultValue: "Choose a strong password you have not used before." })}
            </UIText>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(480).delay(100)}
            style={[s.card, {
              backgroundColor: theme.colors.canvas.surface,
              borderColor: theme.colors.border.default,
            }]}
          >
            {error ? (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[s.errorBox, {
                  flexDirection: flexRow(IS_RTL),
                  backgroundColor: `${theme.colors.status.error}14`,
                  borderColor: `${theme.colors.status.error}40`,
                }]}
              >
                <Ionicons name="alert-circle" size={18} color={theme.colors.status.error} />
                <UIText style={[s.errorText, { color: theme.colors.status.error, textAlign: TEXT_START }]}>
                  {error}
                </UIText>
              </Animated.View>
            ) : null}

            <AuthField
              label={t("auth.newPasswordLabel", { defaultValue: "New password" })}
              icon="lock-closed-outline"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(null); }}
              secure
              autoComplete="password-new"
              returnKeyType="next"
            />

            {password.length > 0 ? (
              <Animated.View entering={FadeIn.duration(200)} style={s.strengthWrap}>
                <View style={[s.strengthTrack, { backgroundColor: theme.colors.canvas.surfaceMuted, flexDirection: flexRow(IS_RTL) }]}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        s.strengthSeg,
                        { backgroundColor: i < strength ? strengthColor : "transparent" },
                      ]}
                    />
                  ))}
                </View>
                <UIText weight="bold" style={[s.strengthLabel, { color: strengthColor, textAlign: TEXT_START }]}>
                  {strengthLabel}
                </UIText>
              </Animated.View>
            ) : null}

            <View style={s.fieldGap} />

            <AuthField
              label={t("auth.confirmPasswordLabel", { defaultValue: "Confirm new password" })}
              icon="shield-checkmark-outline"
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setError(null); }}
              secure
              error={confirm.length > 0 && confirm !== password}
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={s.rules}>
              {rules.map((r) => (
                <View key={r.label} style={[s.ruleRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <Ionicons
                    name={r.ok ? "checkmark-circle" : "ellipse-outline"}
                    size={16}
                    color={r.ok ? theme.colors.status.success : theme.colors.text.muted}
                  />
                  <UIText
                    style={[s.ruleText, {
                      color: r.ok ? theme.colors.status.success : theme.colors.text.secondary,
                      textAlign: TEXT_START,
                    }]}
                  >
                    {r.label}
                  </UIText>
                </View>
              ))}
            </View>

            <Button
              label={t("auth.resetAction", { defaultValue: "Update password" })}
              onPress={handleSave}
              loading={saving}
              fullWidth
              style={s.submitBtn}
            />
          </Animated.View>

          <Animated.View entering={FadeIn.duration(500).delay(220)} style={[s.trustRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="lock-closed-outline" size={12} color={theme.colors.text.muted} />
            <UIText variant="eyebrow" color="tertiary">
              {t("auth.callback.trustNote", { defaultValue: "Your connection is secure" })}
            </UIText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Shell>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    topBar: {
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    backBtn: { padding: 4, minWidth: 34 },

    centerStack: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
    centerInner: { alignItems: "center", maxWidth: 380, width: "100%" },

    heroTile: {
      width: 96, height: 96, borderRadius: 32,
      borderWidth: 1,
      alignItems: "center", justifyContent: "center",
      marginBottom: 24,
      ...theme.shadows[2],
    },
    heroInner: {
      width: 68, height: 68, borderRadius: 23,
      alignItems: "center", justifyContent: "center",
    },

    title: { letterSpacing: IS_RTL ? 0 : -0.5, marginBottom: 8 },
    bodyText: { lineHeight: 22 },

    errorActions: { width: "100%", marginTop: 28, gap: 10 },

    scroll: { paddingHorizontal: 24, paddingTop: 12 },
    formHeader: { marginBottom: 22 },
    headerTile: {
      width: 54, height: 54, borderRadius: 18,
      alignItems: "center", justifyContent: "center",
      marginBottom: 16,
    },

    card: {
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
      ...theme.shadows[1],
    },

    errorBox: {
      alignItems: "center",
      gap: 9,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 18,
    },
    errorText: { flex: 1, fontSize: 13.5, lineHeight: 19 },

    strengthWrap: { marginTop: 12, gap: 7 },
    strengthTrack: {
      height: 6,
      borderRadius: 3,
      overflow: "hidden",
      gap: 3,
      padding: 0,
    },
    strengthSeg: { flex: 1, borderRadius: 3 },
    strengthLabel: { fontSize: 12 },

    fieldGap: { height: 18 },

    rules: { marginTop: 18, gap: 9 },
    ruleRow: { alignItems: "center", gap: 9 },
    ruleText: { flex: 1, fontSize: 13 },

    submitBtn: { marginTop: 24 },

    trustRow: { alignItems: "center", justifyContent: "center", gap: 6, marginTop: 26 },
  });
}
