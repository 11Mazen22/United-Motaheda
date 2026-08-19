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
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolateColor,
  useReducedMotion
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { register, getAuthError } from "@/features/auth";
import { LangSwitcher } from "@/features/auth/components/LangSwitcher";
import { AppLogo } from "@/shared/components/AppLogo";
import { Button, Text as UIText, kit } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { TextInput } from "react-native-gesture-handler";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

function FloatingInput({ label, icon, secure, value, onChangeText, autoCapitalize = "none", keyboardType = "default" }: any) {
  const { c } = useDarkColors();
  const [focused, setFocused] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(focused || value ? 1 : 0, { duration: 200 });
  }, [focused, value]);

  const animatedLabelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: focusAnim.value * -12 },
      { scale: 1 - focusAnim.value * 0.15 }
    ],
    color: interpolateColor(focusAnim.value, [0, 1], [c.inkFaint, kit.color.accentDeep])
  }));

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusAnim.value, [0, 1], [c.line, kit.color.accentDeep])
  }));

  return (
    <Animated.View style={[styles.inputContainer, animatedBorderStyle, { backgroundColor: c.surface, flexDirection: flexRow(IS_RTL) }]}>
      <Ionicons name={icon} size={20} color={focused ? kit.color.accentDeep : c.inkFaint} style={{ marginHorizontal: 4 }} />
      <View style={styles.inputWrapper}>
        <Animated.Text style={[styles.floatingLabel, animatedLabelStyle, { textAlign: TEXT_START }]}>{label}</Animated.Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => { setFocused(true); if (Platform.OS !== "web") Haptics.selectionAsync(); }}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          style={[styles.textInput, { color: c.ink, textAlign: IS_RTL ? "right" : "left", paddingTop: focused || value ? 8 : 0 }]}
        />
      </View>
    </Animated.View>
  );
}

export default function RegisterScreen() {
  const { c, isDark } = useDarkColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError(t("auth.errorEmptyFields", { defaultValue: "Please fill in all fields." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await register({ name, email, password });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(customer)/(tabs)");
    } catch (err: any) {
      setError(getAuthError(err));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: c.canvas }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top, flexDirection: flexRow(IS_RTL) }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="arrow-back" size={28} color={c.ink} />
        </Pressable>
        <LangSwitcher />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        
        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.heroSection}>
          <UIText style={[styles.welcomeTitle, { color: c.ink }]}>{t("auth.createAccount", { defaultValue: "Create Account" })}</UIText>
          <UIText style={[styles.welcomeSub, { color: c.inkSoft }]}>{t("auth.registerSubtitle", { defaultValue: "Join the premium pharmacy experience today." })}</UIText>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(100).springify()} style={[styles.formCard, { backgroundColor: c.surface }]}>
          
          {error ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: kit.color.dangerTint, borderColor: kit.color.danger }]}>
              <Ionicons name="alert-circle" size={20} color={kit.color.danger} />
              <UIText style={[styles.errorText, { color: kit.color.danger }]}>{error}</UIText>
            </Animated.View>
          ) : null}

          <FloatingInput 
            label={t("auth.nameLabel", { defaultValue: "Full Name" })}
            icon="person-outline"
            value={name}
            onChangeText={(t: string) => { setName(t); setError(""); }}
            autoCapitalize="words"
          />
          <View style={{ height: 16 }} />
          <FloatingInput 
            label={t("auth.emailLabel", { defaultValue: "Email or Phone" })}
            icon="mail-outline"
            value={email}
            onChangeText={(t: string) => { setEmail(t); setError(""); }}
            keyboardType="email-address"
          />
          <View style={{ height: 16 }} />
          <FloatingInput 
            label={t("auth.passwordLabel", { defaultValue: "Password" })}
            icon="lock-closed-outline"
            value={password}
            onChangeText={(t: string) => { setPassword(t); setError(""); }}
            secure
          />

          <Button 
            label={t("auth.registerBtn", { defaultValue: "Sign Up" })}
            onPress={handleRegister}
            loading={loading}
            style={styles.registerBtn}
          />
          
          <View style={styles.termsHint}>
             <UIText style={[styles.termsText, { color: c.inkSoft }]}>
                {t("auth.termsAgreement", { defaultValue: "By signing up, you agree to our Terms of Service and Privacy Policy." })}
             </UIText>
          </View>

        </Animated.View>

        <Animated.View entering={FadeIn.duration(800).delay(300)} style={styles.footerRow}>
          <UIText style={[styles.footerText, { color: c.inkSoft }]}>{t("auth.haveAccount", { defaultValue: "Already have an account?" })}</UIText>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 8, justifyContent: "space-between", alignItems: "center", zIndex: 10 },
  closeBtn: { padding: 8 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 60 },
  heroSection: { marginBottom: 32 },
  welcomeTitle: { fontFamily: theme.fonts.extrabold, fontSize: 32, marginBottom: 8, textAlign: "left" },
  welcomeSub: { fontFamily: theme.fonts.regular, fontSize: 16, textAlign: "left", lineHeight: 24 },
  formCard: { borderRadius: 24, padding: 24, marginBottom: 24, ...kit.shadow.raised },
  inputContainer: { height: 64, borderRadius: 16, borderWidth: 1, alignItems: "center", paddingHorizontal: 16 },
  inputWrapper: { flex: 1, height: "100%", justifyContent: "center", position: "relative" },
  floatingLabel: { position: "absolute", left: 0, fontFamily: theme.fonts.bold, fontSize: 15 },
  textInput: { fontFamily: theme.fonts.bold, fontSize: 16, height: "100%", width: "100%" },
  registerBtn: { height: 56, borderRadius: 16, marginTop: 32 },
  termsHint: { marginTop: 16, alignItems: "center" },
  termsText: { fontFamily: theme.fonts.medium, fontSize: 12, textAlign: "center", lineHeight: 18 },
  errorBox: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 16 },
  errorText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: 13 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, gap: 6 },
  footerText: { fontFamily: theme.fonts.medium, fontSize: 14 },
  footerLink: { fontFamily: theme.fonts.bold, fontSize: 14, color: kit.color.accentDeep },
});
