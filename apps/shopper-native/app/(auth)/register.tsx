/**
 * Register — 3-step premium account creation journey (Phase 2 reinvention).
 *
 * Step 1: Identity   — Name + Email
 * Step 2: Security   — Password
 * Step 3: Contact    — Phone (optional) + submit
 *
 * Logic: unchanged (functional parity). Only step-gating added to validation.
 */

import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  signUp,
  getAuthError,
  sendPhoneOtp,
  PhoneVerifyModal,
  PHONE_VERIFICATION_ENABLED,
} from "@/features/auth";
import { AppLogo } from "@/shared/components/AppLogo";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/crashReporter";
import { requestAndStoreLocation } from "@/lib/requestLocation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/shared/kit";
import { Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={[si.root, { flexDirection: flexRow(IS_RTL) }]}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <View
          key={n}
          style={[
            si.pill,
            n < current  && si.pillDone,
            n === current && si.pillActive,
          ]}
        />
      ))}
    </View>
  );
}
const si = StyleSheet.create({
  root:        { justifyContent: "center", gap: 6 },
  pill:        { width: 8, height: 8, borderRadius: 4, backgroundColor: kit.color.lineStrong },
  pillDone:    { backgroundColor: kit.color.accent },
  pillActive:  { width: 24, backgroundColor: kit.color.ink },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();

  const [step,      setStep]      = useState<1 | 2 | 3>(1);
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [skipPhone, setSkipPhone] = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [otpPhone,  setOtpPhone]  = useState<string | null>(null);

  const clearError = () => setError(null);

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (!name.trim())  { setError(t("auth.nameRequired"));  return; }
      if (!email.trim()) { setError(t("auth.emailRequired")); return; }
      setStep(2);
    } else if (step === 2) {
      if (password.length < 6) { setError(t("auth.passwordMinLength")); return; }
      setStep(3);
    }
  };

  const handleRegister = async () => {
    setError(null);
    const phoneClean = phone.replace(/\D/g, "");
    if (!skipPhone && phoneClean && !/^01[0125]\d{8}$/.test(phoneClean)) {
      setError(t("auth.invalidPhone"));
      return;
    }
    const hasPhone = !skipPhone && phoneClean.length > 0;
    setLoading(true);
    track("signup_attempted", { has_phone: hasPhone });
    try {
      const result = await signUp(
        email.trim().toLowerCase(),
        password,
        name.trim(),
        skipPhone ? undefined : phoneClean || undefined,
      );
      track("signup_completed");

      if (!result.hasSession) {
        setError(hasPhone ? t("auth.emailConfirmationWithPhone") : t("auth.emailConfirmationNoPhone"));
        return;
      }

      if (hasPhone && PHONE_VERIFICATION_ENABLED) {
        try {
          const e164 = await sendPhoneOtp(phoneClean);
          setOtpPhone(e164);
        } catch (e) {
          captureError(e, { surface: "register", step: "send_otp" });
          if (__DEV__) console.warn("[register] sendPhoneOtp failed:", e);
          setError(t("auth.otpSendFailedContinue"));
          setTimeout(() => { requestAndStoreLocation(); router.replace("/(tabs)"); }, 2200);
        }
      } else {
        requestAndStoreLocation();
        router.replace("/(tabs)");
      }
    } catch (e) {
      if (__DEV__) console.warn("[register] signUp failed:", e);
      captureError(e, { surface: "register" });
      track("signup_failed", { reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
      setError(getAuthError(e, i18n.language));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = (_verifiedPhone: string) => {
    track("signup_completed", { phone_verified: true });
    setOtpPhone(null);
    requestAndStoreLocation();
    router.replace("/(tabs)");
  };

  const handleOtpCancel = () => {
    setOtpPhone(null);
    requestAndStoreLocation();
    router.replace("/(tabs)");
  };

  // Step metadata
  const STEP_META = [
    { icon: "person-outline",      titleKey: "auth.step1Title",    subKey: "auth.step1Sub"    },
    { icon: "lock-closed-outline", titleKey: "auth.step2Title",    subKey: "auth.step2Sub"    },
    { icon: "call-outline",        titleKey: "auth.step3Title",    subKey: "auth.step3Sub"    },
  ] as const;
  const meta = STEP_META[step - 1];

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={s.root}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={[s.topBar, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={step === 1 ? () => router.back() : () => { setStep((step - 1) as 1 | 2 | 3); setError(null); }}
            hitSlop={10}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}>
            <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={20} color={kit.color.inkSoft} />
          </Pressable>
          <StepIndicator current={step} total={3} />
          <View style={{ width: 40 }} />
        </View>

        {/* Brand mark (only on step 1) */}
        {step === 1 && (
          <Animated.View entering={FadeIn.duration(360)} style={s.brandBlock}>
            <View style={s.logoOuter}>
              <View style={s.logoInner}>
                <AppLogo size="lg" />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Step header — re-mounts on step change to trigger entrance */}
        <Animated.View key={`hdr-${step}`} entering={FadeInDown.duration(320)} style={s.stepHeader}>
          <View style={[s.stepIcon, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name={meta.icon} size={20} color={kit.color.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <UIText style={[s.stepTitle, { textAlign: TEXT_START }]}>{t(meta.titleKey)}</UIText>
            <UIText style={[s.stepSub, { textAlign: TEXT_START }]}>{t(meta.subKey)}</UIText>
          </View>
        </Animated.View>

        {/* Form content — re-mounts on step change */}
        <Animated.View key={`form-${step}`} entering={FadeInUp.delay(80).duration(360).springify().damping(18)} style={s.formCard}>
          {error && (
            <Animated.View entering={FadeInDown.duration(200)} style={[s.errorBox, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={s.errorIcon}>
                <Ionicons name="alert-circle" size={15} color={kit.color.danger} />
              </View>
              <UIText style={[s.errorText, { textAlign: TEXT_START }]}>{error}</UIText>
            </Animated.View>
          )}

          {step === 1 && (
            <>
              <Input
                label={t("auth.fullName")}
                placeholder={t("auth.namePlaceholder")}
                value={name}
                onChangeText={(v) => { setName(v); clearError(); }}
                autoCapitalize="words"
                autoComplete="name"
                leftIcon={<Ionicons name="person-outline" size={18} color={kit.color.inkFaint} />}
              />
              <Input
                label={t("auth.email")}
                placeholder="example@email.com"
                value={email}
                onChangeText={(v) => { setEmail(v); clearError(); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<Ionicons name="mail-outline" size={18} color={kit.color.inkFaint} />}
              />
            </>
          )}

          {step === 2 && (
            <Input
              label={t("auth.password")}
              placeholder={t("auth.passwordPlaceholderHint")}
              value={password}
              onChangeText={(v) => { setPassword(v); clearError(); }}
              secureTextEntry={!showPass}
              leftIcon={<Ionicons name="lock-closed-outline" size={18} color={kit.color.inkFaint} />}
              rightIcon={
                <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={kit.color.inkFaint} />
                </Pressable>
              }
            />
          )}

          {step === 3 && (
            <>
              <Input
                label={t("auth.phone")}
                placeholder="01xxxxxxxxx"
                value={phone}
                onChangeText={(v) => { setPhone(v); if (v) setSkipPhone(false); clearError(); }}
                keyboardType="phone-pad"
                optional
                editable={!skipPhone}
                leftIcon={<Ionicons name="call-outline" size={18} color={kit.color.inkFaint} />}
                hint={t("auth.phoneHint")}
              />
              <Pressable
                onPress={() => { setSkipPhone((v) => !v); if (!skipPhone) setPhone(""); }}
                hitSlop={6}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: skipPhone }}
                style={[s.skipRow, { flexDirection: flexRow(IS_RTL) }]}>
                <View style={[s.skipCheck, skipPhone && s.skipCheckActive]}>
                  {skipPhone && <Ionicons name="checkmark" size={12} color={kit.color.onInk} />}
                </View>
                <UIText style={[s.skipText, { color: skipPhone ? kit.color.accentDeep : kit.color.inkSoft }]}>
                  {t("auth.skipPhone")}
                </UIText>
              </Pressable>
            </>
          )}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(200).duration(360)}>
          <Button
            label={step < 3 ? t("auth.nextStep") : t("auth.registerBtn")}
            variant="primary"
            size="lg"
            full
            loading={loading}
            onPress={step < 3 ? goNext : handleRegister}
            style={{ marginTop: 16 }}
            icon={step < 3 ? (IS_RTL ? "chevron-back" : "chevron-forward") : "checkmark"}
            iconEnd
          />
        </Animated.View>

        {/* Footer */}
        {step === 1 && (
          <Animated.View entering={FadeIn.delay(400).duration(300)} style={[s.footer, { flexDirection: flexRow(IS_RTL) }]}>
            <UIText style={s.footerText}>{t("auth.alreadyAccount")}</UIText>
            <Link href="/(auth)/login" asChild>
              <Pressable hitSlop={6}>
                <UIText style={s.footerLink}>{t("auth.login")}</UIText>
              </Pressable>
            </Link>
          </Animated.View>
        )}

        {step === 3 && (
          <Animated.View entering={FadeIn.duration(280)}>
            <UIText style={s.terms}>{t("auth.termsNote")}</UIText>
          </Animated.View>
        )}
      </ScrollView>

      <PhoneVerifyModal
        visible={otpPhone !== null}
        initialPhone={otpPhone ?? ""}
        onVerified={handleOtpVerified}
        onCancel={handleOtpCancel}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: kit.color.canvas },
  content: { flexGrow: 1, paddingHorizontal: 22, gap: 16 },

  topBar: { alignItems: "center", justifyContent: "space-between" },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },

  // Brand
  brandBlock: { alignItems: "center" },
  logoOuter: {
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  logoInner: {
    width:           64,
    height:          64,
    borderRadius:    18,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.brandGlow,
  },

  // Step header
  stepHeader: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 14, marginBottom: 4 },
  stepIcon: {
    width:           48,
    height:          48,
    borderRadius:    15,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  stepTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    letterSpacing:      -0.4,
    color:              kit.color.ink,
    includeFontPadding: false,
  },
  stepSub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    color:              kit.color.inkFaint,
    marginTop:          2,
    includeFontPadding: false,
  },

  // Form card
  formCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     kit.color.line,
    padding:         20,
    gap:             14,
    ...kit.shadow.raised,
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

  // Phone skip
  skipRow: { alignItems: "center", gap: 8 },
  skipCheck: {
    width:           18,
    height:          18,
    borderRadius:    6,
    borderWidth:     1.5,
    borderColor:     kit.color.lineStrong,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.surface,
    flexShrink:      0,
  },
  skipCheckActive: { backgroundColor: kit.color.accent, borderColor: kit.color.accent },
  skipText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    includeFontPadding: false,
  },

  // Footer
  footer: { alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  footerText: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  footerLink: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  terms: {
    fontFamily:         theme.fonts.regular,
    fontSize:           10,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    textAlign:          "center",
    marginTop:          4,
    includeFontPadding: false,
  },
});
