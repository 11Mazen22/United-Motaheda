/**
 * QuickActions — V2 care actions (PRODUCT_BLUEPRINT §4.4 "Quick care").
 */

import React, { memo, useCallback } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text as UIText } from "../shared/ui/Text";
import { theme } from "../shared/theme";
import { flexRow, isRtl } from "../utils/layout";
import { PressableScale } from "../shared/motion/PressableScale";
import { kit } from "../shared/kit";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL = isRtl();

type ActionCardDef = {
  icon:  IoniconsName;
  label: string;
  route: string;
};

const ACTION_CARDS: ActionCardDef[] = IS_RTL
  ? [
      { icon: "scan-outline",      label: "مسح وصفة",  route: "/prescriptions/scan" },
      { icon: "repeat-outline",    label: "تجديد",      route: "./(tabs)/meds" },
      { icon: "bag-handle-outline",label: "إعادة طلب",  route: "./(tabs)/orders" },
      { icon: "pricetag-outline",  label: "العروض",     route: "/deals" },
    ]
  : [
      { icon: "scan-outline",      label: "Scan Rx",  route: "/prescriptions/scan" },
      { icon: "repeat-outline",    label: "Refill",   route: "./(tabs)/meds" },
      { icon: "bag-handle-outline",label: "Reorder",  route: "./(tabs)/orders" },
      { icon: "pricetag-outline",  label: "Offers",   route: "/deals" },
    ];

interface QuickActionsProps {
  onNavigate: (route: string) => void;
}

export const QuickActions = memo(function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <View style={cs.row}>
      {ACTION_CARDS.map((card) => (
        <ActionCard key={card.route} def={card} onNavigate={onNavigate} />
      ))}
    </View>
  );
});

const ActionCard = memo(function ActionCard({
  def, onNavigate,
}: {
  def:        ActionCardDef;
  onNavigate: (route: string) => void;
}) {
  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onNavigate(def.route);
  }, [def.route, onNavigate]);

  return (
    <PressableScale
      onPress={handlePress}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityLabel={def.label}
      style={cs.card}>
      <View style={cs.iconWell}>
        <Ionicons name={def.icon} size={20} color={kit.color.accentDeep} />
      </View>
      <UIText numberOfLines={1} style={cs.label}>{def.label}</UIText>
    </PressableScale>
  );
});

const cs = StyleSheet.create({
  row: {
    flexDirection:     flexRow(IS_RTL),
    paddingHorizontal: theme.layout.pagePaddingH,
    paddingTop:        kit.sp(4),
    paddingBottom:     kit.sp(1),
    gap:               10,
  },
  card: {
    flex:            1,
    alignItems:      "center",
    gap:             8,
    paddingVertical: kit.sp(3),
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.card,
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  iconWell: {
    width:           44,
    height:          44,
    borderRadius:    14,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.accentTint,
  },
  label: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         15,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
});
