/**
 * Login — premium redesign (2026 V4).
 *
 * What's new vs V3:
 *  • Language switcher in top bar (AR ↔ EN, one tap, triggers reload)
 *  • Social sign-in buttons (Google / Apple / Facebook) above the email form
 *  • "Or" divider between social and email/password
 *  • Trust badges strip at the bottom (Secure · Private · We Care)
 *
 * Layout (top → bottom):
 *   • Top bar: [Close]  [LangSwitcher]
 *   • Brand mark + breathing halo
 *   • "Welcome Back" headline + subtitle
 *   • SocialButtons
 *   • AuthDivider "or"
 *   • Elevated form card: email + password + forgot link
 *   • Primary CTA
 *   • TrustBadges
 *   • Footer: "New here? Create account"
 */

import React, { useEffect, useState } from "react";
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
import { signIn, getAuthError } from "@/features/auth";
import { signInWithProvider } from "@/features/auth/socialAuth";
import { LangSwitcher }    from "@/features/auth/components/LangSwitcher";
import { SocialButtons, type SocialProvider } from "@/features/auth/components/SocialButtons";
import { AuthDivider }     from "@/features/auth/components/AuthDivider";
import { TrustBadges }     from "@/features/auth/components/TrustBadges";
import { AppLogo }         from "@/shared/components/AppLogo";
import { track }           from "@/lib/analytics";
import { captureError }    from "@/lib/crashReporter";
import { requestAndStoreLocation } from "@/lib/requestLocation";
import { Input }           from "@/components/ui/Input";
import { Button }          from "@pharmacy/ui-native";
import { Text as UIText }  from "@pharmacy/ui-native";
import { kit }             from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { theme }           from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export default function LoginScreen() {
  const { c, isDark } = useDarkColors();
  const { t, i18n } = useTranslation();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const reduced = useReducedMotion() ?? false;

  const [email,         setEmail]         = useState("");
  const [password,      setPassword]      = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // ── Breathing brand halo ────────────────────────────────────────────────────
  const halo = useSharedValue(0.35);
  useEffect(() => {
    if (reduced) { halo.value = 0.5; return; }
    halo.value = withRepeat(
      withTiming(0.75, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(halo);
  }, [reduced, halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError(t("auth.emailPasswordRequired"));
      return;
    }
    setLoading(true);
    track("login_attempted");
    try {
      await signIn(email.trim().toLowerCase(), password);
      track("login_completed");
      requestAndStoreLocation();
      router.replace("/(tabs)");
    } catch (e) {
      if (__DEV__) 
      captureError(e, { surface: "login" });
      track("login_failed", { reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
      setError(getAuthError(e, i18n.language));
    } finally {
      setLoading(false);
    }
  };

  const handleSocial = async (provider: SocialProvider) => {
    track("social_login_tapped", { provider });
    setSocialLoading(true);
    try {
      const result = await signInWithProvider(provider);
      if (result === "error") {
        setError(t("auth.socialComingSoon"));
      }
      // "success" and "cancelled" need no action — auth-callback.tsx handles success,
      // cancelled just closes the browser and returns here.
    } finally {
      setSocialLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <View style={s.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}>
            <Ionicons name="close" size={20} color={kit.color.inkSoft} />
          </Pressable>
          <LangSwitcher />
        </View>

        {/* ── Brand mark ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)} style={s.brandBlock}>
          <View style={s.logoWrap}>
            <Animated.View style={[s.logoHalo, haloStyle]} pointerEvents="none" />
            <View style={s.logoInner}>
              <AppLogo size="lg" />
            </View>
          </View>
        </Animated.View>

        {/* ── Headline ────────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(360)}
          style={s.headlineWrap}>
          <UIText style={s.eyebrow}>
            {t("auth.eyebrowSignIn")}
          </UIText>
          <UIText style={s.headline}>{t("auth.loginWelcome")}</UIText>
          <UIText style={s.subhead}>{t("auth.loginSubtitle")}</UIText>
        </Animated.View>

        {/* ── Social login ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(180).duration(340)}>
          <SocialButtons onSocialPress={handleSocial} loading={socialLoading} />
        </Animated.View>

        {/* ── Or divider ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(240).duration(300)} style={s.dividerWrap}>
          <AuthDivider />
        </Animated.View>

        {/* ── Form card ───────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.delay(280).duration(380)}
          style={s.formCard}>

          {error && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={s.errorBox}>
              <View style={s.errorIcon}>
                <Ionicons name="alert-circle" size={15} color={kit.color.danger} />
              </View>
              <UIText style={s.errorText}>{error}</UIText>
            </Animated.View>
          )}

          <Input
            label={t("auth.email")}
            placeholder="example@email.com"
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Ionicons name="mail-outline" size={18} color={kit.color.inkFaint} />}
          />

          <Input
            label={t("auth.password")}
            placeholder="••••••••"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
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

          <View style={s.forgotRow}>
            <Pressable
              hitSlop={8}
              onPress={() => router.push("/(auth)/forgot-password")}>
              <UIText style={s.forgotLink}>{t("auth.forgotPassword")}</UIText>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Primary CTA ─────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeInUp.delay(360).duration(360)}
          style={{ marginTop: 18 }}>
          <Button
            label={t("auth.login")}
            variant="primary"
            size="lg"
            full
            loading={loading}
            onPress={handleLogin}
          />
        </Animated.View>

        {/* ── Trust strip ─────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeIn.delay(440).duration(300)}
          style={s.trustWrap}>
          <TrustBadges />
        </Animated.View>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <Animated.View
          entering={FadeIn.delay(480).duration(300)}
          style={s.footer}>
          <UIText style={s.footerText}>{t("auth.noAccount")}</UIText>
          <Link href="/(auth)/register" asChild>
            <Pressable hitSlop={6}>
              <UIText style={s.footerLink}>{t("auth.createAccount")}</UIText>
            </Pressable>
          </Link>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: kit.color.canvas },
  content: { flexGrow: 1, paddingHorizontal: 22, gap: 16 },

  // Top bar
  topBar: {
    flexDirection:  flexRow(IS_RTL),
    justifyContent: "space-between",
    alignItems:     "center",
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

  // Brand
  brandBlock: { alignItems: "center", marginTop: 4 },
  logoWrap: {
    width:  104,
    height: 104,
    alignItems:     "center",
    justifyContent: "center",
  },
  logoHalo: {
    position:        "absolute",
    width:           104,
    height:          104,
    borderRadius:    52,
    backgroundColor: kit.color.accentTint,
  },
  logoInner: {
    width:           80,
    height:          80,
    borderRadius:    24,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.brandGlow,
  },

  // Headline
  headlineWrap: { alignItems: "center", gap: 5 },
  eyebrow: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    lineHeight:         16,
    letterSpacing:      1.4,
    color:              kit.color.accentDeep,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  headline: {
    fontFamily:         theme.fonts.black,
    fontSize:           30,
    lineHeight:         37,
    letterSpacing:      -0.8,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  subhead: {
    fontFamily:         theme.fonts.regular,
    fontSize:           14,
    lineHeight:         21,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
    maxWidth:           280,
  },

  // Divider spacing
  dividerWrap: { marginVertical: 2 },

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
  forgotRow: {
    flexDirection:  flexRow(IS_RTL),
    justifyContent: "flex-start",
    marginTop:      2,
  },
  forgotLink: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // Trust & footer
  trustWrap: { marginTop: 6 },
  footer: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    marginTop:      4,
    paddingBottom:  8,
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
});
