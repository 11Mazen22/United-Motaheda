/**
 * /(auth)/reset-password — lands here from the password-reset email link.
 *
 * Real fix: this screen used to just re-run requestPasswordReset(email),
 * i.e. it silently duplicated the "forgot password" screen and never let
 * the user actually set a new password -- even though the deep link
 * handoff in src/features/auth/context.tsx already routes here WITH a
 * recovery `code` param, and a ready-to-use updatePassword() API exists
 * (also used by the authenticated /change-password screen). The recovery
 * code was never even read.
 *
 * Real flow now:
 *   1. Exchange the `code` param for a recovery session (same PKCE
 *      handshake as /auth-callback).
 *   2. Show a "set new password" form (mirrors /change-password's
 *      strength meter + rules) and call updatePassword() on submit.
 *   3. Success -> route to login with the new password ready to use.
 *   4. Missing/invalid/expired code -> clear error state pointing back to
 *      "forgot password" instead of silently doing nothing.
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
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { TextInput } from "react-native-gesture-handler";

import { supabase } from "@/lib/supabase";
import { updatePassword, getAuthError } from "@/features/auth";
import { track } from "@/lib/analytics";
import { Button, Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { isRtl, textAlignStart, flexRow, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type Stage = "verifying" | "form" | "success" | "error";

interface PasswordRowProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  isLast?: boolean;
}

function PasswordRow({ label, value, onChangeText, placeholder, isLast = false }: PasswordRowProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  return (
    <View style={[styles.row, { borderBottomColor: isLast ? "transparent" : theme.colors.border.default }]}>
      <UIText style={[styles.rowLabel, { color: theme.colors.text.secondary, textAlign: TEXT_START, marginBottom: 8 }]}>{label}</UIText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.muted}
        secureTextEntry
        autoComplete="new-password"
        style={[styles.rowInput, { color: theme.colors.text.primary, textAlign: IS_RTL ? "right" : "left" }]}
      />
    </View>
  );
}

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const codeStr = typeof code === "string" ? code : "";

  const [stage, setStage] = useState<Stage>("verifying");
  const ran = useRef(false);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exchange the recovery code for a session once, on mount.
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!codeStr) {
      setStage("error");
      return;
    }
    track("reset_password_link_opened");
    (async () => {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(codeStr);
      setStage(exchangeError ? "error" : "form");
    })();
  }, [codeStr]);

  const strength = useMemo(() => {
    let score = 0;
    if (password.length > 5) score += 1;
    if (password.length > 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const strengthColor = useMemo(() => {
    if (strength <= 1) return theme.colors.status.error;
    if (strength <= 3) return theme.colors.status.warning;
    return theme.colors.status.success;
  }, [strength, theme]);

  const strengthLabel = useMemo(() => {
    if (password.length === 0) return "";
    if (strength <= 1) return t("auth.strengthWeak", { defaultValue: "Weak" });
    if (strength <= 3) return t("auth.strengthMedium", { defaultValue: "Fair" });
    return t("auth.strengthStrong", { defaultValue: "Strong" });
  }, [strength, password, t]);

  const handleSave = async () => {
    if (!password || !confirm) {
      setError(t("auth.errorEmptyFields", { defaultValue: "Please fill in all required fields." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    if (password !== confirm) {
      setError(t("auth.errorPasswordMismatch", { defaultValue: "Passwords do not match." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    if (password.length < 6) {
      setError(t("auth.errorPasswordTooShort", { defaultValue: "Password must be at least 6 characters." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setError(null);
    setSaving(true);
    track("reset_password_submitted");
    try {
      await updatePassword(password);
      track("reset_password_completed");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStage("success");
    } catch (err: unknown) {
      setError(getAuthError(err));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  const goToLogin = () => {
    supabase.auth.signOut().catch(() => {});
    router.replace("/(auth)/login");
  };

  if (stage === "verifying") {
    return (
      <View style={[styles.centerScreen, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.centerStack}>
          <View style={[styles.heroRing, { backgroundColor: theme.colors.brand.primaryLight }]}>
            <Ionicons name="shield-checkmark-outline" size={40} color={theme.colors.brand.primary} />
          </View>
          <UIText style={[styles.heroInstruction, { color: theme.colors.text.secondary, marginTop: 16 }]}>
            {t("auth.resetVerifying", { defaultValue: "Verifying your reset link..." })}
          </UIText>
        </Animated.View>
      </View>
    );
  }

  if (stage === "error") {
    return (
      <View style={[styles.centerScreen, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.centerStack}>
          <View style={[styles.heroRing, { backgroundColor: `${theme.colors.status.error}14` }]}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.colors.status.error} />
          </View>
          <UIText style={[styles.errorTitle, { color: theme.colors.text.primary, marginTop: 16 }]}>
            {t("auth.resetLinkInvalidTitle", { defaultValue: "This link no longer works" })}
          </UIText>
          <UIText style={[styles.heroInstruction, { color: theme.colors.text.secondary, marginTop: 6 }]}>
            {t("auth.resetLinkInvalidBody", { defaultValue: "This password reset link is invalid or has expired. Request a new one to continue." })}
          </UIText>
          <View style={{ alignSelf: "stretch", marginTop: 28, gap: 12 }}>
            <Button
              label={t("auth.resetRequestNewBtn", { defaultValue: "Request a new link" })}
              onPress={() => router.replace("/(auth)/forgot-password")}
            />
            <Button
              label={t("auth.callback.backToLogin", { defaultValue: "Back to sign in" })}
              variant="secondary"
              onPress={() => router.replace("/(auth)/login")}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  if (stage === "success") {
    return (
      <View style={[styles.centerScreen, { backgroundColor: theme.colors.canvas.background, paddingTop: insets.top }]}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.centerStack}>
          <View style={[styles.heroRing, { backgroundColor: `${theme.colors.status.success}14` }]}>
            <Ionicons name="checkmark-circle-outline" size={44} color={theme.colors.status.success} />
          </View>
          <UIText style={[styles.errorTitle, { color: theme.colors.text.primary, marginTop: 16 }]}>
            {t("auth.resetSuccessTitle", { defaultValue: "Password updated" })}
          </UIText>
          <UIText style={[styles.heroInstruction, { color: theme.colors.text.secondary, marginTop: 6 }]}>
            {t("auth.resetSuccessBody", { defaultValue: "Your password has been changed. Sign in with your new password." })}
          </UIText>
          <View style={{ alignSelf: "stretch", marginTop: 28 }}>
            <Button
              label={t("auth.resetContinueBtn", { defaultValue: "Continue to sign in" })}
              onPress={goToLogin}
            />
          </View>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View entering={FadeIn.duration(200)} style={[styles.header, { paddingTop: insets.top, backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name={BACK_CHEVRON} size={24} color={theme.colors.text.primary} />
        </Pressable>
        <UIText style={[styles.title, { color: theme.colors.text.primary }]}>{t("auth.resetTitle", { defaultValue: "Reset Password" })}</UIText>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400).delay(50)}>

          <View style={styles.heroSection}>
            <View style={[styles.heroRing, { backgroundColor: theme.colors.brand.primaryLight }]}>
              <Ionicons name="key-outline" size={40} color={theme.colors.brand.primary} />
            </View>
            <UIText style={[styles.heroInstruction, { color: theme.colors.text.secondary }]}>
              {t("auth.resetNewPasswordInstruction", { defaultValue: "Choose a new password for your account." })}
            </UIText>
          </View>

          {error && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { flexDirection: flexRow(IS_RTL), backgroundColor: `${theme.colors.status.error}1A`, borderColor: theme.colors.status.error }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.colors.status.error} />
              <UIText style={[styles.errorText, { color: theme.colors.status.error, textAlign: TEXT_START }]}>{error}</UIText>
            </Animated.View>
          )}

          <View style={[styles.cardGroup, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <PasswordRow
              label={t("auth.newPasswordLabel", { defaultValue: "New Password" })}
              value={password}
              onChangeText={(v: string) => { setPassword(v); setError(null); }}
              placeholder="••••••••"
            />

            {password.length > 0 && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.strengthContainer}>
                <View style={[styles.strengthTrack, { backgroundColor: theme.colors.border.default }]}>
                  <Animated.View
                    style={[styles.strengthFill, { width: `${(strength / 5) * 100}%`, backgroundColor: strengthColor }]}
                  />
                </View>
                <UIText style={[styles.strengthText, { color: strengthColor, textAlign: TEXT_START }]}>{strengthLabel}</UIText>
              </Animated.View>
            )}

            <PasswordRow
              label={t("auth.confirmPasswordLabel", { defaultValue: "Confirm Password" })}
              value={confirm}
              onChangeText={(v: string) => { setConfirm(v); setError(null); }}
              placeholder="••••••••"
              isLast
            />
          </View>

          <View style={styles.rulesContainer}>
            <UIText style={[styles.ruleText, { color: password.length >= 6 ? theme.colors.status.success : theme.colors.text.muted, textAlign: TEXT_START }]}>
              <Ionicons name={password.length >= 6 ? "checkmark-circle" : "ellipse-outline"} size={14} /> {t("auth.ruleLength", { defaultValue: "At least 6 characters" })}
            </UIText>
            <UIText style={[styles.ruleText, { color: /[0-9]/.test(password) ? theme.colors.status.success : theme.colors.text.muted, textAlign: TEXT_START }]}>
              <Ionicons name={/[0-9]/.test(password) ? "checkmark-circle" : "ellipse-outline"} size={14} /> {t("auth.ruleNumber", { defaultValue: "Contains a number" })}
            </UIText>
          </View>

          <Button
            label={t("common.update", { defaultValue: "Update Password" })}
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: 24 }}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
  centerScreen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  centerStack: { alignItems: "center", width: "100%" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
    gap: 16,
  },
  heroRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  heroInstruction: {
    fontFamily: legacyTheme.fonts.regular,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  errorTitle: {
    fontFamily: legacyTheme.fonts.black,
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontFamily: legacyTheme.fonts.medium,
    fontSize: 13,
  },
  rowInput: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 18,
    paddingVertical: 4,
    letterSpacing: 3,
  },
  strengthContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.strong,
  },
  strengthTrack: {
    height: 4,
    borderRadius: 2,
    width: "100%",
    overflow: "hidden",
    marginBottom: 6,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthText: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 12,
  },
  rulesContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  ruleText: {
    fontFamily: legacyTheme.fonts.medium,
    fontSize: 13,
  },
  errorBox: {
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    minWidth: 0,
    fontFamily: legacyTheme.fonts.regular,
    fontSize: 13,
  },
  });
}
