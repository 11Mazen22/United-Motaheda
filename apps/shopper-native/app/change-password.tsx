import React, { useState, useMemo } from "react";
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
import Animated, { FadeInDown, FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { updatePassword, getAuthError } from "@/features/auth";
import { Button, kit, Text as UIText } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { theme } from "@pharmacy/design-tokens";
import { isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { TextInput } from "react-native-gesture-handler";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface PasswordRowProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  isLast?: boolean;
}

function PasswordRow({ label, value, onChangeText, placeholder, isLast = false }: PasswordRowProps) {
  const { c } = useDarkColors();
  return (
    <View style={[styles.row, { borderBottomColor: isLast ? "transparent" : c.line }]}>
      <UIText style={[styles.rowLabel, { color: c.inkSoft, textAlign: TEXT_START, marginBottom: 8 }]}>{label}</UIText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.inkFaint}
        secureTextEntry
        autoComplete="new-password"
        style={[styles.rowInput, { color: c.ink, textAlign: IS_RTL ? "right" : "left" }]}
      />
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { c } = useDarkColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = password.length > 0 || confirm.length > 0;

  // Password Strength Logic
  const strength = useMemo(() => {
    let score = 0;
    if (password.length > 5) score += 1;
    if (password.length > 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score; // 0 to 5
  }, [password]);

  const strengthColor = useMemo(() => {
    if (strength <= 1) return kit.color.danger;
    if (strength <= 3) return kit.color.warn;
    return kit.color.success;
  }, [strength]);

  const strengthLabel = useMemo(() => {
    if (password.length === 0) return "";
    if (strength <= 1) return t("auth.strengthWeak", { defaultValue: "Weak" });
    if (strength <= 3) return t("auth.strengthMedium", { defaultValue: "Fair" });
    return t("auth.strengthStrong", { defaultValue: "Strong" });
  }, [strength, password, t]);

  const handleSave = async () => {
    if (!password || !confirm) {
      setError(t("auth.errorEmptyFields", { defaultValue: "Please fill in all fields." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password !== confirm) {
      setError(t("auth.errorPasswordMismatch", { defaultValue: "Passwords do not match." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (password.length < 6) {
      setError(t("auth.errorPasswordTooShort", { defaultValue: "Password must be at least 6 characters." }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: unknown) {
      setError(getAuthError(err));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: c.canvas }} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View entering={FadeIn.duration(200)} style={[styles.header, { paddingTop: insets.top, backgroundColor: c.surface, borderBottomColor: c.line }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
        >
          <Ionicons name={BACK_CHEVRON} size={24} color={c.ink} />
        </Pressable>
        <UIText style={[styles.title, { color: c.ink }]}>{t("profile.menuSecurity", { defaultValue: "Security" })}</UIText>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400).delay(50)}>
          
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[kit.color.accentTint, c.canvas]}
              style={styles.heroRing}
            >
               <Ionicons name="shield-checkmark" size={48} color={kit.color.accentDeep} />
            </LinearGradient>
            <UIText style={[styles.heroInstruction, { color: c.inkSoft }]}>
              {t("profile.changePasswordInstruction", { defaultValue: "Create a new strong password for your account to maintain security." })}
            </UIText>
          </View>

          {error && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: kit.color.dangerTint, borderColor: kit.color.danger }]}>
              <Ionicons name="alert-circle-outline" size={20} color={kit.color.danger} />
              <UIText style={[styles.errorText, { color: kit.color.danger, textAlign: TEXT_START }]}>{error}</UIText>
            </Animated.View>
          )}

          <View style={styles.sectionHeader}>
            <UIText style={[styles.sectionTitle, { color: c.inkSoft, textAlign: TEXT_START }]}>{t("auth.passwordRules", { defaultValue: "NEW CREDENTIALS" })}</UIText>
          </View>

          <View style={[styles.cardGroup, { backgroundColor: c.surface, borderColor: c.line }]}>
            <PasswordRow 
              label={t("auth.newPasswordLabel", { defaultValue: "New Password" })}
              value={password}
              onChangeText={(t: string) => { setPassword(t); setError(null); }}
              placeholder="••••••••"
            />
            
            {/* Strength Meter Inside Card */}
            {password.length > 0 && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.strengthContainer}>
                <View style={[styles.strengthTrack, { backgroundColor: c.line }]}>
                  <Animated.View 
                    style={[styles.strengthFill, { width: `${(strength / 5) * 100}%`, backgroundColor: strengthColor }]} 
                  />
                </View>
                <UIText style={[styles.strengthText, { color: strengthColor, textAlign: TEXT_START }]}>{strengthLabel}</UIText>
              </Animated.View>
            )}

            <PasswordRow 
              label={t("auth.confirmPasswordLabel", { defaultValue: "Confirm Password" })}
              value={confirm}
              onChangeText={(t: string) => { setConfirm(t); setError(null); }}
              placeholder="••••••••"
              isLast={true}
            />
          </View>

          <View style={styles.rulesContainer}>
            <UIText style={[styles.ruleText, { color: password.length >= 6 ? kit.color.success : c.inkFaint, textAlign: TEXT_START }]}>
               <Ionicons name={password.length >= 6 ? "checkmark-circle" : "ellipse-outline"} size={14} /> {t("auth.ruleLength", { defaultValue: "At least 6 characters" })}
            </UIText>
            <UIText style={[styles.ruleText, { color: /[0-9]/.test(password) ? kit.color.success : c.inkFaint, textAlign: TEXT_START }]}>
               <Ionicons name={/[0-9]/.test(password) ? "checkmark-circle" : "ellipse-outline"} size={14} /> {t("auth.ruleNumber", { defaultValue: "Contains a number" })}
            </UIText>
          </View>

        </Animated.View>
      </ScrollView>

      {/* Sticky Save Button */}
      {isDirty && (
        <Animated.View 
          entering={SlideInDown.duration(300)} 
          exiting={SlideOutDown.duration(200)}
          style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: c.surface, borderTopColor: c.line }]}
        >
          <Button
            label={t("common.update", { defaultValue: "Update Password" })}
            onPress={handleSave}
            loading={loading}
          />
        </Animated.View>
      )}
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
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  heroSection: {
    alignItems: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  heroRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroInstruction: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
  },
  rowInput: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
    paddingVertical: 4,
    letterSpacing: 3,
  },
  strengthContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.lineStrong,
  },
  strengthTrack: {
    height: 4,
    borderRadius: 2,
    width: "100%",
    overflow: "hidden",
    marginBottom: 6,
  },
  strengthFill: {
    height: "100%",
    borderRadius: 2,
  },
  strengthText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
  },
  rulesContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    gap: 8,
  },
  ruleText: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...kit.shadow.raised,
  },
});
