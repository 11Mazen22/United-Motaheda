/**
 * SearchIntents — Tier-1 alternative-path chip row.
 *
 * Sits directly under the command bar in the sticky search header. Gives the
 * user three premium-feeling escapes from typing:
 *
 *   ◰ Scan Rx        — for people who only have the prescription photo
 *   ☰ Browse all     — for people who don't know what to type yet
 *   ✦ Ask pharmacist — for people who can describe a symptom but not a name
 *
 * The middle chip ("Browse all") is the primary affordance (filled teal);
 * the other two are quiet ghost chips (tinted surface, accent text).
 */

import React, { memo, useCallback } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

export interface SearchIntentsProps {
  onScanRx:      () => void;
  onBrowseAll:   () => void;
  onPharmacist:  () => void;
  scanLabel:     string;
  browseLabel:   string;
  pharmaLabel:   string;
}

export const SearchIntents = memo(function SearchIntents({
  onScanRx,
  onBrowseAll,
  onPharmacist,
  scanLabel,
  browseLabel,
  pharmaLabel,
}: SearchIntentsProps) {
  return (
    <View style={s.row}>
      <IntentChip
        icon="scan-outline"
        label={scanLabel}
        onPress={onScanRx}
      />
      <IntentChip
        icon="grid-outline"
        label={browseLabel}
        primary
        onPress={onBrowseAll}
      />
      <IntentChip
        icon="chatbubbles-outline"
        label={pharmaLabel}
        onPress={onPharmacist}
      />
    </View>
  );
});

// ─── IntentChip ──────────────────────────────────────────────────────────────

interface IntentChipProps {
  icon:     IoniconsName;
  label:    string;
  primary?: boolean;
  onPress:  () => void;
}

const IntentChip = memo(function IntentChip({
  icon,
  label,
  primary,
  onPress,
}: IntentChipProps) {
  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        s.chip,
        primary && s.chipPrimary,
        pressed && (primary ? s.chipPrimaryPressed : s.chipPressed),
      ]}>
      <Ionicons
        name={icon}
        size={16}
        color={primary ? kit.color.onAccent : kit.color.accentDeep}
      />
      <UIText
        numberOfLines={1}
        style={[s.label, primary && s.labelPrimary]}>
        {label}
      </UIText>
    </Pressable>
  );
});

const s = StyleSheet.create({
  row: {
    flexDirection: flexRow(IS_RTL),
    gap:           8,
  },
  chip: {
    flex:              1,
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "center",
    gap:               6,
    height:            42,
    paddingHorizontal: 10,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.accentTint,
  },
  chipPressed: {
    backgroundColor: kit.color.well,
  },
  chipPrimary: {
    backgroundColor: kit.color.accentDeep,
    ...kit.shadow.raised,
  },
  chipPrimaryPressed: {
    opacity: 0.88,
  },
  label: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
    flexShrink:         1,
  },
  labelPrimary: {
    color: kit.color.onAccent,
  },
});
