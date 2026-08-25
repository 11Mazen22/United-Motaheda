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
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { requestPasswordReset, getAuthError } from "@/features/auth";
import { Button, kit, Text as UIText, Input } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";

import { theme } from "@pharmacy/design-tokens";
import { isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

export default function ResetPasswordScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const IS_RTL = isRtl();
  const TEXT_START = textAlignStart(IS_RTL);

  const handleReset = async () => {
    if (!email.trim()) {
      setError(t("auth.errorEmptyFields", { defaultValue: "Please enter your email." }));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccess(true);
    } catch (err: unknown) {
      setError(getAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: theme.colors.canvas.background }} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View entering={FadeIn.duration(200)} style={[styles.header, { paddingTop: insets.top, backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name={BACK_CHEVRON} size={24} color={theme.colors.text.primary} />
        </Pressable>
        <UIText style={[styles.title, { color: theme.colors.text.primary }]}>{t("auth.resetTitle", { defaultValue: "Reset Password" })}</UIText>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.formContainer}>
          
          <View style={styles.iconContainer}>
            <View style={[styles.iconTile, { backgroundColor: theme.colors.brand.primaryLight, borderColor: `${theme.colors.brand.primary}28` }]}>
              <Ionicons name="key-outline" size={28} color={theme.colors.brand.primary} />
            </View>
            <UIText style={[styles.instruction, { color: theme.colors.text.secondary }]}>
              {t("auth.resetInstruction", { defaultValue: "Enter your registered email address to receive a password reset link." })}
            </UIText>
          </View>

          {error && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: `${theme.colors.status.error}1A`, borderColor: theme.colors.status.error }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.colors.status.error} />
              <UIText style={[styles.errorText, { color: theme.colors.status.error, textAlign: TEXT_START }]}>{error}</UIText>
            </Animated.View>
          )}

          {success && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: `${theme.colors.status.success}1A`, borderColor: theme.colors.status.success }]}>
              <Ionicons name="checkmark-circle-outline" size={20} color={kit.color.successDeep} />
              <UIText style={[styles.errorText, { color: kit.color.successDeep, textAlign: TEXT_START }]}>
                {t("auth.resetSuccess", { defaultValue: "Check your email for the reset link!" })}
              </UIText>
            </Animated.View>
          )}

          <View style={styles.inputGroup}>
            <UIText style={[styles.label, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>{t("auth.emailLabel")}</UIText>
            <Input
              value={email}
              onChangeText={(text) => { setEmail(text); setError(null); setSuccess(false); }}
              placeholder="example@mail.com"
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading && !success}
              autoComplete="email"
            />
          </View>

          <Button
            label={t("auth.resetAction", { defaultValue: "Send Reset Link" })}
            onPress={handleReset}
            loading={loading}
            disabled={success}
            style={styles.saveBtn}
          />
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  formContainer: {
    gap: 24,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 8,
    gap: 16,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  instruction: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
  },
});
