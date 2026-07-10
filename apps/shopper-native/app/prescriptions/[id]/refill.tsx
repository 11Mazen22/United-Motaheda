/**
 * Refill flow — request a refill for an existing prescription.
 *
 * Two-step UX:
 *   1. Select delivery option (same-day / standard / pickup at branch)
 *   2. Review summary + confirm → optimistic write, navigate to detail
 *
 * Data: useRequestRefill (mutation) + usePrescription + useDeliveryContext.
 * Real flow — no longer a ComingSoon placeholder.
 */

import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { kit, Button } from "@/shared/kit";
import { Text } from "@/shared/ui";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useAuth } from "@/features/auth";
import { useDeliveryContext } from "@/features/delivery";
import { usePrescription, useRequestRefill } from "@/features/prescriptions";
import type { RefillDelivery } from "@/stores/prescriptionsStore";

function branchDisplayName(
  branch: { nameAr: string; nameEn: string } | null | undefined,
  lang:   string,
): string | undefined {
  if (!branch) return undefined;
  return lang === "en" ? (branch.nameEn || branch.nameAr) : (branch.nameAr || branch.nameEn);
}

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface DeliveryOption {
  key:    RefillDelivery;
  icon:   IoniconsName;
  title:  string;
  eta:    string;
  tone:   string;
  toneBg: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Screen
// ═══════════════════════════════════════════════════════════════════════════════

export default function RefillPage(): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { id }      = useLocalSearchParams<{ id: string }>();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const rx          = usePrescription(id);
  const delivery    = useDeliveryContext();
  const { requestRefill, isPending } = useRequestRefill(user?.id);

  const [selected, setSelected] = useState<RefillDelivery>("standard");
  const [ctaHeight, setCtaHeight] = useState(110);

  const DELIVERY_OPTIONS: DeliveryOption[] = useMemo(() => [
    {
      key:    "same_day",
      icon:   "flash-outline",
      title:  t("prescriptions.refillSameDay"),
      eta:    t("prescriptions.refillSameDayEta"),
      tone:   kit.color.warn,
      toneBg: kit.color.warnTint,
    },
    {
      key:    "standard",
      icon:   "bicycle-outline",
      title:  t("prescriptions.refillStandard"),
      eta:    t("prescriptions.refillStandardEta"),
      tone:   kit.color.accentDeep,
      toneBg: kit.color.accentTint,
    },
    {
      key:    "pickup",
      icon:   "storefront-outline",
      title:  t("prescriptions.refillPickup"),
      eta:    t("prescriptions.refillPickupEta"),
      tone:   kit.color.success,
      toneBg: kit.color.successTint,
    },
  ], [t]);

  const selectedOption = useMemo(
    () => DELIVERY_OPTIONS.find((o) => o.key === selected) ?? DELIVERY_OPTIONS[1],
    [DELIVERY_OPTIONS, selected],
  );

  const handleConfirm = useCallback(async () => {
    if (!rx) return;
    const pharmacyId = delivery.branch?.id ?? "primary";
    try {
      await requestRefill({
        prescriptionId: rx.id,
        delivery:       selected,
        pharmacyId,
      });
      router.replace(`/prescriptions/${rx.id}` as never);
    } catch {
      // useRequestRefill already rolls back the optimistic write.
    }
  }, [rx, delivery.branch?.id, requestRefill, selected, router]);

  // ── Not-found guard ────────────────────────────────────────────────────────
  if (!rx) {
    return (
      <View style={s.screen}>
        <Header insets={insets} onBack={() => router.back()} />
        <View style={s.centered}>
          <View style={s.notFoundIcon}>
            <Ionicons name="medkit-outline" size={36} color={kit.color.inkFaint} />
          </View>
          <Text weight="black" style={s.notFoundTitle}>
            {t("prescriptions.notFound")}
          </Text>
          <Text style={s.notFoundBody}>
            {t("prescriptions.notFoundSub")}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header insets={insets} onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding:       20,
          paddingBottom: ctaHeight + 20,
          gap:           18,
        }}
        showsVerticalScrollIndicator={false}>

        {/* ── Rx summary card ──────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(280)} style={s.rxCard}>
          <View style={[s.rxTile, { backgroundColor: kit.color.accentTint }]}>
            <Ionicons name="medkit" size={26} color={kit.color.accentDeep} />
          </View>
          <View style={s.rxText}>
            <Text weight="bold" style={s.rxEyebrow}>
              {t("prescriptions.refillFor")}
            </Text>
            <Text weight="black" style={s.rxName} numberOfLines={2}>
              {rx.name}
            </Text>
            <Text weight="semibold" style={s.rxDose} numberOfLines={1}>
              {rx.dose}
            </Text>
          </View>
        </Animated.View>

        {/* ── Delivery options ─────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(280)} style={{ gap: 10 }}>
          <Text weight="black" style={s.sectionLabel}>
            {t("prescriptions.refillDeliveryLabel")}
          </Text>

          {DELIVERY_OPTIONS.map((opt) => (
            <DeliveryOptionCard
              key={opt.key}
              option={opt}
              selected={selected === opt.key}
              onSelect={() => setSelected(opt.key)}
            />
          ))}
        </Animated.View>

        {/* ── Pickup branch summary ───────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(280)} style={s.summaryCard}>
          <View style={s.summaryRow}>
            <View style={[s.summaryIconWell, { backgroundColor: kit.color.well }]}>
              <Ionicons name="location-outline" size={16} color={kit.color.inkSoft} />
            </View>
            <View style={s.summaryText}>
              <Text weight="bold" style={s.summaryLabel}>
                {t("prescriptions.refillFromBranch")}
              </Text>
              <Text weight="black" style={s.summaryValue} numberOfLines={1}>
                {branchDisplayName(delivery.branch, i18n.language) ?? t("prescriptions.refillNearestBranch")}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Trust note ──────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(280)} style={s.trustCard}>
          <View style={s.trustHead}>
            <View style={s.trustIconWell}>
              <Ionicons name="shield-checkmark" size={14} color={kit.color.accentDeep} />
            </View>
            <Text weight="black" style={s.trustTitle}>
              {t("prescriptions.refillTrustTitle")}
            </Text>
          </View>
          <Text style={s.trustBody}>
            {t("prescriptions.refillTrustBody")}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* ── Sticky confirm CTA ──────────────────────────────────────── */}
      <View
        onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)}
        style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <View style={s.ctaEyebrowRow}>
          <Text weight="bold" style={s.ctaEyebrow}>
            {t("prescriptions.refillSelected")}
          </Text>
          <View style={[s.ctaPill, { backgroundColor: selectedOption.toneBg }]}>
            <Ionicons name={selectedOption.icon} size={11} color={selectedOption.tone} />
            <Text weight="black" style={[s.ctaPillText, { color: selectedOption.tone }]}>
              {selectedOption.title}
            </Text>
          </View>
        </View>
        <Button
          variant="primary"
          full
          icon="checkmark"
          loading={isPending}
          disabled={isPending}
          label={t("prescriptions.refillConfirmCta")}
          onPress={handleConfirm}
        />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DeliveryOptionCard
// ═══════════════════════════════════════════════════════════════════════════════

interface DeliveryOptionCardProps {
  option:   DeliveryOption;
  selected: boolean;
  onSelect: () => void;
}

function DeliveryOptionCard({
  option, selected, onSelect,
}: DeliveryOptionCardProps): React.ReactElement {
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={option.title}
      style={({ pressed }) => [
        s.optionCard,
        selected && [s.optionCardSelected, { borderColor: option.tone }],
        pressed && s.optionCardPressed,
      ]}>
      <View style={[s.optionIconWell, { backgroundColor: option.toneBg }]}>
        <Ionicons name={option.icon} size={22} color={option.tone} />
      </View>
      <View style={s.optionText}>
        <Text weight="black" style={s.optionTitle} numberOfLines={1}>
          {option.title}
        </Text>
        <Text weight="bold" style={s.optionEta} numberOfLines={1}>
          {option.eta}
        </Text>
      </View>
      <View style={[s.radio, selected && { borderColor: option.tone, borderWidth: 6 }]} />
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════════════════════

function Header({ insets, onBack }: { insets: { top: number }; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <View style={s.headerRow}>
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
          <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <View style={s.identityRow}>
        <View style={s.heroTile}>
          <Ionicons name="refresh" size={22} color={kit.color.accentDeep} />
        </View>
        <View style={s.identityText}>
          <Text weight="bold" style={s.eyebrow}>
            {t("prescriptions.refillEyebrow")}
          </Text>
          <Text weight="black" style={s.title}>
            {t("prescriptions.refillRequestTitle")}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  headerRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    minHeight:     38,
  },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    14,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: {
    opacity:   0.7,
    transform: [{ scale: 0.96 }],
  },
  identityRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
  },
  heroTile: {
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  identityText: {
    flex: 1,
    gap:  2,
  },
  eyebrow: {
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.6,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontSize:           26,
    lineHeight:         32,
    color:              kit.color.ink,
    letterSpacing:      -0.5,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Rx summary card ────────────────────────────────────────────────────
  rxCard: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    padding:           18,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.xl,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  rxTile: {
    width:          60,
    height:         60,
    borderRadius:   20,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  rxText: {
    flex: 1,
    gap:  3,
  },
  rxEyebrow: {
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  rxName: {
    fontSize:           18,
    lineHeight:         24,
    color:              kit.color.ink,
    letterSpacing:      -0.3,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  rxDose: {
    fontSize:           13,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Section label ──────────────────────────────────────────────────────
  sectionLabel: {
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Delivery option cards ──────────────────────────────────────────────
  optionCard: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 16,
    paddingVertical:   14,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1.5,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  optionCardSelected: {
    borderWidth:     2,
    backgroundColor: "#FAFEFD",
  },
  optionCardPressed: {
    opacity:   0.92,
    transform: [{ scale: 0.99 }],
  },
  optionIconWell: {
    width:          48,
    height:         48,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  optionText: {
    flex: 1,
    gap:  3,
  },
  optionTitle: {
    fontSize:           15,
    lineHeight:         20,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  optionEta: {
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  radio: {
    width:        22,
    height:       22,
    borderRadius: 11,
    borderWidth:  1.5,
    borderColor:  kit.color.lineStrong,
    flexShrink:   0,
  },

  // ── Branch summary card ───────────────────────────────────────────────
  summaryCard: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    padding:         14,
  },
  summaryRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           12,
  },
  summaryIconWell: {
    width:          36,
    height:         36,
    borderRadius:   12,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  summaryText: {
    flex: 1,
    gap:  2,
  },
  summaryLabel: {
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    letterSpacing:      0.4,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  summaryValue: {
    fontSize:           14,
    lineHeight:         19,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Trust card ────────────────────────────────────────────────────────
  trustCard: {
    backgroundColor: kit.color.accentTint,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     "rgba(14,126,116,0.18)",
    padding:         14,
    gap:             8,
  },
  trustHead: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           10,
  },
  trustIconWell: {
    width:           30,
    height:          30,
    borderRadius:    10,
    backgroundColor: "rgba(14,126,116,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
  },
  trustTitle: {
    fontSize:           12,
    lineHeight:         16,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  trustBody: {
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Sticky CTA bar ────────────────────────────────────────────────────
  ctaBar: {
    position:          "absolute",
    start:             0,
    end:               0,
    bottom:            0,
    paddingHorizontal: 20,
    paddingTop:        14,
    gap:               10,
    backgroundColor:   kit.color.surface,
    borderTopWidth:    StyleSheet.hairlineWidth,
    borderTopColor:    kit.color.line,
  },
  ctaEyebrowRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           10,
  },
  ctaEyebrow: {
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.inkFaint,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  ctaPill: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      kit.radius.pill,
  },
  ctaPillText: {
    fontSize:           11,
    lineHeight:         15,
    letterSpacing:      0.3,
    includeFontPadding: false,
  },

  // ── Not-found state ──────────────────────────────────────────────────
  centered: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: 32,
    gap:               12,
  },
  notFoundIcon: {
    width:           84,
    height:          84,
    borderRadius:    28,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  notFoundTitle: {
    fontSize:           19,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.3,
    textAlign:          "center",
    includeFontPadding: false,
  },
  notFoundBody: {
    fontSize:           14,
    lineHeight:         21,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    maxWidth:           320,
    includeFontPadding: false,
  },
});
