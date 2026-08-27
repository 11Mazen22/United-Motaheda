import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { getFaqCategories } from "../data";
import type { FAQCategory } from "../data";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  selected: FAQCategory | "all";
  onSelect: (cat: FAQCategory | "all") => void;
  counts: Record<FAQCategory | "all", number>;
}

export function FAQCategoryRail({ selected, onSelect, counts }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const categories = useMemo(() => getFaqCategories(theme), [theme]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      style={styles.container}>
      {/* All chip */}
      <CategoryChip
        label="الكل"
        icon="apps-outline"
        color={theme.colors.neutrals[600]}
        bg={theme.colors.neutrals[100]}
        count={counts.all}
        active={selected === "all"}
        onPress={() => onSelect("all")}
        styles={styles}
        theme={theme}
      />
      {categories.map((cat) => (
        <CategoryChip
          key={cat.key}
          label={cat.label}
          icon={cat.icon}
          color={cat.color}
          bg={cat.bg}
          count={counts[cat.key]}
          active={selected === cat.key}
          onPress={() => onSelect(cat.key)}
          styles={styles}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
}

function CategoryChip({
  label, icon, color, bg, count, active, onPress, styles, theme,
}: {
  label: string; icon: string; color: string; bg: string;
  count: number; active: boolean; onPress: () => void;
  styles: ReturnType<typeof getStyles>; theme: NativeTheme;
}) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={[
        styles.chip,
        active && { backgroundColor: bg, borderColor: color + "40" },
      ]}>
      <View style={[styles.chipIcon, { backgroundColor: active ? color + "18" : theme.colors.neutrals[100] }]}>
        <Ionicons name={icon as IoniconsName} size={13} color={active ? color : theme.colors.neutrals[400]} />
      </View>
      <UIText style={[styles.chipLabel, active && { color, fontFamily: legacyTheme.fonts.black }]}>
        {label}
      </UIText>
      {active && (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.chipCount, { backgroundColor: color + "18" }]}>
          <UIText style={[styles.chipCountText, { color }]}>{count}</UIText>
        </Animated.View>
      )}
    </Pressable>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    container: { flexGrow: 0 },
    rail: {
      paddingHorizontal: 20,
      gap: 8,
      paddingVertical: 4,
    },
    chip: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
      backgroundColor: theme.colors.canvas.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border.default,
    },
    chipIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    chipLabel: {
      fontSize: 11,
      fontFamily: legacyTheme.fonts.bold,
      color: theme.colors.neutrals[500],
    },
    chipCount: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    chipCountText: {
      fontSize: 9,
      fontFamily: legacyTheme.fonts.black,
    },
  });
}
