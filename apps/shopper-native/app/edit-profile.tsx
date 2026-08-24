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
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

import { useAuth, updateProfile } from "@/features/auth";
import { Button, Text as UIText } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { TextInput } from "react-native-gesture-handler";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface FormRowProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "ascii-capable" | "numbers-and-punctuation" | "url" | "web-search" | "decimal-pad";
  isLast?: boolean;
}

function FormRow({ label, value, onChangeText, placeholder, editable = true, autoCapitalize = "none", keyboardType = "default", isLast = false }: FormRowProps) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: isLast ? "transparent" : theme.colors.border.default, flexDirection: flexRow(IS_RTL) }]}>
      <UIText style={[styles.rowLabel, { color: theme.colors.text.secondary, textAlign: TEXT_START }]}>{label}</UIText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.muted}
        editable={editable}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        style={[styles.rowInput, { color: editable ? theme.colors.text.primary : theme.colors.text.muted, textAlign: IS_RTL ? "left" : "right" }]}
      />
    </View>
  );
}

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || "");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = useMemo(() => {
    return name !== (user?.name || "");
  }, [name, user]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t("common.requiredField", { field: t("profile.name") }));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updateProfile({ name });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.unknown"));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
        <UIText style={[styles.title, { color: theme.colors.text.primary }]}>{t("profile.menuEditProfile")}</UIText>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(400).delay(50)}>
          
          {/* Avatar Hero */}
          <View style={styles.avatarSection}>
            <LinearGradient
              colors={["#0A5F58", "#12A898"]}
              style={styles.avatarRing}
            >
              <View style={[styles.avatarInner, { backgroundColor: theme.colors.canvas.surface }]}>
                <UIText style={[styles.avatarInitials, { color: theme.colors.text.primary }]}>
                  {name ? name.substring(0, 2).toUpperCase() : (user?.email ? user.email.substring(0, 2).toUpperCase() : "US")}
                </UIText>
              </View>
            </LinearGradient>
            <Pressable style={styles.editAvatarBtn}>
              <UIText style={styles.editAvatarText}>{t("profile.editPhoto", { defaultValue: "Edit Photo" })}</UIText>
            </Pressable>
          </View>

          {error && (
            <Animated.View entering={FadeIn.duration(200)} style={[styles.errorBox, { backgroundColor: `${theme.colors.status.error}1A`, borderColor: theme.colors.status.error }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.colors.status.error} />
              <UIText style={[styles.errorText, { color: theme.colors.status.error, textAlign: TEXT_START }]}>{error}</UIText>
            </Animated.View>
          )}

          {/* iOS Style Card Group */}
          <View style={styles.sectionHeader}>
            <UIText style={[styles.sectionTitle, { color: theme.colors.text.secondary, textAlign: TEXT_START }]}>{t("profile.personalInfo", { defaultValue: "PERSONAL INFORMATION" })}</UIText>
          </View>
          
          <View style={[styles.cardGroup, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
            <FormRow 
              label={t("profile.name")}
              value={name}
              onChangeText={(t: string) => { setName(t); setError(null); }}
              placeholder={t("profile.namePlaceholder")}
              autoCapitalize="words"
              editable={!loading}
            />
            <FormRow 
              label={t("auth.emailLabel")}
              value={user?.email || ""}
              editable={false}
              isLast={true}
            />
          </View>
          <UIText style={[styles.helper, { color: theme.colors.text.muted, textAlign: TEXT_START }]}>
            {t("profile.emailUneditable", { defaultValue: "Your email address cannot be changed as it is used for login." })}
          </UIText>

          {/* Danger Zone */}
          <View style={styles.sectionHeader}>
            <UIText style={[styles.sectionTitle, { color: theme.colors.status.error, textAlign: TEXT_START }]}>{t("profile.dangerZone", { defaultValue: "DANGER ZONE" })}</UIText>
          </View>
          
          <View style={[styles.cardGroup, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
             <Pressable style={[styles.dangerRow, { flexDirection: flexRow(IS_RTL) }]}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.status.error} />
                <UIText style={[styles.dangerText, { textAlign: TEXT_START }]}>{t("profile.deleteAccount", { defaultValue: "Delete Account" })}</UIText>
             </Pressable>
          </View>
          <UIText style={[styles.helper, { color: theme.colors.text.muted, textAlign: TEXT_START }]}>
            {t("profile.deleteWarning", { defaultValue: "Permanently delete your account and all associated data." })}
          </UIText>

        </Animated.View>
      </ScrollView>

      {/* Sticky Save Button */}
      {isDirty && (
        <Animated.View 
          entering={SlideInDown.duration(300)} 
          exiting={SlideOutDown.duration(200)}
          style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: theme.colors.canvas.surface, borderTopColor: theme.colors.border.default }]}
        >
          <Button
            label={t("common.save", { defaultValue: "Save Changes" })}
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
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 18,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    marginBottom: 12,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarInitials: {
    fontFamily: legacyTheme.fonts.extrabold,
    fontSize: 32,
  },
  editAvatarBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  editAvatarText: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 14,
    color: theme.colors.brand.primary,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontFamily: legacyTheme.fonts.medium,
    fontSize: 15,
  },
  rowInput: {
    flex: 1,
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 15,
    paddingVertical: 12,
  },
  dangerRow: {
    alignItems: "center",
    paddingHorizontal: 16,
    minHeight: 56,
    gap: 12,
  },
  dangerText: {
    flex: 1,
    fontFamily: legacyTheme.fonts.bold,
    fontSize: 15,
    color: theme.colors.status.error,
  },
  helper: {
    fontFamily: legacyTheme.fonts.regular,
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 8,
    lineHeight: 18,
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
    fontFamily: legacyTheme.fonts.regular,
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
    ...theme.shadows[1],
  },
});
