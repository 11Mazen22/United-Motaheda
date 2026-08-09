/**
 * EditProfileScreen — lets an authenticated user update their display name
 * and phone number.
 *
 * Architecture:
 *   - Loads current values from supabase.auth.getUser() (user_metadata)
 *   - On save: calls updateProfile() which writes to both auth.users.user_metadata
 *     AND public.profiles (full_name / phone).
 *   - The auth context listens to onAuthStateChange(USER_UPDATED) and refreshes
 *     the displayed name in the profile hero automatically — no manual reload needed.
 *   - Email is shown read-only with a hint explaining it cannot be changed here.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { updateProfile, getAuthError, useAuth } from "@/features/auth";
import { captureError } from "@/lib/crashReporter";
import { Input } from "@/components/ui/Input";
import { Button } from "@pharmacy/ui-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type Phase = "loading" | "form" | "success";

export default function EditProfileScreen() {
  const { t, i18n } = useTranslation();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { }    = useAuth();

  const [phase,   setPhase]   = useState<Phase>("loading");
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [email,   setEmail]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Load current user values from auth metadata once on mount.
  // Intentionally empty deps — we only want to read the initial values.
  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user: u } }) => {
        if (!mountedRef.current) return;
        setName(u?.user_metadata?.name  ?? "");
        setPhone(u?.user_metadata?.phone ?? "");
        setEmail(u?.email ?? "");
        setPhase("form");
      })
      .catch((e) => {
        // Without this catch, a rejected getUser() (network drop, expired
        // session) would leave `phase` stuck at "loading" forever — an
        // infinite spinner with no way out. Fall through to the form so the
        // existing error banner can surface the problem and the user can retry.
        if (!mountedRef.current) return;
        if (__DEV__) console.warn("[edit-profile] getUser failed:", e);
        captureError(e, { surface: "edit-profile-load" });
        setError(getAuthError(e, i18n.language));
        setPhase("form");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("editProfile.errorRequired"));
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ name: trimmedName, phone: phone.trim() });
      if (mountedRef.current) setPhase("success");
    } catch (e) {
      if (__DEV__) console.warn("[edit-profile] updateProfile failed:", e);
      captureError(e, { surface: "edit-profile" });
      if (mountedRef.current) setError(getAuthError(e, i18n.language));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [name, phone, t, i18n.language]);

  // Auto-dismiss success state after 1.5 s
  useEffect(() => {
    if (phase !== "success") return;
    const id = setTimeout(() => { if (mountedRef.current) router.back(); }, 1500);
    return () => clearTimeout(id);
  }, [phase, router]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.screen, { paddingTop: insets.top }]}>

        {/* ── VIP Header ── */}
        <Animated.View entering={FadeIn.duration(240)} style={s.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            android_ripple={{ color: kit.color.well, borderless: true }}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={({ pressed }) => [
              s.backBtn,
              pressed && { opacity: 0.86, transform: [{ scale: 0.96 }] },
            ]}>
            <Ionicons name={BACK_CHEVRON} size={18} color={kit.color.inkSoft} />
          </Pressable>
          <View style={s.iconTile}>
            <Ionicons name="person-circle-outline" size={22} color={kit.color.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <UIText style={s.headerTitle}>{t("editProfile.title")}</UIText>
            <UIText style={s.headerSubtitle}>{t("editProfile.subtitle")}</UIText>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── Loading ── */}
          {phase === "loading" && (
            <View style={s.centered}>
              <ActivityIndicator size="large" color={kit.color.accent} />
            </View>
          )}

          {/* ── Success ── */}
          {phase === "success" && (
            <Animated.View entering={FadeIn.duration(260)} style={s.successWrap}>
              <View style={s.successOuter}>
                <View style={s.successInner}>
                  <Ionicons name="checkmark" size={32} color={kit.color.success} />
                </View>
              </View>
              <UIText style={[s.successTitle, { textAlign: TEXT_START }]}>{t("editProfile.saved")}</UIText>
            </Animated.View>
          )}

          {/* ── Form ── */}
          {phase === "form" && (
            <Animated.View entering={FadeInUp.duration(300)} style={s.form}>

              {/* Avatar layered ring */}
              <Animated.View entering={FadeInDown.duration(320).delay(40)} style={s.avatarWrap}>
                <View style={s.avatarOuter}>
                  <View style={s.avatarInner}>
                    <Ionicons name="person" size={36} color={kit.color.accentDeep} />
                  </View>
                </View>
              </Animated.View>

              {/* Error banner */}
              {error && (
                <Animated.View entering={FadeInDown.duration(200)} style={[s.errorBox, { flexDirection: flexRow(IS_RTL) }]}>
                  <View style={s.errorIcon}>
                    <Ionicons name="alert-circle" size={16} color={kit.color.danger} />
                  </View>
                  <UIText style={[s.errorText, { textAlign: TEXT_START }]}>{error}</UIText>
                </Animated.View>
              )}

              {/* Name */}
              <Input
                label={t("editProfile.nameLabel")}
                placeholder={t("editProfile.namePlaceholder")}
                value={name}
                onChangeText={(v) => { setName(v); setError(null); }}
                leftIcon={<Ionicons name="person-outline" size={18} color={kit.color.inkFaint} />}
                autoCapitalize="words"
                returnKeyType="next"
              />

              {/* Phone */}
              <Input
                label={t("editProfile.phoneLabel")}
                placeholder={t("editProfile.phonePlaceholder")}
                value={phone}
                onChangeText={(v) => setPhone(v)}
                leftIcon={<Ionicons name="call-outline" size={18} color={kit.color.inkFaint} />}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />

              {/* Email — read-only */}
              <View style={s.emailBlock}>
                <UIText style={[s.fieldLabel, { textAlign: TEXT_START }]}>{t("editProfile.emailLabel")}</UIText>
                <View style={[s.emailRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <Ionicons name="mail-outline" size={16} color={kit.color.inkFaint} />
                  <UIText style={[s.emailValue, { textAlign: TEXT_START }]} numberOfLines={1}>{email}</UIText>
                  <View style={s.lockBadge}>
                    <Ionicons name="lock-closed-outline" size={11} color={kit.color.inkFaint} />
                  </View>
                </View>
                <View style={[s.emailHintRow, { flexDirection: flexRow(IS_RTL) }]}>
                  <UIText style={[s.emailHint, { textAlign: TEXT_START }]}>{t("editProfile.emailHint")}</UIText>
                </View>
              </View>

              {/* Save */}
              <Button
                variant="primary"
                size="lg"
                full
                loading={saving}
                onPress={handleSave}
                style={{ marginTop: 8 }}
                label={saving ? t("editProfile.saving") : t("editProfile.saveBtn")}
              />
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // Header
  header: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
    flexShrink:      0,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  headerTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           18,
    letterSpacing:      -0.4,
    color:              kit.color.ink,
    includeFontPadding: false,
    textAlign:          TEXT_START,
  },
  headerSubtitle: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
    textAlign:          TEXT_START,
    marginTop:          1,
  },

  // Content
  content: { padding: 20, gap: 0 },

  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 80 },

  // Success state — layered rings
  successWrap: {
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: 80,
    gap:             18,
  },
  successOuter: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: kit.color.successTint,
    borderWidth:     1,
    borderColor:     kit.color.success + "30",
    alignItems:      "center",
    justifyContent:  "center",
  },
  successInner: {
    width:           68,
    height:          68,
    borderRadius:    22,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },
  successTitle: {
    fontSize:           22,
    fontFamily:         theme.fonts.black,
    color:              kit.color.success,
    includeFontPadding: false,
  },

  // Form
  form: { gap: 16, marginTop: 8 },

  // Avatar
  avatarWrap: { alignItems: "center", marginBottom: 8 },
  avatarOuter: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  avatarInner: {
    width:           68,
    height:          68,
    borderRadius:    22,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },

  // Error box
  errorBox: {
    alignItems:      "center",
    gap:             10,
    backgroundColor: kit.color.dangerTint,
    borderRadius:    14,
    padding:         12,
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
    color:              kit.color.danger,
    fontFamily:         theme.fonts.semibold,
    fontSize:           12,
    includeFontPadding: false,
  },

  // Email read-only block
  emailBlock: { gap: 6 },
  fieldLabel: {
    fontSize:           12,
    fontFamily:         theme.fonts.semibold,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
    marginBottom:       2,
  },
  emailRow: {
    alignItems:        "center",
    gap:               10,
    backgroundColor:   kit.color.well,
    borderRadius:      14,
    paddingVertical:   13,
    paddingHorizontal: 14,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  emailValue: {
    flex:               1,
    fontSize:           13,
    fontFamily:         theme.fonts.semibold,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  lockBadge: {
    width:           24,
    height:          24,
    borderRadius:    8,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  emailHintRow: {
    alignItems: "center",
    gap:        5,
    marginTop:  2,
  },
  emailHint: {
    fontSize:           11,
    fontFamily:         theme.fonts.regular,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
});
