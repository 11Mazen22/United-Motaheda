/**
 * /complete-profile — one-time gate shown right after a FIRST-TIME OAuth
 * (Google) sign-in. Google never hands us a phone number, and the app's
 * checkout/delivery flow requires one — so a brand-new Google user lands
 * here instead of straight into the app. Detection lives in
 * auth-callback.tsx (OAuth session + no user_metadata.phone yet); this
 * screen just collects name (pre-filled from the Google profile) + phone
 * and writes them via the same updateProfile() every other profile edit
 * uses, so there's no separate backend path to keep in sync.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  useReducedMotion,
} from "react-native-reanimated";

import { useAuth, updateProfile, getAuthError, normalizeEgyptianPhone } from "@/features/auth";
import { LangSwitcher } from "@/features/auth/components/LangSwitcher";
import { AuthField } from "@/features/auth/components/AuthField";
import { Button, Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export default function CompleteProfileScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const destination = redirect ? decodeURIComponent(redirect) : "/(customer)/(tabs)";

  const firstName = user?.name?.split(" ")?.[0];

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reducedMotion = useReducedMotion();
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

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || !phone) {
      setError(t("auth.completeProfile.errorEmptyFields"));
      return;
    }
    const normalizedPhone = normalizeEgyptianPhone(phone);
    if (!normalizedPhone) {
      setError(t("auth.completeProfile.errorInvalidPhone"));
      return;
    }
    setError("");
    setLoading(true);
    try {
      await updateProfile({ name: trimmedName, phone: normalizedPhone });
      router.replace(destination as never);
    } catch (err: unknown) {
      setError(getAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: theme.colors.canvas.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top, flexDirection: flexRow(IS_RTL) }]}>
        <View style={{ width: 38 }} />
        <LangSwitcher />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Animated.View entering={FadeInDown.duration(600).springify()} style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            <Animated.View style={[styles.halo, { backgroundColor: theme.colors.brand.primaryLight }, animatedHalo]} />
            {user?.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.colors.brand.primaryLight }]}>
                <Ionicons name="person" size={36} color={theme.colors.brand.primary} />
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: theme.colors.brand.primary, borderColor: theme.colors.canvas.background }]}>
              <Ionicons name="checkmark" size={13} color={theme.colors.text.inverse} />
            </View>
          </View>

          <UIText weight="bold" style={[styles.eyebrow, { color: theme.colors.brand.primary }]}>
            {t("auth.completeProfile.eyebrow")}
          </UIText>
          <UIText style={[styles.welcomeTitle, { color: theme.colors.text.primary }]}>
            {firstName ? t("auth.completeProfile.titleNamed", { name: firstName }) : t("auth.completeProfile.titleGeneric")}
          </UIText>
          <UIText style={[styles.welcomeSub, { color: theme.colors.text.secondary }]}>
            {t("auth.completeProfile.subtitle")}
          </UIText>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(600).delay(100).springify()} style={[styles.formCard, { backgroundColor: theme.colors.canvas.surface }]}>

          {error ? (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: `${theme.colors.status.error}1A`, borderColor: theme.colors.status.error }]}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.status.error} />
              <UIText style={[styles.errorText, { color: theme.colors.status.error }]}>{error}</UIText>
            </Animated.View>
          ) : null}

          <AuthField
            label={t("auth.completeProfile.nameLabel")}
            icon="person-outline"
            value={name}
            onChangeText={(v: string) => { setName(v); setError(""); }}
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
          />
          <View style={{ height: 16 }} />
          <AuthField
            label={t("auth.completeProfile.phoneLabel")}
            icon="call-outline"
            value={phone}
            onChangeText={(v: string) => { setPhone(v); setError(""); }}
            keyboardType="phone-pad"
            autoComplete="tel"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <Button
            label={t("auth.completeProfile.submitBtn")}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(250)} style={[styles.trustFootnote, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="lock-closed-outline" size={12} color={theme.colors.text.muted} />
          <UIText variant="eyebrow" color="tertiary">{t("auth.completeProfile.trustNote")}</UIText>
        </Animated.View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    root: { flex: 1 },
    topBar: { paddingHorizontal: 16, paddingBottom: 8, justifyContent: "space-between", alignItems: "center", zIndex: 10 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 },
    heroSection: { alignItems: "center", marginBottom: 28 },
    avatarWrapper: { width: 112, height: 112, alignItems: "center", justifyContent: "center", marginBottom: 20 },
    halo: { position: "absolute", width: 132, height: 132, borderRadius: 66 },
    avatarImage: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
    avatarBadge: {
      position: "absolute", bottom: 2, end: 2,
      width: 26, height: 26, borderRadius: 13,
      alignItems: "center", justifyContent: "center",
      borderWidth: 2,
    },
    eyebrow: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
    welcomeTitle: { fontFamily: legacyTheme.fonts.extrabold, fontSize: 26, lineHeight: 33, marginBottom: 8, textAlign: "center" },
    welcomeSub: { fontFamily: legacyTheme.fonts.regular, fontSize: 15, textAlign: "center", lineHeight: 22, paddingHorizontal: 12 },
    formCard: { borderRadius: 24, padding: 24, marginBottom: 24, ...theme.shadows[1] },
    submitBtn: { height: 56, borderRadius: 16, marginTop: 24 },
    errorBox: { flexDirection: flexRow(IS_RTL), alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, gap: 8, marginBottom: 16 },
    errorText: { flex: 1, fontFamily: legacyTheme.fonts.bold, fontSize: 13 },
    trustFootnote: { alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  });
}
