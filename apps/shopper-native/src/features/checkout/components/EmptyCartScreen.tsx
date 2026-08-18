import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit, Button } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TRUST: Array<{ icon: IoniconsName; labelKey: string; color: string; tint: string }> = [
  { icon: "flash-outline",            labelKey: "checkout.trust1", color: kit.color.success,    tint: kit.color.successTint },
  { icon: "shield-checkmark-outline", labelKey: "checkout.trust2", color: kit.color.accentDeep, tint: kit.color.accentTint  },
  { icon: "star-outline",             labelKey: "checkout.trust3", color: kit.color.warn,        tint: kit.color.warnTint    },
];

interface EmptyCartScreenProps {
  onBrowse: () => void;
  insets:   { top: number };
}

export const EmptyCartScreen = React.memo(function EmptyCartScreen({
  onBrowse,
  insets,
}: EmptyCartScreenProps) {
  const { t } = useTranslation();

  return (
    <View style={[s.screen, { paddingTop: insets.top + 72 }]}>

      {/* ── Hero icon — outer ring + inner tile ── */}
      <Animated.View
        entering={FadeInDown.duration(460).springify().damping(16)}
        style={s.iconRing}>
        <View style={s.iconTile}>
          <Ionicons name="cart-outline" size={44} color={kit.color.accentDeep} />
        </View>
      </Animated.View>

      {/* ── Text stack ── */}
      <Animated.View entering={FadeInDown.duration(380).delay(80)} style={s.textStack}>
        <UIText variant="sheet-title" align="center" style={s.title}>
          {t("checkout.emptyCartTitle")}
        </UIText>
        <UIText variant="body" color="secondary" align="center" style={s.sub}>
          {t("checkout.emptyCartDesc")}
        </UIText>
      </Animated.View>

      {/* ── CTA button ── */}
      <Animated.View entering={FadeInUp.duration(360).delay(180)} style={s.btnWrap}>
        <Button
          label={t("checkout.browseBtn")}
          icon="storefront-outline"
          size="lg"
          full
          onPress={onBrowse}
        />
      </Animated.View>

      {/* ── Trust chips ── */}
      <Animated.View entering={FadeIn.delay(300).duration(320)} style={[s.trustRow, { flexDirection: flexRow(IS_RTL) }]}>
        {TRUST.map((item) => (
          <View key={item.icon} style={[s.trustChip, { flexDirection: flexRow(IS_RTL), backgroundColor: item.tint }]}>
            <Ionicons name={item.icon} size={13} color={item.color} />
            <UIText style={[s.trustText, { color: item.color }]}>
              {t(item.labelKey)}
            </UIText>
          </View>
        ))}
      </Animated.View>
    </View>
  );
});

const s = StyleSheet.create({
  screen: {
    flex:              1,
    backgroundColor:   kit.color.canvas,
    alignItems:        "center",
    paddingHorizontal: 32,
  },

  // ── Hero icon ──────────────────────────────────────────────────────────────
  iconRing: {
    width:           120,
    height:          120,
    borderRadius:    60,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    28,
  },
  iconTile: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
    shadowOpacity:   0.14,
  },

  // ── Text stack ─────────────────────────────────────────────────────────────
  textStack: {
    alignItems: "center",
    gap:        10,
    maxWidth:   320,
  },
  title: {
    letterSpacing:      -0.3,
    includeFontPadding: false,
  },
  sub: {
    lineHeight:         22,
    includeFontPadding: false,
  },

  // ── CTA ────────────────────────────────────────────────────────────────────
  btnWrap: {
    marginTop:  32,
    alignSelf:  "stretch",
  },

  // ── Trust chips ────────────────────────────────────────────────────────────
  trustRow: {
    marginTop:  24,
    gap:        8,
    flexWrap:   "wrap",
    alignItems: "center",
    justifyContent: "center",
  },
  trustChip: {
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   6,
    borderRadius:      999,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  trustText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    includeFontPadding: false,
  },
});
