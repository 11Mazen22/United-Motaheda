/**
 * BranchCard — premium branch display row.
 * Selectable / non-selectable. Shows name, area, hours, distance.
 */

import React, { memo, useCallback, useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { theme as legacyTheme } from "@pharmacy/design-tokens";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import type { Branch } from "../branches/types";

interface BranchCardProps {
  branch: Branch;
  selected?: boolean;
  distanceKm?: number;
  onPress?: () => void;
  compact?: boolean;
}

export const BranchCard = memo(function BranchCard({
  branch,
  selected,
  distanceKm,
  onPress,
  compact,
}: BranchCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const interactive = !!onPress;

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      onPress={interactive ? handlePress : undefined}
      disabled={!interactive}
      accessibilityRole={interactive ? "radio" : undefined}
      accessibilityLabel={`${branch.nameAr}، ${branch.area}${typeof distanceKm === "number" ? `، على بُعد ${distanceKm.toFixed(1)} كم` : ""}`}
      accessibilityState={interactive ? { checked: !!selected } : undefined}
      style={[
        styles.card,
        selected && styles.cardSelected,
        compact && styles.cardCompact,
      ]}>
      <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
        <Ionicons
          name={branch.isPrimary ? "star" : "medkit"}
          size={16}
          color={selected ? "#fff" : theme.colors.brand.primary}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <UIText style={styles.title} numberOfLines={1}>
            {branch.nameAr}
          </UIText>
          {branch.isPrimary && (
            <View style={styles.primaryBadge}>
              <UIText style={styles.primaryBadgeText}>الرئيسي</UIText>
            </View>
          )}
        </View>
        <UIText style={styles.area} numberOfLines={1}>{branch.area}</UIText>
        {!compact && (
          <>
            <UIText style={styles.address} numberOfLines={2}>{branch.addressAr}</UIText>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="time-outline" size={10} color={theme.colors.neutrals[500]} />
                <UIText style={styles.metaText}>{branch.hoursAr}</UIText>
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.right}>
        {typeof distanceKm === "number" && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.distPill}>
            <Ionicons name="navigate-outline" size={10} color={theme.colors.brand.primary} />
            <UIText style={styles.distText}>{distanceKm.toFixed(1)} كم</UIText>
          </Animated.View>
        )}
        {interactive && (
          <View style={[styles.radio, selected && styles.radioActive]}>
            {selected && <View style={styles.radioDot} />}
          </View>
        )}
      </View>
    </Pressable>
  );
});

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    card: {
      flexDirection: flexRow(isRtl()),
      alignItems: "flex-start",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      backgroundColor: theme.colors.canvas.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border.default,
    },
    cardCompact: { paddingVertical: 10 },
    cardSelected: {
      borderColor: theme.colors.brand.primaryLight,
      backgroundColor: theme.colors.brand.primaryLight + "60",
      ...theme.shadows[0],
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.colors.brand.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    },
    iconWrapSelected: { backgroundColor: theme.colors.brand.primary },
    body: { flex: 1, gap: 3 },
    titleRow: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 6 },
    title: { fontSize: 13, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary, textAlign: textAlignStart(isRtl()) },
    primaryBadge: {
      backgroundColor: theme.colors.brand.accentLight,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
    },
    primaryBadgeText: { fontSize: 9, fontFamily: legacyTheme.fonts.bold, color: theme.colors.statusSoft.warning.text },
    area: { fontSize: 11, fontFamily: legacyTheme.fonts.bold, color: theme.colors.brand.primary, textAlign: textAlignStart(isRtl()) },
    address: { fontSize: 11, fontFamily: legacyTheme.fonts.regular, color: theme.colors.neutrals[500], textAlign: textAlignStart(isRtl()), lineHeight: 16 },
    metaRow: { flexDirection: flexRow(isRtl()), flexWrap: "wrap", gap: 6, marginTop: 4 },
    metaPill: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.colors.neutrals[100],
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
    },
    metaText: { fontSize: 9, fontFamily: legacyTheme.fonts.semibold, color: theme.colors.neutrals[500] },
    right: { alignItems: "center", gap: 8, justifyContent: "center" },
    distPill: {
      flexDirection: flexRow(isRtl()),
      alignItems: "center",
      gap: 3,
      backgroundColor: theme.colors.brand.primaryLight,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
    },
    distText: { fontSize: 9, fontFamily: legacyTheme.fonts.black, color: theme.colors.brand.primary },
    radio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: theme.colors.neutrals[300],
      alignItems: "center",
      justifyContent: "center",
    },
    radioActive: { borderColor: theme.colors.brand.primary },
    radioDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.brand.primary,
    },
  });
}
