/**

 * QuickActions — 2×2 action grid.

 *

 * Each card occupies half the available width so there's room for a subtitle

 * and a trailing chevron — content-first, not icon-only.

 * Distinct tint per action builds spatial memory.

 */



import React, { memo, useCallback, useMemo } from "react";

import { Platform, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import * as Haptics from "expo-haptics";

import { useTranslation } from "react-i18next";

import { Text as UIText } from "@pharmacy/ui-native";

import { theme } from "@pharmacy/design-tokens";

import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";

import { PressableScale } from "@/shared/motion";

import { kit } from "@pharmacy/ui-native";

import { useScreenLayout } from "@/utils/responsive";



type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



const CARD_GAP = 10;



type ActionCardDef = {

  icon:   IoniconsName;

  label:  string;

  sub:    string;

  route:  string;

  accent: string;

  tint:   string;

};



interface QuickActionsProps {

  onNavigate: (route: string) => void;

}



export const QuickActions = memo(function QuickActions({ onNavigate }: QuickActionsProps) {

  const { t }              = useTranslation();

  const { width, pagePad } = useScreenLayout();

  const cardW = useMemo(() => Math.floor((width - pagePad * 2 - CARD_GAP) / 2), [width, pagePad]);

  const cardH = useMemo(() => Math.round(cardW * 0.92), [cardW]);



  const cards: ActionCardDef[] = [

    { icon: "scan-outline",       label: t("home.qaScanLabel"),    sub: t("home.qaScanSub"),    route: "/prescriptions/scan", accent: kit.color.accent,   tint: kit.color.accentTint  },

    { icon: "repeat-outline",     label: t("home.qaRefillLabel"),  sub: t("home.qaRefillSub"),  route: "/(customer)/(tabs)/meds",        accent: kit.color.warn,     tint: kit.color.warnTint    },

    { icon: "bag-handle-outline", label: t("home.qaReorderLabel"), sub: t("home.qaReorderSub"), route: "/(customer)/(tabs)/orders",      accent: kit.color.success,  tint: kit.color.successTint },

    { icon: "compass-outline",    label: t("home.qaExploreLabel"), sub: t("home.qaExploreSub"), route: "/(customer)/(tabs)/products",    accent: kit.color.danger,   tint: kit.color.dangerTint  },

  ];



  return (

    <View style={[cs.grid, { paddingHorizontal: pagePad }]}>

      {cards.map((card) => (

        <ActionCard key={card.route} def={card} onNavigate={onNavigate} cardW={cardW} cardH={cardH} />

      ))}

    </View>

  );

});



const ActionCard = memo(function ActionCard({

  def,

  onNavigate,

  cardW,

  cardH,

}: {

  def:        ActionCardDef;

  onNavigate: (route: string) => void;

  cardW:      number;

  cardH:      number;

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

      style={[cs.card, { width: cardW, height: cardH }]}>



      {/* VIP accent stripe */}

      <View style={[cs.accentStripe, { backgroundColor: def.accent }]} />



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

    flexDirection: flexRow(IS_RTL),

    flexWrap:      "wrap",

    paddingTop:    kit.sp(4),

    paddingBottom: kit.sp(1),

    gap:           CARD_GAP,

  },

  card: {

    backgroundColor: kit.color.surface,

    borderRadius:    kit.radius.lg,

    borderWidth:     1,

    borderColor:     kit.color.line,

    padding:         kit.sp(4),

    justifyContent:  "space-between",

    overflow:        "hidden",

    ...kit.shadow.raised,

  },

  accentStripe: {

    position:     "absolute",

    top:          0,

    start: 0,

    end: 0,

    height:       3,

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

