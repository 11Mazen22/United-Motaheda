/**
 * /(auth)/verify-email — the screen a new account lands on immediately after
 * signing up, while their confirmation email is in flight.
 *
 * Why this exists as its own route (it used to be an inline branch inside
 * register.tsx): the "we emailed you" state is not a footnote to the signup
 * form, it IS the step the user is now standing in. Giving it a route means
 * it can be deep-linked, re-entered after a background/foreground cycle, and
 * — most importantly — own the two things the inline version had no room
 * for: a real resend control with a rate-limit-aware cooldown, and a one-tap
 * jump into the device's mail app.
 *
 * The cooldown is deliberately client-side *as well as* server-side. Supabase
 * rate-limits resends per address and answers with a raw
 * `over_email_send_rate_limit` error; showing a friendly countdown instead of
 * letting the user tap into that error is the difference between "the app is
 * telling me to wait" and "the app is broken".
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Button, Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { resendConfirmationEmail, getAuthError, LangSwitcher } from "@/features/auth";
import { track } from "@/lib/analytics";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

/** Matches Supabase's own per-address resend window closely enough that the
 *  user almost never taps through into a server-side rate-limit error. */
const RESEND_COOLDOWN_SECONDS = 60;

type Feedback = { tone: "success" | "error"; message: string } | null;

export default function VerifyEmailScreen(): React.ReactElement {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { email } = useLocalSearchParams<{ email?: string }>();
  const address = typeof email === "string" ? email : "";

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [sending, setSending]   = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown ticks for the whole life of the screen; the button reads it
  // rather than the timer being started/stopped per resend.
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Ambient animation: two haloes breathing outward from the envelope tile,
  // offset by half a cycle so there is always one mid-flight.
  const halo = useSharedValue(0);
  const lift = useSharedValue(0);
  useEffect(() => {
    halo.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.ease) }), -1, false);
    lift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ), -1, false);
  }, [halo, lift]);

  const haloOuter = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + halo.value * 0.55 }],
    opacity: (1 - halo.value) * 0.28,
  }));
  const haloInner = useAnimatedStyle(() => {
    const p = (halo.value + 0.5) % 1;
    return { transform: [{ scale: 1 + p * 0.55 }], opacity: (1 - p) * 0.28 };
  });
  const tileFloat = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 5 }] }));

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || sending || !address) return;
    setSending(true);
    setFeedback(null);
    try {
      await resendConfirmationEmail(address);
      track("verify_email_resend");
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setFeedback({
        tone: "success",
        message: t("auth.verify.resendOk", { defaultValue: "Sent — check your inbox again." }),
      });
    } catch (err) {
      if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // A server-side rate limit here is not really an error the user caused;
      // fold it into the same countdown affordance rather than a red alarm.
      const raw = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
      if (raw.includes("rate limit") || raw.includes("over_email_send")) {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setFeedback({
          tone: "success",
          message: t("auth.verify.resendThrottled", { defaultValue: "Another email is already on its way — give it a minute." }),
        });
      } else {
        setFeedback({ tone: "error", message: getAuthError(err) });
      }
    } finally {
      setSending(false);
    }
  }, [address, cooldown, sending, t]);

  const handleOpenMail = useCallback(async () => {
    // No extra native dep for this: `message://` is the Apple Mail scheme and
    // a bare `mailto:` reliably resolves to whichever mail app Android has
    // set as default. Both are wrapped because a device with no mail client
    // at all should simply say so rather than throw.
    const url = Platform.OS === "ios" ? "message://" : "mailto:";
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) { await Linking.openURL(url); return; }
    } catch { /* fall through to the hint below */ }
    setFeedback({
      tone: "error",
      message: t("auth.verify.noMailApp", { defaultValue: "Couldn't find a mail app — please open your inbox manually." }),
    });
  }, [t]);

  const steps = [
    t("auth.verify.step1", { defaultValue: "Open the email from United Pharmacy." }),
    t("auth.verify.step2", { defaultValue: "Tap the verification button inside it." }),
    t("auth.verify.step3", { defaultValue: "You come straight back here, signed in." }),
  ];

  return (
    <View style={[s.root, { backgroundColor: theme.colors.canvas.background }]}>
      <View style={[s.topBar, { paddingTop: insets.top + 4, flexDirection: flexRow(IS_RTL) }]}>
        <Pressable
          onPress={() => router.replace("/(auth)/login")}
          hitSlop={12}
          style={s.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("auth.verify.backToLogin", { defaultValue: "Back to sign in" })}
        >
          <Ionicons name={BACK_CHEVRON} size={26} color={theme.colors.text.primary} />
        </Pressable>
        <LangSwitcher />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(420)} style={s.hero}>
          <View style={s.haloWrap}>
            <Animated.View style={[s.halo, { borderColor: theme.colors.brand.primary }, haloOuter]} />
            <Animated.View style={[s.halo, { borderColor: theme.colors.brand.primary }, haloInner]} />
            <Animated.View
              style={[
                s.tile,
                { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default },
                tileFloat,
              ]}
            >
              <View style={[s.tileInner, { backgroundColor: theme.colors.brand.primaryLight }]}>
                <Ionicons name="mail-unread-outline" size={38} color={theme.colors.brand.primary} />
              </View>
            </Animated.View>
          </View>

          <Animated.View entering={FadeInDown.duration(460).delay(120)} style={s.headings}>
            <UIText variant="eyebrow" color="tertiary" align="center">
              {t("auth.verify.eyebrow", { defaultValue: "ONE LAST STEP" })}
            </UIText>
            <UIText variant="sheet-title" align="center" style={s.title}>
              {t("auth.verify.title", { defaultValue: "Check your email" })}
            </UIText>
            <UIText variant="body" color="secondary" align="center" style={s.subtitle}>
              {t("auth.verify.subtitle", { defaultValue: "We sent a verification link to" })}
            </UIText>
          </Animated.View>

          {address ? (
            <Animated.View
              entering={FadeInDown.duration(460).delay(200)}
              style={[s.emailPill, {
                backgroundColor: theme.colors.brand.primaryLight,
                borderColor: `${theme.colors.brand.primary}33`,
                flexDirection: flexRow(IS_RTL),
              }]}
            >
              <Ionicons name="at-outline" size={15} color={theme.colors.brand.primary} />
              <UIText weight="bold" style={[s.emailText, { color: theme.colors.brand.primary }]} numberOfLines={1}>
                {address}
              </UIText>
            </Animated.View>
          ) : null}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(480).delay(280)}
          style={[s.card, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}
        >
          {steps.map((step, i) => (
            <View key={step} style={[s.stepRow, { flexDirection: flexRow(IS_RTL) }, i > 0 && s.stepRowGap]}>
              <View style={[s.stepDot, { backgroundColor: theme.colors.brand.primaryLight }]}>
                <UIText weight="bold" style={[s.stepNum, { color: theme.colors.brand.primary }]}>{String(i + 1)}</UIText>
              </View>
              <UIText variant="body" color="secondary" style={[s.stepText, { textAlign: TEXT_START }]}>
                {step}
              </UIText>
            </View>
          ))}
        </Animated.View>

        {feedback ? (
          <Animated.View
            entering={FadeIn.duration(220)}
            style={[s.feedback, {
              flexDirection: flexRow(IS_RTL),
              backgroundColor: feedback.tone === "success"
                ? `${theme.colors.status.success}14`
                : `${theme.colors.status.error}14`,
              borderColor: feedback.tone === "success"
                ? `${theme.colors.status.success}40`
                : `${theme.colors.status.error}40`,
            }]}
          >
            <Ionicons
              name={feedback.tone === "success" ? "checkmark-circle" : "alert-circle"}
              size={18}
              color={feedback.tone === "success" ? theme.colors.status.success : theme.colors.status.error}
            />
            <UIText
              style={[s.feedbackText, {
                color: feedback.tone === "success" ? theme.colors.status.success : theme.colors.status.error,
                textAlign: TEXT_START,
              }]}
            >
              {feedback.message}
            </UIText>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(480).delay(360)} style={s.actions}>
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
                : t("auth.verify.resend", { defaultValue: "Resend email" })
            }
            icon="refresh-outline"
            variant="outline"
            onPress={handleResend}
            loading={sending}
            disabled={cooldown > 0 || sending || !address}
            fullWidth
          />
        </Animated.View>

        <Animated.View entering={FadeIn.duration(500).delay(440)} style={s.footer}>
          <Pressable onPress={() => router.replace("/(auth)/register")} hitSlop={8}>
            <UIText weight="bold" style={[s.footerLink, { color: theme.colors.brand.primary }]}>
              {t("auth.verify.wrongEmail", { defaultValue: "Wrong address? Sign up again" })}
            </UIText>
          </Pressable>

          <Pressable onPress={() => router.replace("/(auth)/login")} hitSlop={8} style={s.footerSecondary}>
            <UIText variant="body" color="secondary">
              {t("auth.verify.backToLogin", { defaultValue: "Back to sign in" })}
            </UIText>
          </Pressable>

          <View style={[s.trustRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="shield-checkmark-outline" size={12} color={theme.colors.text.muted} />
            <UIText variant="eyebrow" color="tertiary">
              {t("auth.verify.spamHint", { defaultValue: "Not there? Check your spam folder" })}
            </UIText>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root: { flex: 1 },
    topBar: {
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 4,
    },
    backBtn: { padding: 4 },
    scroll: { paddingHorizontal: 24, paddingTop: 8, alignItems: "center" },

    hero: { alignItems: "center", width: "100%" },
    haloWrap: { width: 168, height: 168, alignItems: "center", justifyContent: "center" },
    halo: {
      position: "absolute",
      width: 108, height: 108, borderRadius: 54,
      borderWidth: 1.5,
    },
    tile: {
      width: 104, height: 104, borderRadius: 34,
      borderWidth: 1,
      alignItems: "center", justifyContent: "center",
      ...theme.shadows[3],
    },
    tileInner: {
      width: 74, height: 74, borderRadius: 25,
      alignItems: "center", justifyContent: "center",
    },

    headings: { alignItems: "center", gap: 8, maxWidth: 360, marginTop: 4 },
    title: { letterSpacing: IS_RTL ? 0 : -0.5 },
    subtitle: { lineHeight: 22 },

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

    card: {
      width: "100%",
      marginTop: 30,
      padding: 18,
      borderRadius: 22,
      borderWidth: 1,
      ...theme.shadows[1],
    },
    stepRow: { alignItems: "center", gap: 13 },
    stepRowGap: { marginTop: 15 },
    stepDot: {
      width: 27, height: 27, borderRadius: 10,
      alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    },
    stepNum: { fontSize: 13 },
    stepText: { flex: 1, lineHeight: 21 },

    feedback: {
      width: "100%",
      marginTop: 18,
      padding: 13,
      borderRadius: 15,
      borderWidth: 1,
      alignItems: "center",
      gap: 9,
    },
    feedbackText: { flex: 1, fontSize: 13.5, lineHeight: 19 },

    actions: { width: "100%", marginTop: 26, gap: 12 },

    footer: { alignItems: "center", marginTop: 30 },
    footerLink: { fontSize: 14.5 },
    footerSecondary: { marginTop: 14 },
    trustRow: { alignItems: "center", gap: 6, marginTop: 26 },
  });
}
