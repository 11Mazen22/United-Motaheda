import React, { useCallback, useEffect } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit, Button } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { showSuccessSheet } from "@/shared/store/appSheetStore";
import { formatPrice } from "@/utils/format";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface SuccessScreenProps {
  orderId:      string;
  total:        number;
  insets:       { top: number; bottom: number };
  onContinue:   () => void;
  onViewOrders: () => void;
}

// Static — this screen renders the instant an order is placed, before any
// status webhook could possibly have fired. "Placed" is the only step we can
// honestly claim done; "Preparing" is shown as the current/in-flight step so
// the screen isn't just a dead-end checkmark. The full live-status version of
// this same dot/line language lives in order-detail.styles.ts (buildTimeline)
// — reused here, not reinvented, so the two screens read as one system.
const STEPS = [
  { key: "placed",     labelKey: "orders.stepPlaced",     icon: "bag-check-outline" as const },
  { key: "processing", labelKey: "orders.stepProcessing", icon: "cube-outline" as const },
  { key: "shipped",    labelKey: "orders.stepShipped",    icon: "car-outline" as const },
  { key: "delivered",  labelKey: "orders.stepDelivered",  icon: "checkmark-circle-outline" as const },
] as const;

export const SuccessScreen = React.memo(function SuccessScreen({
  orderId,
  total,
  insets,
  onContinue,
  onViewOrders,
}: SuccessScreenProps) {
  const { t } = useTranslation();
  const shortId = orderId ? orderId.slice(-8).toUpperCase() : "—";

  // ── Celebratory pulse — one soft ripple on mount, not a distracting loop.
  const ringScale   = useSharedValue(0.85);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    ringOpacity.value = withDelay(160, withSequence(
      withTiming(0.35, { duration: 260, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 560, easing: Easing.out(Easing.quad) }),
    ));
    ringScale.value = withDelay(160, withTiming(1.45, { duration: 820, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity:   ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const copyOrderId = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(shortId);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      showSuccessSheet(t("checkout.orderIdCopied"), t("checkout.orderIdCopiedMsg"));
    } catch {
      // Clipboard failures aren't worth surfacing here — the number is also
      // plainly visible on screen to copy manually.
    }
  }, [shortId, t]);

  return (
    <View style={s.screen}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 28 }]}
        showsVerticalScrollIndicator={false}>

      {/* ── Hero icon — pulse ring + outer ring + inner tile ── */}
      <View style={s.iconWrap}>
        <Animated.View style={[s.pulseRing, ringStyle]} />
        <Animated.View
          entering={FadeInDown.duration(500).springify().damping(14)}
          style={s.iconRing}>
          <View style={s.iconTile}>
            <Ionicons name="checkmark-circle" size={42} color={kit.color.accentDeep} />
          </View>
        </Animated.View>
      </View>

      {/* ── Order ID pill — tap to copy ── */}
      <Animated.View entering={FadeIn.delay(80).duration(320)} style={s.orderIdWrap}>
        <Pressable
          onPress={copyOrderId}
          style={({ pressed }) => [s.orderIdPill, pressed && s.orderIdPillPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.orderIdCopyHint")}>
          <UIText style={s.orderIdText}>#{shortId}</UIText>
          <Ionicons name="copy-outline" size={12} color={kit.color.accentDeep} />
        </Pressable>
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
      <Animated.View entering={FadeInDown.delay(190).duration(380)} style={s.totalStack}>
        <UIText variant="eyebrow" color="tertiary" align="center">
          {t("checkout.orderTotalLabel")}
        </UIText>
        <UIText style={s.totalAmount}>
          {formatPrice(total)}
        </UIText>
        <View style={s.etaPill}>
          <Ionicons name="time-outline" size={12} color={kit.color.accentDeep} />
          <UIText style={s.etaText}>{t("checkout.estimatedDelivery")} · 30–60 {t("delivery.minUnit")}</UIText>
        </View>
      </Animated.View>

      {/* ── Timeline card — same dot/line language as the order-detail screen ── */}
      <Animated.View entering={FadeInDown.delay(260).duration(380)} style={s.card}>
        <UIText style={[s.cardTitle, { textAlign: TEXT_START }]}>{t("orders.timeline")}</UIText>
        {STEPS.map((step, i) => {
          const done    = i === 0;
          const current = i === 1;
          return (
            <View key={step.key} style={[s.timelineRow, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={s.timelineTrack}>
                <View style={[
                  s.timelineDot,
                  done && s.timelineDotDone,
                  current && s.timelineDotCurrent,
                  !done && !current && s.timelineDotPending,
                ]}>
                  <Ionicons
                    name={step.icon}
                    size={14}
                    color={done ? "#fff" : current ? kit.color.accentDeep : kit.color.inkFaint}
                  />
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[s.timelineLine, done && s.timelineLineDone]} />
                )}
              </View>
              <UIText
                weight={done || current ? "bold" : "regular"}
                style={[
                  s.timelineText,
                  { textAlign: TEXT_START, color: done || current ? kit.color.ink : kit.color.inkFaint },
                ]}>
                {t(step.labelKey)}
              </UIText>
              {current && (
                <View style={s.currentBadge}>
                  <UIText style={s.currentBadgeText}>{t("checkout.preparingStatus")}</UIText>
                </View>
              )}
            </View>
          );
        })}
      </Animated.View>

      {/* ── Trust strip ── */}
      <Animated.View entering={FadeIn.delay(340).duration(320)} style={[s.trustStrip, { flexDirection: flexRow(IS_RTL) }]}>
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
      </ScrollView>

      {/* ── Actions — sits outside the scroll area so it never scrolls out of
           reach, and reserves its own bottom safe-area padding instead of the
           old `marginTop: "auto"` push, which had nothing to push against
           once content could no longer be guaranteed to fit one screen. ── */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
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
    paddingHorizontal: 24,
  },
  scroll: {
    flex:      1,
    alignSelf: "stretch",
  },
  scrollContent: {
    alignItems: "center",
  },

  // ── Hero icon ──────────────────────────────────────────────────────────────
  iconWrap: {
    width:          112,
    height:         112,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   18,
  },
  pulseRing: {
    position:        "absolute",
    width:           112,
    height:          112,
    borderRadius:    56,
    backgroundColor: kit.color.accent,
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
    marginBottom: 14,
  },
  orderIdPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      999,
  },
  orderIdPillPressed: {
    opacity: 0.75,
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
    marginTop:  22,
    gap:        6,
  },
  totalAmount: {
    fontFamily:         theme.fonts.black,
    fontSize:           40,
    lineHeight:         48,
    color:              kit.color.ink,
    letterSpacing:      -1.5,
    includeFontPadding: false,
  },
  etaPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    marginTop:         2,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.line,
    paddingHorizontal: 10,
    paddingVertical:   5,
    borderRadius:      999,
  },
  etaText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10.5,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Timeline card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor:   kit.color.surface,
    borderRadius:      18,
    padding:           16,
    marginTop:         22,
    alignSelf:         "stretch",
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  cardTitle: {
    fontFamily:   theme.fonts.black,
    fontSize:     12,
    color:        kit.color.inkFaint,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  timelineRow: {
    alignItems: "flex-start",
    gap:        12,
  },
  timelineTrack: {
    alignItems: "center",
    width:      30,
  },
  timelineDot: {
    width:          30,
    height:         30,
    borderRadius:   15,
    alignItems:     "center",
    justifyContent: "center",
  },
  timelineDotDone: {
    backgroundColor: kit.color.accent,
  },
  timelineDotCurrent: {
    backgroundColor: kit.color.accentTint,
    borderWidth:     1.5,
    borderColor:     kit.color.accent,
  },
  timelineDotPending: {
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.lineStrong,
  },
  timelineLine: {
    width:           2,
    height:          22,
    marginTop:       2,
    backgroundColor: kit.color.lineStrong,
    borderRadius:    1,
  },
  timelineLineDone: {
    backgroundColor: kit.color.accent,
  },
  timelineText: {
    flex:            1,
    fontSize:        13,
    paddingTop:      6,
  },
  currentBadge: {
    backgroundColor:   kit.color.accentTint,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      999,
    marginTop:         4,
  },
  currentBadgeText: {
    fontSize:           9,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },

  // ── Trust strip ────────────────────────────────────────────────────────────
  trustStrip: {
    alignItems:  "center",
    gap:         12,
    marginTop:   18,
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
    alignSelf: "stretch",
    gap:       10,
  },
});
