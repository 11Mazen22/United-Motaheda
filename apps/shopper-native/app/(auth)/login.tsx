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
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  useReducedMotion
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { signIn, getAuthError } from "@/features/auth";
import { supabase } from "@/lib/supabase";
import { signInWithProvider } from "@/features/auth/socialAuth";
import { LangSwitcher } from "@/features/auth/components/LangSwitcher";
import { SocialButtons } from "@/features/auth/components/SocialButtons";
import { AuthDivider } from "@/features/auth/components/AuthDivider";
import { AuthField } from "@/features/auth/components/AuthField";
import { AppLogo } from "@/shared/components/AppLogo";
import { Button, Text as UIText } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";
import type { NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export default function LoginScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const destination = redirect ? decodeURIComponent(redirect) : "/(customer)/(tabs)";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const haloPulse = useSharedValue(1);

  useEffect(() => {
    if (!reducedMotion) {
      haloPulse.value = withRepeat(withTiming(1.15, { duration: 3000 }), -1, true);
    }
  }, [reducedMotion, haloPulse]);

  const animatedHalo = useAnimatedStyle(() => ({
    transform: [{ scale: haloPulse.value }],
    opacity: 0.6 - (haloPulse.value - 1) * 2,
  }));

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t("auth.errorEmptyFields", { defaultValue: "Please enter your credentials." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const signedInUser = await signIn(email, password);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Confirmed bug: this used to always route to /(customer)/(tabs)
      // unless an explicit `redirect` param was passed — and nothing in the
      // app ever passes one pointing at /(driver). A driver re-authenticating
      // through this screen (session expiry, manual sign-out/in — anything
      // other than a cold app launch) landed in the full customer shopping
      // app with no indication anything was wrong. app/index.tsx's own
      // cold-launch redirect already does this same role check; this makes
      // the login screen agree with it instead of only handling one path.
      // Bounded and best-effort: an explicit redirect always wins, and any
      // failure here just falls back to the previous default rather than
      // blocking sign-in on it.
      if (!redirect) {
        try {
          const { data } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", signedInUser.id)
            .abortSignal(AbortSignal.timeout(4_000))
            .maybeSingle();
          const role = (data as { role?: string } | null)?.role;
          if (role === "driver") {
            router.replace("/(driver)" as never);
            return;
          }
          // Same bug, same fix, just never ported to this branch: a
          // pharmacist re-authenticating through this screen fell straight
          // through to the customer shopping app with no indication
          // anything was wrong.
          if (role === "pharmacist" || role === "admin" || role === "manager") {
            router.replace("/(pharmacist)" as never);
            return;
          }
        } catch {
          // Fall through to the default destination below.
        }
      }
      router.replace(destination as never);
    } catch (err: unknown) {
      setError(getAuthError(err));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: theme.colors.canvas.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top, flexDirection: flexRow(IS_RTL) }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={28} color={theme.colors.text.primary} />
        </Pressable>
        <LangSwitcher />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        {/* Massive Smart Hero */}
        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.heroSection}>
          <View style={styles.logoWrapper}>
            <Animated.View style={[styles.halo, { backgroundColor: theme.colors.brand.primaryLight }, animatedHalo]} />
            <AppLogo size={80} />
          </View>
          <UIText style={[styles.welcomeTitle, { color: theme.colors.text.primary }]}>{t("auth.welcomeBack", { defaultValue: "Welcome Back" })}</UIText>
          <UIText style={[styles.welcomeSub, { color: theme.colors.text.secondary }]}>{t("auth.loginSubtitle", { defaultValue: "Sign in securely to your premium pharmacy experience." })}</UIText>
        </Animated.View>

        {/* Form Card */}
        <Animated.View entering={FadeInDown.duration(600).delay(100).springify()} style={[styles.formCard, { backgroundColor: theme.colors.canvas.surface }]}>
          
          {error ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: `${theme.colors.status.error}1A`, borderColor: theme.colors.status.error }]}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.status.error} />
              <UIText style={[styles.errorText, { color: theme.colors.status.error }]}>{error}</UIText>
            </Animated.View>
          ) : null}

          <AuthField
            label={t("auth.emailLabel", { defaultValue: "Email or Phone" })}
            icon="person-outline"
            value={email}
            onChangeText={(v: string) => { setEmail(v); setError(""); }}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />
          <View style={{ height: 16 }} />
          <AuthField
            label={t("auth.passwordLabel", { defaultValue: "Password" })}
            icon="lock-closed-outline"
            value={password}
            onChangeText={(v: string) => { setPassword(v); setError(""); }}
            secure
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          <View style={[styles.optionsRow, { flexDirection: flexRow(IS_RTL) }]}>
             <Link href="/(auth)/forgot-password" asChild>
               <Pressable>
                 <UIText style={styles.forgotText}>{t("auth.forgotPassword", { defaultValue: "Forgot Password?" })}</UIText>
               </Pressable>
             </Link>
          </View>

          <Button 
            label={t("auth.loginBtn", { defaultValue: "Sign In" })}
            onPress={handleLogin}
            loading={loading}
            style={styles.loginBtn}
          />

          <View style={styles.biometricHint}>
             <Ionicons name="scan-outline" size={16} color={theme.colors.text.muted} />
             <UIText style={[styles.biometricText, { color: theme.colors.text.muted }]}>{t("auth.biometricHint", { defaultValue: "FaceID enabled for this device" })}</UIText>
          </View>

        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(200).springify()}>
          <AuthDivider />
          <SocialButtons 
            onSocialPress={(provider) => signInWithProvider(provider).catch(() => {})}
            loading={loading}
          />
        </Animated.View>

        <Animated.View entering={FadeIn.duration(800).delay(300)} style={styles.footerRow}>
          <UIText style={[styles.footerText, { color: theme.colors.text.secondary }]}>{t("auth.noAccount", { defaultValue: "New to United Pharmacy?" })}</UIText>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <UIText style={styles.footerLink}>{t("auth.createAccount", { defaultValue: "Create Account" })}</UIText>
            </Pressable>
          </Link>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 8, justifyContent: "space-between", alignItems: "center", zIndex: 10 },
  closeBtn: { padding: 8 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 60 },
  heroSection: { alignItems: "center", marginBottom: 32 },
  logoWrapper: { width: 120, height: 120, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  halo: { position: "absolute", width: 140, height: 140, borderRadius: 70 },
  welcomeTitle: { fontFamily: legacyTheme.fonts.extrabold, fontSize: 28, marginBottom: 8, textAlign: "center" },
  welcomeSub: { fontFamily: legacyTheme.fonts.regular, fontSize: 15, textAlign: "center", paddingHorizontal: 20, lineHeight: 22 },
  formCard: { borderRadius: 24, padding: 24, marginBottom: 24, ...theme.shadows[1] },
  optionsRow: { justifyContent: "flex-end", marginTop: 12, marginBottom: 24 },
  forgotText: { fontFamily: legacyTheme.fonts.bold, fontSize: 13, color: theme.colors.brand.primary },
  loginBtn: { height: 56, borderRadius: 16 },
  biometricHint: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", marginTop: 16, gap: 6 },
  biometricText: { fontFamily: legacyTheme.fonts.medium, fontSize: 12 },
  errorBox: { flexDirection: flexRow(IS_RTL), alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 16 },
  errorText: { flex: 1, fontFamily: legacyTheme.fonts.bold, fontSize: 13 },
  footerRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", marginTop: 32, gap: 6 },
  footerText: { fontFamily: legacyTheme.fonts.medium, fontSize: 14 },
  footerLink: { fontFamily: legacyTheme.fonts.bold, fontSize: 14, color: theme.colors.brand.primary },
  });
}
