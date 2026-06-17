import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@/shared/ui";
import { kit, Button } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

interface SuccessScreenProps {
  orderId:      string;
  total:        number;
  insets:       { top: number; bottom: number };
  onContinue:   () => void;
  onViewOrders: () => void;
}

export const SuccessScreen = React.memo(function SuccessScreen({
  orderId,
  total,
  insets,
  onContinue,
  onViewOrders,
}: SuccessScreenProps) {
  const { t } = useTranslation();
  const shortId = orderId ? orderId.slice(-8).toUpperCase() : "—";

  return (
    <View style={[s.screen, { paddingTop: insets.top + 32 }]}>

      {/* ── Hero icon — outer ring + inner tile ── */}
      <Animated.View
        entering={FadeInDown.duration(500).springify().damping(16)}
        style={s.iconWrap}>
        <View style={s.iconRing}>
          <View style={s.iconTile}>
            <Ionicons name="checkmark-circle" size={44} color={kit.color.accentDeep} />
          </View>
        </View>
      </Animated.View>

      {/* ── Order ID pill ── */}
      <Animated.View entering={FadeIn.delay(80).duration(320)} style={s.orderIdWrap}>
        <View style={s.orderIdPill}>
          <Ionicons name="receipt-outline" size={11} color={kit.color.accentDeep} />
          <UIText style={s.orderIdText}>#{shortId}</UIText>
        </View>
      </Animated.View>

      {/* ── Heading ── */}
      <Animated.View
        entering={FadeInDown.delay(120).duration(400)}
        style={s.headingStack}>
        <UIText variant="screen-title" align="center" style={s.headingTitle}>
          {t("checkout.orderReceived")}
        </UIText>
        <UIText variant="body" color="secondary" align="center" style={s.headingSub}>
          {t("checkout.orderReceivedDesc")}
        </UIText>
      </Animated.View>

      {/* ── Total ── */}
      <Animated.View entering={FadeInDown.delay(200).duration(380)} style={s.totalStack}>
        <UIText variant="eyebrow" color="tertiary" align="center">
          {t("checkout.orderTotalLabel")}
        </UIText>
        <UIText style={s.totalAmount}>
          {formatPrice(total)}
        </UIText>
      </Animated.View>

      {/* ── Detail card ── */}
      <Animated.View entering={FadeInDown.delay(280).duration(380)} style={s.card}>

        {/* ETA row */}
        <View style={[s.cardRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.cardRowIcon, { backgroundColor: kit.color.accentTint }]}>
            <Ionicons name="time-outline" size={14} color={kit.color.accentDeep} />
          </View>
          <UIText variant="body-sm" color="secondary" style={{ flex: 1 }}>
            {t("checkout.estimatedDelivery")}
          </UIText>
          <View style={s.etaPill}>
            <UIText style={s.etaText}>30–60 {t("delivery.minUnit")}</UIText>
          </View>
        </View>

        <View style={s.divider} />

        {/* Status row */}
        <View style={[s.cardRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.cardRowIcon, { backgroundColor: kit.color.successTint }]}>
            <Ionicons name="flash-outline" size={14} color={kit.color.success} />
          </View>
          <UIText variant="body-sm" color="secondary" style={{ flex: 1 }}>
            {t("checkout.orderStatusLabel")}
          </UIText>
          <View style={s.statusPill}>
            <View style={s.statusDot} />
            <UIText style={s.statusText}>{t("checkout.preparingStatus")}</UIText>
          </View>
        </View>

        <View style={s.divider} />

        {/* Order number row */}
        <View style={[s.cardRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.cardRowIcon, { backgroundColor: kit.color.well }]}>
            <Ionicons name="document-text-outline" size={14} color={kit.color.inkSoft} />
          </View>
          <UIText variant="body-sm" color="secondary" style={{ flex: 1 }}>
            {t("checkout.orderNumberLabel")}
          </UIText>
          <View style={s.orderNumPill}>
            <UIText style={s.orderNumText}>{shortId}</UIText>
          </View>
        </View>
      </Animated.View>

      {/* ── Trust strip ── */}
      <Animated.View entering={FadeIn.delay(360).duration(320)} style={[s.trustStrip, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={[s.trustItem, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="shield-checkmark" size={12} color={kit.color.success} />
          <UIText style={s.trustText}>{t("checkout.trustSeal")}</UIText>
        </View>
        <View style={s.trustDivider} />
        <View style={[s.trustItem, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="lock-closed" size={12} color={kit.color.accentDeep} />
          <UIText style={s.trustText}>{t("checkout.secure")}</UIText>
        </View>
      </Animated.View>

      {/* ── Actions ── */}
      <Animated.View
        entering={FadeInUp.delay(420).duration(400)}
        style={[s.actions, { paddingBottom: insets.bottom + 20 }]}>
        <Button
          label={t("checkout.trackOrderBtn")}
          icon="receipt-outline"
          iconEnd
          size="lg"
          full
          onPress={onViewOrders}
        />
        <Button
          label={t("checkout.continueShoppingBtn")}
          variant="ghost"
          size="md"
          full
          onPress={onContinue}
        />
      </Animated.View>
    </View>
  );
});

const s = StyleSheet.create({
  screen: {
    flex:              1,
    backgroundColor:   kit.color.canvas,
    alignItems:        "center",
    paddingHorizontal: 24,
  },

  // ── Hero icon ──────────────────────────────────────────────────────────────
  iconWrap: {
    marginBottom: 20,
  },
  iconRing: {
    width:           112,
    height:          112,
    borderRadius:    56,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1.5,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  iconTile: {
    width:           76,
    height:          76,
    borderRadius:    38,
    backgroundColor: kit.color.surface,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },

  // ── Order ID pill ──────────────────────────────────────────────────────────
  orderIdWrap: {
    marginBottom: 16,
  },
  orderIdPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderRadius:      999,
  },
  orderIdText: {
    fontFamily:         theme.fonts.black,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    includeFontPadding: false,
  },

  // ── Heading ────────────────────────────────────────────────────────────────
  headingStack: {
    alignItems: "center",
    gap:        8,
    maxWidth:   340,
  },
  headingTitle: {
    letterSpacing:      -0.5,
    includeFontPadding: false,
  },
  headingSub: {
    lineHeight:         22,
    includeFontPadding: false,
  },

  // ── Total ──────────────────────────────────────────────────────────────────
  totalStack: {
    alignItems: "center",
    marginTop:  24,
    gap:        4,
  },
  totalAmount: {
    fontFamily:         theme.fonts.black,
    fontSize:           40,
    lineHeight:         48,
    color:              kit.color.ink,
    letterSpacing:      -1.5,
    includeFontPadding: false,
  },

  // ── Detail card ────────────────────────────────────────────────────────────
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    18,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop:       24,
    alignSelf:       "stretch",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.raised,
  },
  cardRow: {
    alignItems:    "center",
    gap:           12,
    paddingVertical: 14,
  },
  cardRowIcon: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: kit.color.line,
  },
  etaPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
  },
  etaText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  statusPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.successTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
  },
  statusDot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: kit.color.success,
  },
  statusText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    color:              kit.color.success,
    includeFontPadding: false,
  },
  orderNumPill: {
    backgroundColor:   kit.color.ink,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      8,
  },
  orderNumText: {
    fontFamily:         theme.fonts.black,
    fontSize:           11,
    color:              "#fff",
    letterSpacing:      1,
    includeFontPadding: false,
  },

  // ── Trust strip ────────────────────────────────────────────────────────────
  trustStrip: {
    alignItems:  "center",
    gap:         12,
    marginTop:   16,
  },
  trustItem: {
    alignItems: "center",
    gap:        5,
  },
  trustText: {
    fontFamily:         theme.fonts.semibold,
    fontSize:           11,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },
  trustDivider: {
    width:           1,
    height:          12,
    backgroundColor: kit.color.line,
  },

  // ── Actions ────────────────────────────────────────────────────────────────
  actions: {
    marginTop:         "auto",
    alignSelf:         "stretch",
    gap:               10,
  },
});
