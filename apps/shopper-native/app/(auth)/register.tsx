/**
 * Register — complete reimagining (2026 V3).
 *
 * Premium 3-step onboarding journey:
 *   Step 1 — Identity   (name + email)
 *   Step 2 — Security   (password with strength meter)
 *   Step 3 — Contact    (phone, optional)
 *
 * What changed vs V2:
 *   • New ProgressBar component — linear track + step labels (not 3 invisible
 *     pills). Communicates "where you are" at a glance.
 *   • Cinematic step header — large ink-tile icon + title + supporting copy
 *     re-mounts on step change for a clean staggered entrance.
 *   • Password strength meter (4 levels) on step 2.
 *   • Identical brand language to the new login screen — breathing halo on
 *     step 1 only (anchors the journey start).
 *
 * Logic: signUp / sendPhoneOtp / PhoneVerifyModal flow unchanged.
 */

import React, { useEffect, useMemo, useState } from "react";
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
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
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

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR — Linear track + step labels
// ═══════════════════════════════════════════════════════════════════════════════

const STEP_LABELS = IS_RTL
  ? ["الهوية", "كلمة المرور", "التواصل"]
  : ["Identity", "Security", "Contact"];

function ProgressBar({ current, total }: { current: number; total: number }) {
  const reduced = useReducedMotion() ?? false;
  const progress = useSharedValue(current / total);

  useEffect(() => {
    const target = current / total;
    progress.value = reduced
      ? target
      : withTiming(target, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [current, total, reduced, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as `${number}%`,
  }));

  return (
    <View style={pb.wrap}>
      {/* Labels */}
      <View style={pb.labelRow}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === current;
          const isDone   = stepNum < current;
          return (
            <View key={label} style={pb.labelCell}>
              <View style={[pb.dot, isDone && pb.dotDone, isActive && pb.dotActive]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={10} color={kit.color.onAccent} />
                ) : (
                  <UIText style={[pb.dotNum, isActive && pb.dotNumActive]}>
                    {stepNum}
                  </UIText>
                )}
              </View>
              <UIText
                style={[pb.label, (isActive || isDone) && pb.labelActive]}
                numberOfLines={1}>
                {label}
              </UIText>
            </View>
          );
        })}
      </View>

      {/* Track */}
      <View style={pb.track}>
        <Animated.View style={[pb.fill, fillStyle]} />
      </View>
    </View>
  );
}

const pb = StyleSheet.create({
  wrap: { gap: 10 },
  labelRow: {
    flexDirection:  flexRow(IS_RTL),
    justifyContent: "space-between",
    alignItems:     "center",
  },
  labelCell: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           6,
  },
  dot: {
    width:           20,
    height:          20,
    borderRadius:    10,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  dotActive: {
    backgroundColor: kit.color.ink,
    borderColor:     kit.color.ink,
  },
  dotDone: {
    backgroundColor: kit.color.accentDeep,
    borderColor:     kit.color.accentDeep,
  },
  dotNum: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  dotNumActive: { color: kit.color.onInk },
  label: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  labelActive: { color: kit.color.ink },
  track: {
    height:          4,
    borderRadius:    2,
    backgroundColor: kit.color.well,
    overflow:        "hidden",
  },
  fill: {
    height:          "100%",
    backgroundColor: kit.color.accentDeep,
    borderRadius:    2,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD STRENGTH METER
// ═══════════════════════════════════════════════════════════════════════════════

function scorePassword(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  let score = 0;
  if (p.length >= 6) score++;
  if (p.length >= 10) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p) && /[^a-zA-Z0-9]/.test(p)) score++;
  const labels = IS_RTL
    ? ["—", "ضعيفة", "متوسطة", "قوية", "ممتازة"]
    : ["—", "Weak", "Fair", "Strong", "Excellent"];
  const colors = [
    kit.color.lineStrong,
    kit.color.danger,
    kit.color.warn,
    kit.color.accentDeep,
    kit.color.success,
  ];
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: labels[clamped], color: colors[clamped] };
}

function StrengthMeter({ password }: { password: string }) {
  const { score, label, color } = useMemo(() => scorePassword(password), [password]);
  if (password.length === 0) return null;
  return (
    <View style={sm.wrap}>
      <View style={sm.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              sm.bar,
              { backgroundColor: i <= score ? color : kit.color.well },
            ]}
          />
        ))}
      </View>
      <UIText style={[sm.label, { color }]}>{label}</UIText>
    </View>
  );
}

const sm = StyleSheet.create({
  wrap: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           10,
    marginTop:     -4,
  },
  bars: {
    flexDirection: "row",
    gap:           4,
    flex:          1,
  },
  bar: {
    flex:         1,
    height:       4,
    borderRadius: 2,
  },
  label: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    minWidth:           48,
    textAlign:          IS_RTL ? "left" : "right",
    includeFontPadding: false,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

const STEP_META: { icon: IoniconsName; titleKey: string; subKey: string }[] = [
  { icon: "person-outline",      titleKey: "auth.step1Title", subKey: "auth.step1Sub" },
  { icon: "lock-closed-outline", titleKey: "auth.step2Title", subKey: "auth.step2Sub" },
  { icon: "call-outline",        titleKey: "auth.step3Title", subKey: "auth.step3Sub" },
];

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const reduced = useReducedMotion() ?? false;

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

  // Breathing halo (step 1 only)
  const halo = useSharedValue(0.4);
  useEffect(() => {
    if (reduced || step !== 1) {
      halo.value = 0.5;
      return;
    }
    halo.value = withRepeat(
      withTiming(0.8, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(halo);
  }, [reduced, step, halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));

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

  const meta = STEP_META[step - 1];

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={s.root}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Top bar — back + progress */}
        <View style={s.topBar}>
          <Pressable
            onPress={step === 1 ? () => router.back() : () => { setStep((step - 1) as 1 | 2 | 3); setError(null); }}
            hitSlop={10}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}>
            <Ionicons name={IS_RTL ? "chevron-forward" : "chevron-back"} size={20} color={kit.color.inkSoft} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar current={step} total={3} />
          </View>
        </View>

        {/* Brand mark — step 1 only */}
        {step === 1 && (
          <Animated.View entering={FadeIn.duration(360)} style={s.brandBlock}>
            <View style={s.logoWrap}>
              <Animated.View style={[s.logoHalo, haloStyle]} pointerEvents="none" />
              <View style={s.logoInner}>
                <AppLogo size="lg" />
              </View>
            </View>
          </Animated.View>
        )}

        {/* Cinematic step header — re-mounts on step change */}
        <Animated.View key={`hdr-${step}`} entering={FadeInDown.duration(320)} style={s.stepHeader}>
          <View style={s.stepIconTile}>
            <Ionicons name={meta.icon} size={22} color={kit.color.accentDeep} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <UIText style={s.stepEyebrow}>
              {IS_RTL ? `الخطوة ${step} من 3` : `Step ${step} of 3`}
            </UIText>
            <UIText style={s.stepTitle}>{t(meta.titleKey)}</UIText>
            <UIText style={s.stepSub}>{t(meta.subKey)}</UIText>
          </View>
        </Animated.View>

        {/* Form card — re-mounts on step change */}
        <Animated.View
          key={`form-${step}`}
          entering={FadeInUp.delay(80).duration(360).springify().damping(18)}
          style={s.formCard}>

          {error && (
            <Animated.View entering={FadeInDown.duration(200)} style={s.errorBox}>
              <View style={s.errorIcon}>
                <Ionicons name="alert-circle" size={15} color={kit.color.danger} />
              </View>
              <UIText style={s.errorText}>{error}</UIText>
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
            <>
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
              <StrengthMeter password={password} />
            </>
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
                style={s.skipRow}>
                <View style={[s.skipCheck, skipPhone && s.skipCheckActive]}>
                  {skipPhone && <Ionicons name="checkmark" size={12} color={kit.color.onAccent} />}
                </View>
                <UIText style={[s.skipText, { color: skipPhone ? kit.color.accentDeep : kit.color.inkSoft }]}>
                  {t("auth.skipPhone")}
                </UIText>
              </Pressable>
            </>
          )}
        </Animated.View>

        {/* Primary CTA */}
        <Animated.View entering={FadeInUp.delay(200).duration(360)} style={{ marginTop: 18 }}>
          <Button
            label={step < 3 ? t("auth.nextStep") : t("auth.registerBtn")}
            variant="primary"
            size="lg"
            full
            loading={loading}
            onPress={step < 3 ? goNext : handleRegister}
            icon={step < 3 ? (IS_RTL ? "chevron-back" : "chevron-forward") : "checkmark"}
            iconEnd
          />
        </Animated.View>

        {/* Step-1 footer */}
        {step === 1 && (
          <Animated.View entering={FadeIn.delay(400).duration(300)} style={s.footer}>
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
  content: { flexGrow: 1, paddingHorizontal: 22, gap: 18 },

  // Top bar with progress
  topBar: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           12,
  },
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

  // Brand (step 1)
  brandBlock: { alignItems: "center" },
  logoWrap: {
    width:           96,
    height:          96,
    alignItems:      "center",
    justifyContent:  "center",
  },
  logoHalo: {
    position:        "absolute",
    width:           96,
    height:          96,
    borderRadius:    48,
    backgroundColor: kit.color.accentTint,
  },
  logoInner: {
    width:           72,
    height:          72,
    borderRadius:    22,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.brandGlow,
  },

  // Step header
  stepHeader: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
  },
  stepIconTile: {
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.accentDeep + "22",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  stepEyebrow: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    letterSpacing:      1.2,
    color:              kit.color.accentDeep,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  stepTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           22,
    lineHeight:         28,
    letterSpacing:      -0.5,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  stepSub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Form card
  formCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    padding:         20,
    gap:             14,
    ...kit.shadow.raised,
  },
  errorBox: {
    flexDirection:   flexRow(IS_RTL),
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
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // Phone skip
  skipRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  skipCheck: {
    width:           20,
    height:          20,
    borderRadius:    7,
    borderWidth:     1.5,
    borderColor:     kit.color.lineStrong,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.surface,
    flexShrink:      0,
  },
  skipCheckActive: {
    backgroundColor: kit.color.accentDeep,
    borderColor:     kit.color.accentDeep,
  },
  skipText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    includeFontPadding: false,
  },

  // Footer
  footer: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    marginTop:      8,
  },
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
