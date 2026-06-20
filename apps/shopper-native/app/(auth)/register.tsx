/**
 * Register — 2026 V5.
 *
 * Key fixes vs V4:
 *  • All text-content language decisions use i18n.language from the hook,
 *    NOT the module-level IS_RTL constant (which reads I18nManager.isRTL and
 *    can be false on web even when the app language is Arabic).
 *  • Progress bar redesigned — 4 connected dots, no cramped text labels.
 *    Step title comes from the step-header below.
 *  • Strength-meter labels fully translated via i18n keys.
 *  • Layout constants (flexDirection, textAlign) still use module-level
 *    IS_RTL — that is correct for native where forceRTL is active.
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
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
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
import { signInWithProvider } from "@/features/auth/socialAuth";
import { LangSwitcher }   from "@/features/auth/components/LangSwitcher";
import { SocialButtons, type SocialProvider } from "@/features/auth/components/SocialButtons";
import { AuthDivider }    from "@/features/auth/components/AuthDivider";
import { AppLogo }        from "@/shared/components/AppLogo";
import { track }          from "@/lib/analytics";
import { captureError }   from "@/lib/crashReporter";
import { requestAndStoreLocation } from "@/lib/requestLocation";
import { Input }          from "@/components/ui/Input";
import { Button }         from "@/shared/kit";
import { Text as UIText } from "@/shared/ui";
import { kit }            from "@/shared/kit";
import { theme }          from "@/shared/theme";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON, FORWARD_CHEVRON } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// Layout direction — set once at module load (driven by I18nManager.forceRTL on native).
// Used ONLY for layout (flexDirection, textAlign, etc.), NOT for text content decisions.
const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const TOTAL_STEPS = 4;

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS BAR — 4 connected dots, no text labels
// ═══════════════════════════════════════════════════════════════════════════════

function ProgressBar({ current }: { current: number }) {
  const reduced = useReducedMotion() ?? false;

  return (
    <View style={pb.wrap}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const num      = i + 1;
        const isDone   = num < current;
        const isActive = num === current;
        return (
          <React.Fragment key={num}>
            {/* connector line between dots */}
            {i > 0 && (
              <View style={[pb.line, (isDone || isActive) && pb.lineDone]} />
            )}
            <View
              style={[
                pb.dot,
                isDone   && pb.dotDone,
                isActive && pb.dotActive,
              ]}>
              {isDone ? (
                <Ionicons name="checkmark" size={10} color={kit.color.onAccent} />
              ) : (
                <UIText style={[pb.dotNum, isActive && pb.dotNumActive]}>
                  {num}
                </UIText>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const pb = StyleSheet.create({
  wrap: {
    flexDirection: "row",     // always physical LTR — mirrors correctly under forceRTL
    alignItems:    "center",
    flex:          1,
  },
  line: {
    flex:            1,
    height:          2,
    backgroundColor: kit.color.line,
  },
  lineDone: { backgroundColor: kit.color.accentDeep },
  dot: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    flexShrink:      0,
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
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD STRENGTH METER
// Labels come from i18n so they respond to language without a reload.
// ═══════════════════════════════════════════════════════════════════════════════

function scorePassword(p: string): { score: 0|1|2|3|4; color: string } {
  let s = 0;
  if (p.length >= 6)  s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)   && /[^a-zA-Z0-9]/.test(p)) s++;
  const colors = [
    kit.color.lineStrong, kit.color.danger, kit.color.warn,
    kit.color.accentDeep, kit.color.success,
  ];
  const clamped = Math.min(s, 4) as 0|1|2|3|4;
  return { score: clamped, color: colors[clamped] };
}

function StrengthMeter({ password }: { password: string }) {
  const { t } = useTranslation();
  const { score, color } = useMemo(() => scorePassword(password), [password]);

  // Labels keyed in i18n — always correct language regardless of IS_RTL
  const labels = [
    "—",
    t("auth.strengthWeak"),
    t("auth.strengthFair"),
    t("auth.strengthStrong"),
    t("auth.strengthGreat"),
  ];

  if (password.length === 0) return null;
  return (
    <View style={sm.wrap}>
      <View style={sm.bars}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[sm.bar, { backgroundColor: i <= score ? color : kit.color.well }]}
          />
        ))}
      </View>
      <UIText style={[sm.label, { color }]}>{labels[score]}</UIText>
    </View>
  );
}

const sm = StyleSheet.create({
  wrap:  { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10, marginTop: -4 },
  bars:  { flexDirection: "row", gap: 4, flex: 1 },
  bar:   { flex: 1, height: 4, borderRadius: 2 },
  label: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    minWidth:           52,
    textAlign:          IS_RTL ? "left" : "right",
    includeFontPadding: false,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION CARD — Step 4
// ═══════════════════════════════════════════════════════════════════════════════

function ConfirmCard({
  name, email, phone, skipPhone, onEdit,
}: {
  name: string; email: string; phone: string; skipPhone: boolean;
  onEdit: () => void;
}) {
  const { t } = useTranslation();

  const rows: { icon: IoniconsName; label: string; value: string; faint?: boolean }[] = [
    { icon: "person-outline", label: t("auth.reviewName"),  value: name  },
    { icon: "mail-outline",   label: t("auth.reviewEmail"), value: email },
    {
      icon:  "call-outline",
      label: t("auth.reviewPhone"),
      value: (skipPhone || !phone) ? t("auth.reviewPhoneSkipped") : phone,
      faint: skipPhone || !phone,
    },
  ];

  return (
    <View style={cc.card}>
      {rows.map((row, i) => (
        <React.Fragment key={row.label}>
          <View style={cc.row}>
            <View style={cc.iconWell}>
              <Ionicons name={row.icon} size={15} color={kit.color.accentDeep} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <UIText style={cc.rowLabel}>{row.label}</UIText>
              <UIText style={[cc.rowValue, row.faint && cc.rowValueFaint]} numberOfLines={1}>
                {row.value}
              </UIText>
            </View>
          </View>
          {i < rows.length - 1 && <View style={cc.sep} />}
        </React.Fragment>
      ))}
      <Pressable onPress={onEdit} hitSlop={8} style={cc.editBtn}>
        <Ionicons name="create-outline" size={13} color={kit.color.accentDeep} />
        <UIText style={cc.editLabel}>{t("auth.editDetails")}</UIText>
      </Pressable>
    </View>
  );
}

const cc = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.xl,
    borderWidth:     1,
    borderColor:     kit.color.line,
    padding:         18,
    gap:             14,
    ...kit.shadow.raised,
  },
  row: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           12,
  },
  iconWell: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  rowLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    letterSpacing:      0.4,
    color:              kit.color.inkFaint,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  rowValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  rowValueFaint: { color: kit.color.inkFaint, fontFamily: theme.fonts.regular },
  sep:  { height: 1, backgroundColor: kit.color.well, marginHorizontal: -18 },
  editBtn: {
    flexDirection:   flexRow(IS_RTL),
    alignItems:      "center",
    alignSelf:       IS_RTL ? "flex-start" : "flex-end",
    gap:             4,
    paddingVertical: 4,
  },
  editLabel: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// STEP META — icons only; titles/subs come from i18n
// ═══════════════════════════════════════════════════════════════════════════════

const STEP_ICONS: IoniconsName[] = [
  "person-outline",
  "lock-closed-outline",
  "call-outline",
  "checkmark-circle-outline",
];
const STEP_TITLE_KEYS = ["auth.step1Title", "auth.step2Title", "auth.step3Title", "auth.step4Title"];
const STEP_SUB_KEYS   = ["auth.step1Sub",   "auth.step2Sub",   "auth.step3Sub",   "auth.step4Sub"  ];

// ═══════════════════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function RegisterScreen() {
  const { t, i18n } = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const reduced = useReducedMotion() ?? false;

  const [step,      setStep]      = useState<1|2|3|4>(1);
  const [stepDir,   setStepDir]   = useState<"fwd" | "bwd">("fwd");
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [phone,     setPhone]     = useState("");
  const [skipPhone, setSkipPhone] = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [otpPhone,  setOtpPhone]  = useState<string | null>(null);

  // Breathing halo (step 1 only)
  const halo = useSharedValue(0.4);
  useEffect(() => {
    if (reduced || step !== 1) { halo.value = 0.5; return; }
    halo.value = withRepeat(
      withTiming(0.8, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1, true,
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
      setStepDir("fwd");
      setStep(2);
    } else if (step === 2) {
      if (password.length < 6) { setError(t("auth.passwordMinLength")); return; }
      setStepDir("fwd");
      setStep(3);
    } else if (step === 3) {
      const clean = phone.replace(/\D/g, "");
      if (!skipPhone && clean && !/^01[0125]\d{8}$/.test(clean)) {
        setError(t("auth.invalidPhone"));
        return;
      }
      setStepDir("fwd");
      setStep(4);
    }
  };

  const handleRegister = async () => {
    setError(null);
    const clean    = phone.replace(/\D/g, "");
    const hasPhone = !skipPhone && clean.length > 0;
    setLoading(true);
    track("signup_attempted", { has_phone: hasPhone });
    try {
      const result = await signUp(
        email.trim().toLowerCase(),
        password,
        name.trim(),
        skipPhone ? undefined : clean || undefined,
      );
      track("signup_completed");
      if (!result.hasSession) {
        setError(hasPhone ? t("auth.emailConfirmationWithPhone") : t("auth.emailConfirmationNoPhone"));
        return;
      }
      if (hasPhone && PHONE_VERIFICATION_ENABLED) {
        try {
          const e164 = await sendPhoneOtp(clean);
          setOtpPhone(e164);
        } catch (e) {
          captureError(e, { surface: "register", step: "send_otp" });
          setError(t("auth.otpSendFailedContinue"));
          setTimeout(() => { requestAndStoreLocation(); router.replace("/(tabs)"); }, 2200);
        }
      } else {
        requestAndStoreLocation();
        router.replace("/(tabs)");
      }
    } catch (e) {
      captureError(e, { surface: "register" });
      track("signup_failed", { reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
      setError(getAuthError(e, i18n.language));
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerified = () => {
    setOtpPhone(null);
    requestAndStoreLocation();
    router.replace("/(tabs)");
  };

  const handleOtpCancel = () => {
    setOtpPhone(null);
    requestAndStoreLocation();
    router.replace("/(tabs)");
  };

  const handleSocial = async (provider: SocialProvider) => {
    track("social_signup_tapped", { provider });
    setSocialLoading(true);
    try {
      const result = await signInWithProvider(provider);
      if (result === "error") setError(t("auth.socialComingSoon"));
    } finally {
      setSocialLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 1) { router.back(); return; }
    setStepDir("bwd");
    setStep((step - 1) as 1|2|3|4);
  };

  const isLastStep = step === TOTAL_STEPS;
  const idx        = step - 1;

  // Direction-aware slide animations
  const slideIn  = stepDir === "fwd" ? SlideInRight.duration(260).springify().damping(22)
                                     : SlideInLeft.duration(260).springify().damping(22);
  const slideOut = stepDir === "fwd" ? SlideOutLeft.duration(200)
                                     : SlideOutRight.duration(200);

  // Step label string — uses i18n so it's always in the right language
  const stepLabel = t("auth.stepLabel", { step, total: TOTAL_STEPS });

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={s.root}
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* ── Top bar: back + dots + lang switcher ────────────────────────── */}
        <View style={s.topBar}>
          <Pressable
            onPress={handleBack}
            hitSlop={10}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}>
            <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.inkSoft} />
          </Pressable>
          <ProgressBar current={step} />
          <LangSwitcher />
        </View>

        {/* ── Brand mark — step 1 only ────────────────────────────────────── */}
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

        {/* ── Step header — re-mounts on step change ──────────────────────── */}
        <Animated.View
          key={`hdr-${step}`}
          entering={slideIn}
          exiting={slideOut}
          style={s.stepHeader}>
          <View style={s.stepIconTile}>
            <Ionicons name={STEP_ICONS[idx]} size={22} color={kit.color.accentDeep} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            {/* stepLabel is always in the right language (from i18n, not IS_RTL) */}
            <UIText style={s.stepEyebrow}>{stepLabel}</UIText>
            <UIText style={s.stepTitle}>{t(STEP_TITLE_KEYS[idx])}</UIText>
            <UIText style={s.stepSub}>{t(STEP_SUB_KEYS[idx])}</UIText>
          </View>
        </Animated.View>

        {/* ── Step 1: social shortcut → or → name/email form ──────────────── */}
        {step === 1 && (
          <Animated.View entering={FadeInUp.delay(60).duration(320)} style={s.socialBlock}>
            <SocialButtons onSocialPress={handleSocial} loading={socialLoading} />
            <AuthDivider />
          </Animated.View>
        )}

        {/* ── Form (steps 1–3) ────────────────────────────────────────────── */}
        {step < 4 && (
          <Animated.View
            key={`form-${step}`}
            entering={slideIn}
            exiting={slideOut}
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
                  leftIcon={
                    <Ionicons name="lock-closed-outline" size={18} color={kit.color.inkFaint} />
                  }
                  rightIcon={
                    <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                      <Ionicons
                        name={showPass ? "eye-off-outline" : "eye-outline"}
                        size={18}
                        color={kit.color.inkFaint}
                      />
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
                  onPress={() => { setSkipPhone(v => !v); if (!skipPhone) setPhone(""); }}
                  hitSlop={6}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: skipPhone }}
                  style={s.skipRow}>
                  <View style={[s.skipCheck, skipPhone && s.skipCheckActive]}>
                    {skipPhone && (
                      <Ionicons name="checkmark" size={12} color={kit.color.onAccent} />
                    )}
                  </View>
                  <UIText style={[s.skipText, { color: skipPhone ? kit.color.accentDeep : kit.color.inkSoft }]}>
                    {t("auth.skipPhone")}
                  </UIText>
                </Pressable>
              </>
            )}
          </Animated.View>
        )}

        {/* ── Confirmation card — step 4 ───────────────────────────────────── */}
        {step === 4 && (
          <Animated.View
            key="form-4"
            entering={slideIn}
            exiting={slideOut}>
            {error && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                style={[s.errorBox, { marginBottom: 12 }]}>
                <View style={s.errorIcon}>
                  <Ionicons name="alert-circle" size={15} color={kit.color.danger} />
                </View>
                <UIText style={s.errorText}>{error}</UIText>
              </Animated.View>
            )}
            <ConfirmCard
              name={name}
              email={email}
              phone={phone}
              skipPhone={skipPhone}
              onEdit={() => { setError(null); setStep(1); }}
            />
          </Animated.View>
        )}

        {/* ── Primary CTA ─────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(200).duration(360)} style={{ marginTop: 4 }}>
          <Button
            label={isLastStep ? t("auth.confirmAndCreate") : t("auth.nextStep")}
            variant="primary"
            size="lg"
            full
            loading={loading}
            onPress={isLastStep ? handleRegister : goNext}
            icon={isLastStep ? "checkmark" : FORWARD_CHEVRON}
            iconEnd
          />
        </Animated.View>

        {/* ── Step 1 footer ────────────────────────────────────────────────── */}
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

        {/* ── Step 4 terms ─────────────────────────────────────────────────── */}
        {step === 4 && (
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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: kit.color.canvas },
  content: { flexGrow: 1, paddingHorizontal: 22, gap: 16 },

  topBar: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           10,
  },
  iconBtn: {
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

  brandBlock: { alignItems: "center" },
  logoWrap: {
    width: 96, height: 96,
    alignItems: "center", justifyContent: "center",
  },
  logoHalo: {
    position: "absolute", width: 96, height: 96,
    borderRadius: 48, backgroundColor: kit.color.accentTint,
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
    letterSpacing:      1,
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

  socialBlock: { gap: 12 },

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

  skipRow:  { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 },
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
  skipText: { fontFamily: theme.fonts.bold, fontSize: 12, includeFontPadding: false },

  footer: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
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
    includeFontPadding: false,
  },
});
