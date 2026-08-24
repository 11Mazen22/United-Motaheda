/**

 * Forgot Password — Phase 2 VIP upgrade.

 *

 * Builds on kit V2 base: adds entrance choreography, layered ring icon,

 * animated success state. Logic: unchanged.

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

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { requestPasswordReset, getAuthError } from "@/features/auth";

import { track } from "@/lib/analytics";

import { captureError } from "@/lib/crashReporter";

import { Input } from "@/components/ui/Input";

import { Button } from "@pharmacy/ui-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { kit } from "@pharmacy/ui-native";



import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



export default function ForgotPasswordScreen() {

  const { t, i18n } = useTranslation();

  const router = useRouter();

  const insets = useSafeAreaInsets();



  const [email,   setEmail]   = useState("");

  const [loading, setLoading] = useState(false);

  const [error,   setError]   = useState<string | null>(null);

  const [sent,    setSent]    = useState(false);



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

      setSent(true);

    } catch (e) {

      captureError(e, { surface: "forgot-password" });

      setError(getAuthError(e, i18n.language));

    } finally {

      setLoading(false);

    }

  };



  return (

    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>

      <ScrollView

        style={s.root}

        contentContainerStyle={[s.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}

        keyboardShouldPersistTaps="handled"

        showsVerticalScrollIndicator={false}>



        <Animated.View entering={FadeIn.duration(220)} style={[s.topBar, { flexDirection: flexRow(IS_RTL) }]}>

          <Pressable

            onPress={() => router.back()}

            hitSlop={10}

            style={s.closeBtn}

            accessibilityRole="button"

            accessibilityLabel={t("forgotPassword.backLabel")}>

            <Ionicons name={BACK_CHEVRON} size={20} color={theme.colors.text.secondary} />

          </Pressable>

        </Animated.View>



        {/* Brand ring — animates on mount and on sent state change */}

        <Animated.View

          key={`brand-${sent}`}

          entering={FadeIn.delay(60).duration(360)}

          style={s.brandWrap}>

          <View style={[s.ringOuter, sent && { backgroundColor: `${theme.colors.status.success}1A` }]}>

            <View style={[s.ringInner, sent && { borderColor: `${theme.colors.status.success}30` }]}>

              <Ionicons

                name={sent ? "mail-open-outline" : "key-outline"}

                size={30}

                color={sent ? theme.colors.status.success : theme.colors.brand.primary}

              />

            </View>

          </View>

          <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ alignItems: "center", gap: 8 }}>

            <UIText style={s.title}>{sent ? t("forgotPassword.titleSent") : t("forgotPassword.title")}</UIText>

            <UIText style={s.subtitle}>{sent ? t("forgotPassword.subtitleSent") : t("forgotPassword.subtitle")}</UIText>

          </Animated.View>

        </Animated.View>



        <Animated.View

          key={`form-${sent}`}

          entering={FadeInUp.delay(180).duration(360).springify().damping(20)}

          style={s.form}>

          {!sent ? (

            <>

              {error && (

                <Animated.View entering={FadeInDown.duration(200)} style={[s.errorBox, { flexDirection: flexRow(IS_RTL) }]}>

                  <View style={s.errorIcon}>

                    <Ionicons name="alert-circle" size={15} color={theme.colors.status.error} />

                  </View>

                  <UIText style={[s.errorText, { textAlign: TEXT_START }]}>{error}</UIText>

                </Animated.View>

              )}



              <UIText style={[s.hint, { textAlign: TEXT_START }]}>{t("forgotPassword.hint")}</UIText>



              <Input

                label={t("forgotPassword.emailLabel")}

                placeholder="example@email.com"

                value={email}

                onChangeText={setEmail}

                keyboardType="email-address"

                autoCapitalize="none"

                autoComplete="email"

                leftIcon={<Ionicons name="mail-outline" size={18} color={theme.colors.text.muted} />}

              />



              <Button

                label={t("forgotPassword.sendBtn")}

                variant="primary"

                size="lg"

                full

                loading={loading}

                onPress={handleSubmit}

                style={{ marginTop: 4 }}

              />

            </>

          ) : (

            <Animated.View entering={FadeInUp.duration(320)} style={s.successContent}>

              <UIText style={[s.successBody, { textAlign: "center" }]}>

                {t("forgotPassword.successBodyPre")}{"\n"}

                <UIText style={s.successEmail}>{email}</UIText>

                {"\n"}{t("forgotPassword.successBodyPost")}

              </UIText>



              <View style={[s.tipBox, { flexDirection: flexRow(IS_RTL) }]}>

                <Ionicons name="information-circle-outline" size={16} color={theme.colors.brand.primary} />

                <UIText style={[s.tipText, { textAlign: TEXT_START }]}>{t("forgotPassword.spamTip")}</UIText>

              </View>



              <Button

                label={t("forgotPassword.resend")}

                variant="secondary"

                size="md"

                full

                onPress={() => { setSent(false); setEmail(""); }}

                style={{ marginTop: 4 }}

              />

            </Animated.View>

          )}



          <View style={[s.footer, { flexDirection: flexRow(IS_RTL) }]}>

            <UIText style={s.footerText}>{t("forgotPassword.rememberPassword")}</UIText>

            <Pressable hitSlop={6} onPress={() => router.replace("/(auth)/login")}>

              <UIText style={s.footerLink}>{t("forgotPassword.signIn")}</UIText>

            </Pressable>

          </View>

        </Animated.View>

      </ScrollView>

    </KeyboardAvoidingView>

  );

}



const s = StyleSheet.create({

  root:    { flex: 1, backgroundColor: theme.colors.canvas.background },

  content: { flexGrow: 1, paddingHorizontal: 20 },



  topBar: { justifyContent: "flex-start" },

  closeBtn: {

    width:           40,

    height:          40,

    borderRadius:    20,

    alignItems:      "center",

    justifyContent:  "center",

    backgroundColor: theme.colors.canvas.surface,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    ...theme.shadows[1],

  },



  brandWrap: { alignItems: "center", gap: 16, marginTop: 16, marginBottom: 24 },

  ringOuter: {

    width:           100,

    height:          100,

    borderRadius:    50,

    backgroundColor: theme.colors.brand.primaryLight,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

  },

  ringInner: {

    width:           68,

    height:          68,

    borderRadius:    22,

    backgroundColor: theme.colors.canvas.surface,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

    ...theme.shadows[2],

  },

  title: {

    fontFamily:         legacyTheme.fonts.black,

    fontSize:           kit.type.title.fontSize,

    lineHeight:         kit.type.title.lineHeight,

    color:              theme.colors.text.primary,

    textAlign:          "center",

    includeFontPadding: false,

  },

  subtitle: {

    fontFamily:         legacyTheme.fonts.regular,

    fontSize:           kit.type.body.fontSize,

    lineHeight:         kit.type.body.lineHeight,

    color:              theme.colors.text.secondary,

    textAlign:          "center",

    includeFontPadding: false,

    maxWidth:           320,

  },



  form: { gap: 12 },

  errorBox: {

    alignItems:      "center",

    gap:             8,

    padding:         12,

    backgroundColor: `${theme.colors.status.error}1A`,

    borderRadius:    10,

    borderWidth:     1,

    borderColor:     `${theme.colors.status.error}25`,

  },

  errorIcon: {

    width:           28,

    height:          28,

    borderRadius:    9,

    backgroundColor: `${theme.colors.status.error}10`,

    alignItems:      "center",

    justifyContent:  "center",

    flexShrink:      0,

  },

  errorText: {

    flex:               1,

    fontFamily:         legacyTheme.fonts.bold,

    fontSize:           12,

    lineHeight:         17,

    color:              theme.colors.status.error,

    includeFontPadding: false,

  },

  hint: {

    fontFamily:         legacyTheme.fonts.regular,

    fontSize:           13,

    lineHeight:         21,

    color:              theme.colors.text.secondary,

    includeFontPadding: false,

  },



  successContent: { alignItems: "center", gap: 12, paddingTop: 4 },

  successBody: {

    fontFamily:         legacyTheme.fonts.regular,

    fontSize:           14,

    lineHeight:         24,

    color:              theme.colors.text.secondary,

    maxWidth:           300,

    includeFontPadding: false,

  },

  successEmail: { fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.primary },

  tipBox: {

    alignItems:      "flex-start",

    gap:             8,

    backgroundColor: theme.colors.brand.primaryLight,

    borderRadius:    10,

    padding:         12,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

  },

  tipText: {

    flex:               1,

    fontFamily:         legacyTheme.fonts.regular,

    fontSize:           12,

    lineHeight:         17,

    color:              theme.colors.brand.primary,

    includeFontPadding: false,

  },



  footer: { alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 },

  footerText: {

    fontFamily:         legacyTheme.fonts.regular,

    fontSize:           13,

    color:              theme.colors.text.secondary,

    includeFontPadding: false,

  },

  footerLink: {

    fontFamily:         legacyTheme.fonts.black,

    fontSize:           13,

    color:              theme.colors.brand.primary,

    includeFontPadding: false,

  },

});

