import React, { useCallback, useMemo } from "react";
import { Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useTheme, type ThemePreference } from "@pharmacy/ui-native";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import type { NativeTheme } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export function ThemePickerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View 
          entering={FadeIn.duration(200)} 
          exiting={FadeOut.duration(200)} 
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)" }]} 
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <Animated.View 
          entering={SlideInDown.springify().damping(18)} 
          exiting={SlideOutDown.duration(200)}
          style={[styles.sheet, { backgroundColor: theme.colors.canvas.surface, paddingBottom: Math.max(insets.bottom, 20) }]}
        >
          <View style={styles.handle} />
          <UIText style={[styles.title, { color: theme.colors.text.primary, textAlign: textAlignStart(IS_RTL) }]}>
            {t("profile.theme", { defaultValue: "Appearance" })}
          </UIText>

          <View style={styles.container}>
            {options.map((opt, i) => {
              const active = mode === opt.id;
              return (
                <Pressable 
                  key={opt.id} 
                  onPress={() => handleSelect(opt.id)}
                  style={[styles.row, { flexDirection: flexRow(IS_RTL), borderBottomWidth: i === options.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default }]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: active ? theme.colors.brand.primaryLight : theme.colors.border.default }]}>
                    <Ionicons name={opt.icon} size={20} color={active ? theme.colors.brand.primary : theme.colors.text.secondary} />
                  </View>
                  <UIText style={[styles.label, { color: active ? theme.colors.brand.primary : theme.colors.text.primary, textAlign: textAlignStart(IS_RTL) }]}>
                    {t(opt.labelKey, { defaultValue: opt.id.charAt(0).toUpperCase() + opt.id.slice(1) })}
                  </UIText>
                  {active && <Ionicons name="checkmark" size={24} color={theme.colors.brand.primary} />}
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
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, ...theme.shadows[3] },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border.strong, alignSelf: "center", marginTop: 12, marginBottom: 20 },
    title: { fontFamily: legacyTheme.fonts.bold, fontSize: 18, paddingHorizontal: 24, marginBottom: 16 },
    container: { paddingHorizontal: 24 },
    row: { alignItems: "center", paddingVertical: 16, gap: 16 },
    iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    label: { flex: 1, fontFamily: legacyTheme.fonts.bold, fontSize: 16 },
  });
}
