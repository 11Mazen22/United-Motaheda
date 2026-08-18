import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { FAQ_CATEGORIES } from "../data";
import type { FAQCategory } from "../data";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  selected: FAQCategory | "all";
  onSelect: (cat: FAQCategory | "all") => void;
  counts: Record<FAQCategory | "all", number>;
}

export function FAQCategoryRail({ selected, onSelect, counts }: Props) {
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
        color={kit.color.slate[600]}
        bg={kit.color.slate[100]}
        count={counts.all}
        active={selected === "all"}
        onPress={() => onSelect("all")}
      />
      {FAQ_CATEGORIES.map((cat) => (
        <CategoryChip
          key={cat.key}
          label={cat.label}
          icon={cat.icon}
          color={cat.color}
          bg={cat.bg}
          count={counts[cat.key]}
          active={selected === cat.key}
          onPress={() => onSelect(cat.key)}
        />
      ))}
    </ScrollView>
  );
}

function CategoryChip({
  label, icon, color, bg, count, active, onPress,
}: {
  label: string; icon: string; color: string; bg: string;
  count: number; active: boolean; onPress: () => void;
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
      <View style={[styles.chipIcon, { backgroundColor: active ? color + "18" : kit.color.slate[50] }]}>
        <Ionicons name={icon as IoniconsName} size={13} color={active ? color : kit.color.slate[400]} />
      </View>
      <UIText style={[styles.chipLabel, active && { color, fontFamily: theme.fonts.black }]}>
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

const styles = StyleSheet.create({
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
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: kit.color.border.default,
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
    fontFamily: theme.fonts.bold,
    color: kit.color.slate[500],
  },
  chipCount: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipCountText: {
    fontSize: 9,
    fontFamily: theme.fonts.black,
  },
});
