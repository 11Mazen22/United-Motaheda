import React, { useCallback, useMemo } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useTheme, sheetMotion, type ThemePreference } from "@pharmacy/ui-native";
import { create } from "zustand";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import type { NativeTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export const useThemePickerStore = create<{
  visible: boolean;
  show: () => void;
  hide: () => void;
}>((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));

export function ThemePickerSheet() {
  const visible = useThemePickerStore((s) => s.visible);
  const onClose = useThemePickerStore((s) => s.hide);
  const { t } = useTranslation();
  const { theme, preference: mode, setPreference: setMode } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const IS_RTL = isRtl();

  const handleSelect = useCallback((m: ThemePreference) => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    setMode(m);
    onClose();
  }, [setMode, onClose]);

  const options: Array<{ id: ThemePreference; labelKey: string; icon: IoniconsName }> = [
    { id: "system", labelKey: "theme.system", icon: "phone-portrait-outline" },
    { id: "light", labelKey: "theme.light", icon: "sunny-outline" },
    { id: "dark", labelKey: "theme.dark", icon: "moon-outline" },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View
          entering={sheetMotion.backdropEnter}
          exiting={sheetMotion.backdropExit}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]}
        />
        
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          entering={sheetMotion.enter}
          exiting={sheetMotion.exit}
          style={[
            styles.sheet,
            { 
              backgroundColor: theme.colors.canvas.surface, 
              paddingBottom: Math.max(insets.bottom, 24) 
            }
          ]}
        >
          <View style={styles.handle} />
          
          <UIText style={[styles.title, { color: theme.colors.text.primary, textAlign: textAlignStart(IS_RTL) }]}>
            {t("profile.theme", { defaultValue: "Appearance" })}
          </UIText>

          <View style={[styles.container, { flexDirection: flexRow(IS_RTL) }]}>
            {options.map((opt) => {
              const active = mode === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => handleSelect(opt.id)}
                  style={[
                    styles.card,
                    {
                      backgroundColor: active ? theme.colors.brand.primaryLight : theme.colors.canvas.surfaceElevated,
                      borderColor: active ? theme.colors.brand.primary : theme.colors.border.subtle,
                    },
                    !active && theme.shadows[1]
                  ]}
                >
                  <Ionicons name={opt.icon} size={28} color={active ? theme.colors.brand.primary : theme.colors.text.secondary} />
                  <UIText style={[styles.label, { color: active ? theme.colors.brand.primary : theme.colors.text.primary }]}>
                    {t(opt.labelKey, { defaultValue: opt.id.charAt(0).toUpperCase() + opt.id.slice(1) })}
                  </UIText>
                  {active && (
                    <View style={[styles.badge, IS_RTL ? { left: -8 } : { right: -8 }]}>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end" },
    sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, ...theme.shadows[4] },
    handle: { width: 48, height: 5, borderRadius: 3, backgroundColor: theme.colors.border.strong, alignSelf: "center", marginTop: 14, marginBottom: 18 },
    title: { 
      fontFamily: legacyTheme.fonts.extrabold, // heavier weight for premium feel
      fontSize: 22, 
      lineHeight: 36, // fix clipping for Arabic letters
      paddingHorizontal: 24, 
      marginBottom: 20, 
      paddingBottom: 4 
    },
    container: { paddingHorizontal: 24, gap: 14, paddingTop: 4 },
    card: {
      flex: 1,
      aspectRatio: 0.95,
      borderRadius: 20,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    label: { fontFamily: legacyTheme.fonts.bold, fontSize: 14, textAlign: "center", lineHeight: 22 },
    badge: {
      position: "absolute",
      top: -8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.colors.brand.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: theme.colors.canvas.surface,
    },
  });
}
