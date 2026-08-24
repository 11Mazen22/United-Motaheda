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

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";

import { PressableScale } from "@/shared/motion";



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

    { icon: "scan-outline",       label: t("home.qaScanLabel"),    sub: t("home.qaScanSub"),    route: "/prescriptions/scan", accent: theme.colors.brand.primary,   tint: theme.colors.brand.primaryLight  },

    { icon: "repeat-outline",     label: t("home.qaRefillLabel"),  sub: t("home.qaRefillSub"),  route: "/(customer)/(tabs)/meds",        accent: theme.colors.status.warning,     tint: `${theme.colors.status.warning}1A`    },

    { icon: "bag-handle-outline", label: t("home.qaReorderLabel"), sub: t("home.qaReorderSub"), route: "/(customer)/(tabs)/orders",      accent: theme.colors.status.success,  tint: `${theme.colors.status.success}1A` },

    { icon: "compass-outline",    label: t("home.qaExploreLabel"), sub: t("home.qaExploreSub"), route: "/(customer)/(tabs)/products",    accent: theme.colors.status.error,   tint: `${theme.colors.status.error}1A`  },

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

        <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.text.muted} />

      </View>

    </PressableScale>

  );

});



// ─── Styles ───────────────────────────────────────────────────────────────────



const cs = StyleSheet.create({

  grid: {

    flexDirection: flexRow(IS_RTL),

    flexWrap:      "wrap",

    paddingTop:    16,

    paddingBottom: 4,

    gap:           CARD_GAP,

  },

  card: {

    backgroundColor: theme.colors.canvas.surface,

    borderRadius:    12,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    padding:         16,

    justifyContent:  "space-between",

    overflow:        "hidden",

    ...theme.shadows[1],

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

    fontFamily:         legacyTheme.fonts.black,

    fontSize:           14,

    lineHeight:         20,

    color:              theme.colors.text.primary,

    textAlign:          TEXT_START,

    includeFontPadding: false,

  },

  sub: {

    fontFamily:         legacyTheme.fonts.regular,

    fontSize:           11,

    lineHeight:         16,

    color:              theme.colors.text.muted,

    textAlign:          TEXT_START,

    includeFontPadding: false,

    marginTop:          2,

  },

});

