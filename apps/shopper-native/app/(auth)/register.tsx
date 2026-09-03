import React, { useMemo, useState } from "react";
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
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { signUp, getAuthError, normalizeEgyptianPhone } from "@/features/auth";

import { LangSwitcher } from "@/features/auth/components/LangSwitcher";
import { AuthField } from "@/features/auth/components/AuthField";
import { Button, Text as UIText } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";
import type { NativeTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export default function RegisterScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !phone || !password) {
      setError(t("auth.errorEmptyFields", { defaultValue: "Please fill in all fields." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    const normalizedPhone = normalizeEgyptianPhone(phone);
    if (!normalizedPhone) {
      setError(t("auth.errorInvalidPhone", { defaultValue: "Please enter a valid Egyptian phone number." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await signUp(email, password, name, normalizedPhone);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.hasSession) {
        router.replace("/(customer)/(tabs)");
      } else {
        // Email confirmation is required. This is its own screen, not an
        // inline branch: it owns the resend cooldown and mail-app handoff.
        router.replace({
          pathname: "/(auth)/verify-email",
          params: { email: email.trim().toLowerCase() },
        } as never);
      }
    } catch (err: unknown) {
      const errMsg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
      // If the server timed out (504), the account may still have been created
      // and a confirmation email may be on its way. Show the pending state instead
      // of a scary red error so the user knows to check their inbox.
      if (errMsg.includes("request_timeout") || errMsg.includes("timed out")) {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.replace({
          pathname: "/(auth)/verify-email",
          params: { email: email.trim().toLowerCase() },
        } as never);
      } else {
        setError(getAuthError(err));
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: theme.colors.canvas.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top, flexDirection: flexRow(IS_RTL) }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text.primary} />
        </Pressable>
        <LangSwitcher />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.heroSection}>
          <UIText style={[styles.welcomeTitle, { color: theme.colors.text.primary }]}>{t("auth.createAccount", { defaultValue: "Create Account" })}</UIText>
          <UIText style={[styles.welcomeSub, { color: theme.colors.text.secondary }]}>{t("auth.registerSubtitle", { defaultValue: "Join the premium pharmacy experience today." })}</UIText>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(100).springify()} style={[styles.formCard, { backgroundColor: theme.colors.canvas.surface }]}>
          
          {error ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: `${theme.colors.status.error}1A`, borderColor: theme.colors.status.error }]}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.status.error} />
              <UIText style={[styles.errorText, { color: theme.colors.status.error }]}>{error}</UIText>
            </Animated.View>
          ) : null}

          <AuthField
            label={t("auth.nameLabel", { defaultValue: "Full Name" })}
            icon="person-outline"
            value={name}
            onChangeText={(v: string) => { setName(v); setError(""); }}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
          />
          <View style={{ height: 16 }} />
          <AuthField
            label={t("auth.emailOnlyLabel", { defaultValue: "Email" })}
            icon="mail-outline"
            value={email}
            onChangeText={(v: string) => { setEmail(v); setError(""); }}
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
          />
          <View style={{ height: 16 }} />
          <AuthField
            label={t("auth.phoneLabel", { defaultValue: "Phone Number" })}
            icon="call-outline"
            value={phone}
            onChangeText={(v: string) => { setPhone(v); setError(""); }}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="next"
          />
          <View style={{ height: 16 }} />
          <AuthField
            label={t("auth.passwordLabel", { defaultValue: "Password" })}
            icon="lock-closed-outline"
            value={password}
            onChangeText={(v: string) => { setPassword(v); setError(""); }}
            secure
            autoComplete="password-new"
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <Button 
            label={t("auth.registerBtn", { defaultValue: "Sign Up" })}
            onPress={handleRegister}
            loading={loading}
            style={styles.registerBtn}
          />
          
          <View style={styles.termsHint}>
             <UIText style={[styles.termsText, { color: theme.colors.text.secondary }]}>
                {t("auth.termsAgreement", { defaultValue: "By signing up, you agree to our Terms of Service and Privacy Policy." })}
             </UIText>
          </View>

        </Animated.View>

        <Animated.View entering={FadeIn.duration(800).delay(300)} style={styles.footerRow}>
          <UIText style={[styles.footerText, { color: theme.colors.text.secondary }]}>{t("auth.haveAccount", { defaultValue: "Already have an account?" })}</UIText>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <UIText style={styles.footerLink}>{t("auth.loginBtn", { defaultValue: "Sign In" })}</UIText>
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
  heroSection: { marginBottom: 32 },
  welcomeTitle: { fontFamily: legacyTheme.fonts.extrabold, fontSize: 32, lineHeight: 40, marginBottom: 8, textAlign: TEXT_START },
  welcomeSub: { fontFamily: legacyTheme.fonts.regular, fontSize: 16, textAlign: TEXT_START, lineHeight: 24 },
  formCard: { borderRadius: 24, padding: 24, marginBottom: 24, ...theme.shadows[1] },
  registerBtn: { height: 56, borderRadius: 16, marginTop: 32 },
  termsHint: { marginTop: 16, alignItems: "center" },
  termsText: { fontFamily: legacyTheme.fonts.medium, fontSize: 12, textAlign: "center", lineHeight: 18 },
  errorBox: { flexDirection: flexRow(IS_RTL), alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 16 },
  errorText: { flex: 1, fontFamily: legacyTheme.fonts.bold, fontSize: 13 },
  footerRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", marginTop: 16, gap: 6 },
  footerText: { fontFamily: legacyTheme.fonts.medium, fontSize: 14 },
  footerLink: { fontFamily: legacyTheme.fonts.bold, fontSize: 14, color: theme.colors.brand.primary },
  });
}
