/**
 * /(auth)/forgot-password — request a password-reset link.
 *
 * Two states in one screen: the request form, and the "we sent it" state.
 * Behaviour is unchanged from the previous version — same validation, same
 * requestPasswordReset() call, same resend semantics (resend re-sends to the
 * address already on screen rather than wiping the field, which used to read
 * as "resend" while actually doing nothing).
 *
 * What changed is the surface: this now shares the exact hero/tile/card
 * vocabulary used by verify-email and reset-password, and the sent state
 * gained the same rate-limit-aware cooldown, so the whole recovery journey
 * looks and behaves like one flow instead of three unrelated screens.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { requestPasswordReset, getAuthError, LangSwitcher } from "@/features/auth";
import { AuthField } from "@/features/auth/components/AuthField";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/crashReporter";
import { Button, Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordScreen(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);

  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [sent,      setSent]      = useState(false);
  const [cooldown,  setCooldown]  = useState(0);
  const [notice,    setNotice]    = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    timerRef.current = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const buzz = (type: Haptics.NotificationFeedbackType) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(type).catch(() => {});
  };

  const handleSubmit = async () => {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed) { setError(t("forgotPassword.emailRequired")); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("forgotPassword.invalidEmail"));
      return;
    }

    setLoading(true);
    track("forgot_password_submitted");
    try {
      await requestPasswordReset(trimmed);
      track("forgot_password_email_sent");
      buzz(Haptics.NotificationFeedbackType.Success);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setSent(true);
    } catch (e) {
      captureError(e, { surface: "forgot-password" });
      buzz(Haptics.NotificationFeedbackType.Error);
      setError(getAuthError(e, i18n.language));
    } finally {
      setLoading(false);
    }
  };

  // "Resend" re-sends to the same address the user already confirmed -- it
  // must not silently wipe the field and dump them back into an empty form.
  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    track("forgot_password_submitted");
    setResending(true);
    setNotice(null);
    try {
      await requestPasswordReset(email.trim());
      track("forgot_password_email_sent");
      buzz(Haptics.NotificationFeedbackType.Success);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice(t("auth.verify.resendOk", { defaultValue: "Sent — check your inbox again." }));
    } catch (e) {
      captureError(e, { surface: "forgot-password-resend" });
      // Supabase throttles per-address; that is not a failure worth alarming
      // the user about, it just means an email is already in flight.
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice(t("auth.verify.resendThrottled", { defaultValue: "Another email is already on its way — give it a minute." }));
    } finally {
      setResending(false);
    }
  };

  const handleOpenMail = useCallback(async () => {
    const url = Platform.OS === "ios" ? "message://" : "mailto:";
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) { await Linking.openURL(url); return; }
    } catch { /* no mail client — leave the inbox hint on screen */ }
    setNotice(t("auth.verify.noMailApp", { defaultValue: "Couldn't find a mail app — please open your inbox manually." }));
  }, [t]);

  return (
    <View style={[s.root, { backgroundColor: theme.colors.canvas.background }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 4, flexDirection: flexRow(IS_RTL) }]}>
        <Pressable
          onPress={() => (sent ? setSent(false) : router.back())}
          hitSlop={12}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("forgotPassword.backLabel")}
        >
          <Ionicons name={BACK_CHEVRON} size={26} color={theme.colors.text.primary} />
        </Pressable>
        <LangSwitcher />
      </View>

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {sent ? (
            /* ── Sent state ────────────────────────────────────────────── */
            <Animated.View entering={FadeInDown.duration(460)} style={s.sentWrap}>
              <View style={[s.heroTile, {
                backgroundColor: theme.colors.canvas.surface,
                borderColor: `${theme.colors.status.success}33`,
              }]}>
                <View style={[s.heroInner, { backgroundColor: `${theme.colors.status.success}14` }]}>
                  <Ionicons name="mail-unread-outline" size={36} color={theme.colors.status.success} />
                </View>
              </View>

              <UIText variant="eyebrow" color="tertiary" align="center">
                {t("forgotPassword.successTitle")}
              </UIText>
              <UIText variant="sheet-title" align="center" style={s.title}>
                {t("forgotPassword.titleSent")}
              </UIText>
              <UIText variant="body" color="secondary" align="center" style={s.bodyText}>
                {t("forgotPassword.successBodyPre")}
              </UIText>

              <View style={[s.emailPill, {
                backgroundColor: theme.colors.brand.primaryLight,
                borderColor: `${theme.colors.brand.primary}33`,
                flexDirection: flexRow(IS_RTL),
              }]}>
                <Ionicons name="at-outline" size={15} color={theme.colors.brand.primary} />
                <UIText weight="bold" style={[s.emailText, { color: theme.colors.brand.primary }]} numberOfLines={1}>
                  {email.trim()}
                </UIText>
              </View>

              <UIText variant="body" color="secondary" align="center" style={[s.bodyText, s.bodySpaced]}>
                {t("forgotPassword.successBodyPost")}
              </UIText>

              {notice ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={[s.notice, {
                    flexDirection: flexRow(IS_RTL),
                    backgroundColor: `${theme.colors.status.success}14`,
                    borderColor: `${theme.colors.status.success}40`,
                  }]}
                >
                  <Ionicons name="checkmark-circle" size={17} color={theme.colors.status.success} />
                  <UIText style={[s.noticeText, { color: theme.colors.status.success, textAlign: TEXT_START }]}>
                    {notice}
                  </UIText>
                </Animated.View>
              ) : null}

              <View style={s.actions}>
                <Button
                  label={t("auth.verify.openMail", { defaultValue: "Open email app" })}
                  icon="open-outline"
                  onPress={handleOpenMail}
                  fullWidth
                />
                <Button
                  label={
                    cooldown > 0
                      ? t("auth.verify.resendIn", { seconds: cooldown, defaultValue: `Resend in ${cooldown}s` })
                      : t("forgotPassword.resend")
                  }
                  icon="refresh-outline"
                  variant="outline"
                  onPress={handleResend}
                  loading={resending}
                  disabled={cooldown > 0 || resending}
                  fullWidth
                />
              </View>

              <Pressable
                onPress={() => { setSent(false); setEmail(""); setError(null); setNotice(null); }}
                hitSlop={8}
                style={s.footerAction}
              >
                <UIText weight="bold" style={[s.footerLink, { color: theme.colors.brand.primary }]}>
                  {t("forgotPassword.useAnotherEmail")}
                </UIText>
              </Pressable>

              <View style={[s.trustRow, { flexDirection: flexRow(IS_RTL) }]}>
                <Ionicons name="shield-checkmark-outline" size={12} color={theme.colors.text.muted} />
                <UIText variant="eyebrow" color="tertiary">{t("forgotPassword.spamTip")}</UIText>
              </View>
            </Animated.View>
          ) : (
            /* ── Request form ──────────────────────────────────────────── */
            <>
              <Animated.View entering={FadeInDown.duration(460)} style={s.formHeader}>
                <View style={[s.headerTile, { backgroundColor: theme.colors.brand.primaryLight }]}>
                  <Ionicons name="key-outline" size={26} color={theme.colors.brand.primary} />
                </View>
                <UIText variant="eyebrow" color="tertiary" style={{ textAlign: TEXT_START }}>
                  {t("auth.resetEyebrow", { defaultValue: "ACCOUNT SECURITY" })}
                </UIText>
                <UIText variant="sheet-title" style={[s.title, { textAlign: TEXT_START }]}>
                  {t("forgotPassword.title")}
                </UIText>
                <UIText variant="body" color="secondary" style={[s.bodyText, { textAlign: TEXT_START }]}>
                  {t("forgotPassword.hint")}
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
                    style={[s.notice, s.noticeTop, {
                      flexDirection: flexRow(IS_RTL),
                      backgroundColor: `${theme.colors.status.error}14`,
                      borderColor: `${theme.colors.status.error}40`,
                    }]}
                  >
                    <Ionicons name="alert-circle" size={17} color={theme.colors.status.error} />
                    <UIText style={[s.noticeText, { color: theme.colors.status.error, textAlign: TEXT_START }]}>
                      {error}
                    </UIText>
                  </Animated.View>
                ) : null}

                <AuthField
                  label={t("forgotPassword.emailLabel")}
                  icon="mail-outline"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />

                <Button
                  label={t("forgotPassword.sendBtn")}
                  icon="paper-plane-outline"
                  onPress={handleSubmit}
                  loading={loading}
                  fullWidth
                  style={s.submitBtn}
                />
              </Animated.View>

              <Animated.View
                entering={FadeIn.duration(500).delay(220)}
                style={[s.footerRow, { flexDirection: flexRow(IS_RTL) }]}
              >
                <UIText variant="body" color="secondary">{t("forgotPassword.rememberPassword")}</UIText>
                <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8}>
                  <UIText weight="bold" style={[s.footerLink, { color: theme.colors.brand.primary }]}>
                    {t("forgotPassword.signIn")}
                  </UIText>
                </Pressable>
              </Animated.View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
    backBtn: { padding: 4 },
    scroll: { paddingHorizontal: 24, paddingTop: 12, flexGrow: 1 },

    formHeader: { marginBottom: 22 },
    headerTile: {
      width: 54, height: 54, borderRadius: 18,
      alignItems: "center", justifyContent: "center",
      marginBottom: 16,
    },

    title: { letterSpacing: IS_RTL ? 0 : -0.5, marginBottom: 8 },
    bodyText: { lineHeight: 22 },
    bodySpaced: { marginTop: 14 },

    card: {
      borderRadius: 24,
      borderWidth: 1,
      padding: 20,
      ...theme.shadows[1],
    },
    submitBtn: { marginTop: 22 },

    sentWrap: { alignItems: "center", paddingTop: 12 },
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

    emailPill: {
      alignItems: "center",
      gap: 7,
      maxWidth: "100%",
      marginTop: 14,
      paddingVertical: 9,
      paddingHorizontal: 16,
      borderRadius: 999,
      borderWidth: 1,
    },
    emailText: { fontSize: 14.5, flexShrink: 1 },

    notice: {
      width: "100%",
      marginTop: 18,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      gap: 9,
    },
    noticeTop: { marginTop: 0, marginBottom: 18 },
    noticeText: { flex: 1, fontSize: 13.5, lineHeight: 19 },

    actions: { width: "100%", marginTop: 26, gap: 12 },

    footerAction: { marginTop: 20 },
    footerLink: { fontSize: 14.5 },
    footerRow: { justifyContent: "center", alignItems: "center", gap: 6, marginTop: 24 },
    trustRow: { alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24 },
  });
}
