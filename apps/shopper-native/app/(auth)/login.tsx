/**
 * Login — VIP welcome experience (Phase 2 reinvention).
 *
 * Visual: layered brand ring → trust chips → elevated form card → CTA.
 * Logic: unchanged (functional parity with previous V2 build).
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
import { signIn, getAuthError } from "@/features/auth";
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

const TRUST_ITEMS: { icon: IoniconsName; labelKey: string }[] = [
  { icon: "shield-checkmark-outline", labelKey: "auth.trustSecure"  },
  { icon: "lock-closed-outline",      labelKey: "auth.trustPrivate" },
  { icon: "heart-outline",            labelKey: "auth.trustCare"    },
];

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

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
      if (__DEV__) console.warn("[login] signIn failed:", e);
      captureError(e, { surface: "login" });
      track("login_failed", { reason: e instanceof Error ? e.message.slice(0, 80) : "unknown" });
      setError(getAuthError(e, i18n.language));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={s.root}
        contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Close */}
        <View style={[s.topBar, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={s.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}>
            <Ionicons name="close" size={20} color={kit.color.inkSoft} />
          </Pressable>
        </View>

        {/* Brand ring — layered icon treatment */}
        <Animated.View entering={FadeIn.duration(400)} style={s.brandBlock}>
          <View style={s.logoOuter}>
            <View style={s.logoInner}>
              <AppLogo size="lg" />
            </View>
          </View>
          <Animated.View entering={FadeInDown.delay(120).duration(320)} style={s.headlineWrap}>
            <UIText style={s.headline}>{t("auth.loginWelcome")}</UIText>
            <UIText style={s.subhead}>{t("auth.loginSubtitle")}</UIText>
          </Animated.View>
        </Animated.View>

        {/* Trust chips */}
        <Animated.View entering={FadeInUp.delay(200).duration(320)} style={[s.trustRow, { flexDirection: flexRow(IS_RTL) }]}>
          {TRUST_ITEMS.map((item) => (
            <View key={item.icon} style={[s.trustChip, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name={item.icon} size={11} color={kit.color.accentDeep} />
              <UIText style={s.trustText}>{t(item.labelKey)}</UIText>
            </View>
          ))}
        </Animated.View>

        {/* Form card */}
        <Animated.View entering={FadeInUp.delay(280).duration(380)} style={s.formCard}>
          {error && (
            <Animated.View entering={FadeInDown.duration(200)} style={[s.errorBox, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={s.errorIcon}>
                <Ionicons name="alert-circle" size={15} color={kit.color.danger} />
              </View>
              <UIText style={[s.errorText, { textAlign: TEXT_START }]}>{error}</UIText>
            </Animated.View>
          )}

          <Input
            label={t("auth.email")}
            placeholder="example@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            leftIcon={<Ionicons name="mail-outline" size={18} color={kit.color.inkFaint} />}
          />

          <Input
            label={t("auth.password")}
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
            leftIcon={<Ionicons name="lock-closed-outline" size={18} color={kit.color.inkFaint} />}
            rightIcon={
              <Pressable onPress={() => setShowPass(!showPass)} hitSlop={8}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={kit.color.inkFaint} />
              </Pressable>
            }
          />

          <View style={[s.forgotRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable hitSlop={8} onPress={() => router.push("/(auth)/forgot-password")}>
              <UIText style={s.forgotLink}>{t("auth.forgotPassword")}</UIText>
            </Pressable>
          </View>
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(360).duration(360)}>
          <Button
            label={t("auth.login")}
            variant="primary"
            size="lg"
            full
            loading={loading}
            onPress={handleLogin}
            style={{ marginTop: 16 }}
          />
        </Animated.View>

        {/* Divider + footer */}
        <Animated.View entering={FadeIn.delay(460).duration(300)} style={s.footerSection}>
          <View style={[s.dividerRow, { flexDirection: flexRow(IS_RTL) }]}>
            <View style={s.divider} />
            <UIText style={s.orText}>{t("auth.or")}</UIText>
            <View style={s.divider} />
          </View>

          <View style={[s.footer, { flexDirection: flexRow(IS_RTL) }]}>
            <UIText style={s.footerText}>{t("auth.noAccount")}</UIText>
            <Link href="/(auth)/register" asChild>
              <Pressable hitSlop={6}>
                <UIText style={s.footerLink}>{t("auth.createAccount")}</UIText>
              </Pressable>
            </Link>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: kit.color.canvas },
  content: { flexGrow: 1, paddingHorizontal: 22 },

  topBar:   { justifyContent: "flex-end", marginBottom: 4 },
  closeBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    alignSelf:       "flex-end",
  },

  // Brand block — layered rings
  brandBlock: { alignItems: "center", gap: 20, marginTop: 8, marginBottom: 24 },
  logoOuter: {
    width:           112,
    height:          112,
    borderRadius:    56,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  logoInner: {
    width:           76,
    height:          76,
    borderRadius:    22,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.brandGlow,
  },
  headlineWrap: { alignItems: "center", gap: 8 },
  headline: {
    fontFamily:         theme.fonts.black,
    fontSize:           26,
    lineHeight:         34,
    letterSpacing:      -0.6,
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

  // Trust chips
  trustRow: {
    justifyContent: "center",
    gap:            8,
    marginBottom:   24,
    flexWrap:       "wrap",
  },
  trustChip: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      999,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  trustText: {
    fontSize:           9.5,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.accentDeep,
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
  forgotRow: { justifyContent: "flex-start" },
  forgotLink: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // Footer
  footerSection: { marginTop: 20, gap: 16 },
  dividerRow:    { alignItems: "center", gap: 10 },
  divider:       { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: kit.color.line },
  orText: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  footer: { alignItems: "center", justifyContent: "center", gap: 6 },
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
