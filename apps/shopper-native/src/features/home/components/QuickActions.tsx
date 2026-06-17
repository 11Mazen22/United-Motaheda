/**
 * QuickActions — 2×2 action grid.
 *
 * Each card occupies half the available width so there's room for a subtitle
 * and a trailing chevron — content-first, not icon-only.
 * Distinct tint per action builds spatial memory.
 */

import React, { memo, useCallback } from "react";
import { Dimensions, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Text as UIText } from "@/shared/ui";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { PressableScale } from "@/shared/motion";
import { kit } from "@/shared/kit";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// Card dimensions — two columns with a gap inside the page padding
const PAGE_H   = theme.layout.pagePaddingH; // 20
const CARD_GAP = 10;
const CARD_W   = (Dimensions.get("window").width - PAGE_H * 2 - CARD_GAP) / 2;
const CARD_H   = Math.round(CARD_W * 0.92);

type ActionCardDef = {
  icon:   IoniconsName;
  label:  string;
  sub:    string;
  route:  string;
  accent: string;
  tint:   string;
};

const ACTION_CARDS: ActionCardDef[] = IS_RTL
  ? [
      { icon: "scan-outline",       label: "مسح وصفة",  sub: "ارفع وصفتك",    route: "/prescriptions/scan", accent: kit.color.accent,   tint: kit.color.accentTint  },
      { icon: "repeat-outline",     label: "تجديد",      sub: "طلبات دورية",   route: "/(tabs)/meds",        accent: kit.color.warn,    tint: kit.color.warnTint    },
      { icon: "bag-handle-outline", label: "إعادة طلب",  sub: "اطلب مجدداً",   route: "/(tabs)/orders",      accent: kit.color.success, tint: kit.color.successTint },
      { icon: "pricetag-outline",   label: "العروض",     sub: "خصومات حصرية",  route: "/deals",              accent: kit.color.danger,  tint: kit.color.dangerTint  },
    ]
  : [
      { icon: "scan-outline",       label: "Scan Rx",  sub: "Upload prescription", route: "/prescriptions/scan", accent: kit.color.accent,   tint: kit.color.accentTint  },
      { icon: "repeat-outline",     label: "Refill",   sub: "Recurring orders",    route: "/(tabs)/meds",        accent: kit.color.warn,    tint: kit.color.warnTint    },
      { icon: "bag-handle-outline", label: "Reorder",  sub: "Order again",         route: "/(tabs)/orders",      accent: kit.color.success, tint: kit.color.successTint },
      { icon: "pricetag-outline",   label: "Offers",   sub: "Exclusive deals",     route: "/deals",              accent: kit.color.danger,  tint: kit.color.dangerTint  },
    ];

interface QuickActionsProps {
  onNavigate: (route: string) => void;
}

export const QuickActions = memo(function QuickActions({ onNavigate }: QuickActionsProps) {
  return (
    <View style={cs.grid}>
      {ACTION_CARDS.map((card) => (
        <ActionCard key={card.route} def={card} onNavigate={onNavigate} />
      ))}
    </View>
  );
});

const ActionCard = memo(function ActionCard({
  def,
  onNavigate,
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

      {/* Icon well */}
      <View style={[cs.iconWell, { backgroundColor: def.tint }]}>
        <Ionicons name={def.icon} size={24} color={def.accent} />
      </View>

      {/* Label + sub + chevron */}
      <View style={cs.cardFoot}>
        <View style={cs.cardText}>
          <UIText numberOfLines={1} style={cs.label}>{def.label}</UIText>
          <UIText numberOfLines={1} style={cs.sub}>{def.sub}</UIText>
        </View>
        <Ionicons name={FORWARD_CHEVRON} size={14} color={kit.color.inkFaint} />
      </View>
    </PressableScale>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  grid: {
    flexDirection:     flexRow(IS_RTL),
    flexWrap:          "wrap",
    paddingHorizontal: PAGE_H,
    paddingTop:        kit.sp(4),
    paddingBottom:     kit.sp(1),
    gap:               CARD_GAP,
  },
  card: {
    width:           CARD_W,
    height:          CARD_H,
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    padding:         kit.sp(4),
    justifyContent:  "space-between",
    ...kit.shadow.raised,
  },
  iconWell: {
    width:           52,
    height:          52,
    borderRadius:    16,
    alignItems:      "center",
    justifyContent:  "center",
  },
  cardFoot: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "flex-end",
    justifyContent: "space-between",
  },
  cardText: { flex: 1, minWidth: 0 },
  label: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  sub: {
    fontFamily:         theme.fonts.regular,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    textAlign:          TEXT_START,
    includeFontPadding: false,
    marginTop:          2,
  },
});
