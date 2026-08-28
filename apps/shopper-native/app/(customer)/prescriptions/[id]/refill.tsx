import { useTheme, type NativeTheme } from "@pharmacy/ui-native";
/**
 * Refill flow — quick request for an existing prescription.
 * Confirm quantity + delivery method, then submit via useRequestRefill.
 */

import React, { useCallback, useMemo, useState } from "react";

import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useLocalSearchParams, useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import Animated, { FadeInDown } from "react-native-reanimated";

import { CustomerUI } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { useAuth } from "@/features/auth";

import { useDeliveryContext } from "@/features/delivery";

import { usePrescription, useRequestRefill } from "@/features/prescriptions";

import { PrescriptionsHeader } from "@/features/prescriptions/components/PrescriptionsHeader";

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



export default function RefillPage(): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
  const { t, i18n } = useTranslation();

  const { id }      = useLocalSearchParams<{ id: string }>();
  const router      = useRouter();
  const insets      = useSafeAreaInsets();
  const { user }    = useAuth();
  const rx          = usePrescription(id);
  const delivery    = useDeliveryContext();
  const { requestRefill, isPending } = useRequestRefill(user?.id);

  const [selected, setSelected] = useState<RefillDelivery>("standard");
  const [quantity, setQuantity] = useState(1);
  const [ctaHeight, setCtaHeight] = useState(110);

  const DELIVERY_OPTIONS: DeliveryOption[] = useMemo(() => [
    { key: "same_day", icon: "flash-outline",     title: t("prescriptions.refillSameDay"),   eta: t("prescriptions.refillSameDayEta"),   tone: theme.colors.status.warning,       toneBg: `${theme.colors.status.warning}1A` },
    { key: "standard",  icon: "bicycle-outline",  title: t("prescriptions.refillStandard"),  eta: t("prescriptions.refillStandardEta"),  tone: theme.colors.brand.primary,  toneBg: theme.colors.brand.primaryLight },
    { key: "pickup",    icon: "storefront-outline", title: t("prescriptions.refillPickup"),   eta: t("prescriptions.refillPickupEta"),   tone: theme.colors.status.success,    toneBg: `${theme.colors.status.success}1A` },
  ], [t, theme.colors.brand.primary, theme.colors.brand.primaryLight, theme.colors.status.success, `${theme.colors.status.success}1A`, theme.colors.status.warning, `${theme.colors.status.warning}1A`]);

  const selectedOption = DELIVERY_OPTIONS.find((o) => o.key === selected) ?? DELIVERY_OPTIONS[1];

  const handleConfirm = useCallback(async () => {
    if (!rx) return;
    const pharmacyId = delivery.branch?.id ?? "primary";
    try {
      await requestRefill({ prescriptionId: rx.id, delivery: selected, pharmacyId });
      router.replace(`/prescriptions/${rx.id}` as never);
    } catch {
      // useRequestRefill already rolls back the optimistic write.
    }
  }, [rx, delivery.branch?.id, requestRefill, selected, router]);

  if (!rx) {
    return (
      <View style={s.screen}>
        <Header insets={insets} onBack={() => router.back()} />
        <View style={s.centered}>
          <View style={s.notFoundIcon}>
            <Ionicons name="medkit-outline" size={36} color={theme.colors.text.muted} />
          </View>
          <Text weight="black" style={s.notFoundTitle}>{t("prescriptions.notFound")}</Text>
          <Text style={s.notFoundBody}>{t("prescriptions.notFoundSub")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header insets={insets} onBack={() => router.back()} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: ctaHeight + 20, gap: 18 }}
        showsVerticalScrollIndicator={false}>

        <View style={s.rxCard}>
          <View style={[s.rxTile, { backgroundColor: theme.colors.brand.primaryLight }]}>
            <Ionicons name="medkit" size={26} color={theme.colors.brand.primary} />
          </View>
          <View style={s.rxText}>
            <Text weight="bold" style={s.rxEyebrow}>{t("prescriptions.refillFor")}</Text>
            <Text weight="black" style={s.rxName} numberOfLines={2}>{rx.name}</Text>
            <Text weight="semibold" style={s.rxDose} numberOfLines={1}>{rx.dose}</Text>
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text weight="black" style={s.sectionLabel}>{t("prescriptions.refillDeliveryLabel")}</Text>
          {DELIVERY_OPTIONS.map((opt, i) => (
            <Animated.View key={opt.key} entering={FadeInDown.duration(320).delay(i * 60).springify()}>
              <DeliveryOptionCard
                option={opt}
                selected={selected === opt.key}
                onSelect={() => setSelected(opt.key)}
              />
            </Animated.View>
          ))}
        </View>

        <View style={s.qtyCard}>
          <View style={s.qtyText}>
            <Text weight="black" style={s.qtyLabel}>{t("prescriptions.refillQuantityLabel")}</Text>
            <Text style={s.qtyHelp}>{t("prescriptions.refillQuantityHelp")}</Text>
          </View>
          <View style={s.stepper}>
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              accessibilityLabel={t("prescriptions.refillQtyDec")}
              accessibilityRole="button"
              style={s.stepBtn}>
              <Ionicons name="remove-outline" size={20} color={theme.colors.text.primary} />
            </Pressable>
            <Text weight="black" style={s.qtyValue}>{quantity}</Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(99, q + 1))}
              accessibilityLabel={t("prescriptions.refillQtyInc")}
              accessibilityRole="button"
              style={s.stepBtn}>
              <Ionicons name="add-outline" size={20} color={theme.colors.text.primary} />
            </Pressable>
          </View>
        </View>

        <View style={s.summaryCard}>
          <View style={s.summaryRow}>
            <View style={[s.summaryIconWell, { backgroundColor: theme.colors.canvas.surfaceMuted }]}>
              <Ionicons name="location-outline" size={16} color={theme.colors.text.secondary} />
            </View>
            <View style={s.summaryText}>
              <Text weight="bold" style={s.summaryLabel}>{t("prescriptions.refillFromBranch")}</Text>
              <Text weight="black" style={s.summaryValue} numberOfLines={1}>
                {branchDisplayName(delivery.branch, i18n.language) ?? t("prescriptions.refillNearestBranch")}
              </Text>
            </View>
          </View>
        </View>

        <CustomerUI.Notice
          variant="success"
          title={t("prescriptions.refillTrustTitle")}
          message={t("prescriptions.refillTrustBody")}
        />
      </ScrollView>

      <View
        onLayout={(e) => setCtaHeight(e.nativeEvent.layout.height)}
        style={[s.ctaBar, { paddingBottom: Math.max(insets.bottom, 8) + 4 }]}>
        <View style={s.ctaEyebrowRow}>
          <Text weight="bold" style={s.ctaEyebrow}>{t("prescriptions.refillSelected")}</Text>
          <View style={[s.ctaPill, { backgroundColor: selectedOption.toneBg }]}>
            <Ionicons name={selectedOption.icon} size={11} color={selectedOption.tone} />
            <Text weight="black" style={[s.ctaPillText, { color: selectedOption.tone }]}>
              {selectedOption.title}
            </Text>
          </View>
        </View>
        <CustomerUI.Button
          label={t("prescriptions.refillConfirmCta")}
          onPress={handleConfirm}
          loading={isPending}
          disabled={isPending}
          fullWidth
          icon={<Ionicons name="checkmark" size={18} color="#fff" />}
        />
      </View>
    </View>
  );
}



interface DeliveryOptionCardProps {
  option:   DeliveryOption;
  selected: boolean;
  onSelect: () => void;
}

function DeliveryOptionCard({ option, selected, onSelect }: DeliveryOptionCardProps): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
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
        <Text weight="black" style={s.optionTitle} numberOfLines={1}>{option.title}</Text>
        <Text weight="bold" style={s.optionEta} numberOfLines={1}>{option.eta}</Text>
      </View>
      <View style={[s.radio, selected && { borderColor: option.tone, borderWidth: 6 }]} />
    </Pressable>
  );
}



function Header({ insets, onBack }: { insets: { top: number }; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <PrescriptionsHeader
      insetsTop={insets.top}
      icon="refresh"
      eyebrow={t("prescriptions.refillEyebrow")}
      title={t("prescriptions.refillRequestTitle")}
      onBack={onBack}
    />
  );
}



function get_s(theme: NativeTheme) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },
  header: {
    paddingHorizontal: 20, paddingBottom: 20, gap: 18,
    backgroundColor: theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border.default,
    ...theme.shadows[1],
  },
  headerRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", minHeight: 38 },
  backBtn: {
    width: 38, height: 38, borderRadius: 14,
    backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center",
  },
  backBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  identityRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 14 },
  heroTile: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: theme.colors.brand.primaryLight, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  identityText: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 10, lineHeight: 14, color: theme.colors.brand.primary,
    letterSpacing: 0.6, textTransform: "uppercase",
    textAlign: TEXT_START, includeFontPadding: false,
  },
  title: {
    fontSize: 26, lineHeight: 32, color: theme.colors.text.primary,
    letterSpacing: -0.5, textAlign: TEXT_START, includeFontPadding: false,
  },
  rxCard: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 14,
    padding: 18, backgroundColor: theme.colors.canvas.surface,
    borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border.default,
    ...theme.shadows[1],
  },
  rxTile: { width: 60, height: 60, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  rxText: { flex: 1, gap: 3 },
  rxEyebrow: {
    fontSize: 10, lineHeight: 14, color: theme.colors.text.muted,
    letterSpacing: 0.5, textTransform: "uppercase",
    textAlign: TEXT_START, includeFontPadding: false,
  },
  rxName: {
    fontSize: 18, lineHeight: 24, color: theme.colors.text.primary,
    letterSpacing: -0.3, textAlign: TEXT_START, includeFontPadding: false,
  },
  rxDose: {
    fontSize: 13, lineHeight: 18, color: theme.colors.text.secondary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  sectionLabel: {
    fontSize: 11, lineHeight: 16, color: theme.colors.text.muted,
    letterSpacing: 0.5, textTransform: "uppercase",
    textAlign: TEXT_START, includeFontPadding: false,
  },
  optionCard: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: theme.colors.canvas.surface, borderRadius: 12,
    borderWidth: 1.5, borderColor: theme.colors.border.default, ...theme.shadows[1],
  },
  optionCardSelected: { borderWidth: 2, backgroundColor: "#FAFEFD" },
  optionCardPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  optionIconWell: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  optionText: { flex: 1, gap: 3 },
  optionTitle: {
    fontSize: 15, lineHeight: 20, color: theme.colors.text.primary,
    letterSpacing: -0.2, textAlign: TEXT_START, includeFontPadding: false,
  },
  optionEta: {
    fontSize: 12, lineHeight: 16, color: theme.colors.text.secondary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.colors.border.strong, flexShrink: 0 },
  qtyCard: {
    flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: theme.colors.canvas.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border.default,
  },
  qtyText: { flex: 1, gap: 2, justifyContent: "center" },
  qtyLabel: {
    fontSize: 15, lineHeight: 20, color: theme.colors.text.primary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  qtyHelp: {
    fontSize: 12, lineHeight: 16, color: theme.colors.text.secondary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  stepper: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center",
  },
  qtyValue: {
    fontSize: 20, lineHeight: 26, color: theme.colors.text.primary, minWidth: 28,
    textAlign: "center", includeFontPadding: false,
  },
  summaryCard: {
    backgroundColor: theme.colors.canvas.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border.default, padding: 14,
  },
  summaryRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 12 },
  summaryIconWell: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  summaryText: { flex: 1, gap: 2 },
  summaryLabel: {
    fontSize: 10, lineHeight: 14, color: theme.colors.text.muted,
    letterSpacing: 0.4, textTransform: "uppercase",
    textAlign: TEXT_START, includeFontPadding: false,
  },
  summaryValue: {
    fontSize: 14, lineHeight: 19, color: theme.colors.text.primary,
    textAlign: TEXT_START, includeFontPadding: false,
  },
  ctaBar: {
    position: "absolute", start: 0, end: 0, bottom: 0,
    paddingHorizontal: 20, paddingTop: 14, gap: 10,
    backgroundColor: theme.colors.canvas.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border.default,
  },
  ctaEyebrowRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10 },
  ctaEyebrow: {
    fontSize: 10, lineHeight: 14, color: theme.colors.text.muted,
    letterSpacing: 0.5, textTransform: "uppercase", includeFontPadding: false,
  },
  ctaPill: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  ctaPillText: { fontSize: 11, lineHeight: 15, letterSpacing: 0.3, includeFontPadding: false },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 },
  notFoundIcon: {
    width: 84, height: 84, borderRadius: 28,
    backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  notFoundTitle: {
    fontSize: 19, lineHeight: 26, color: theme.colors.text.primary,
    letterSpacing: -0.3, textAlign: "center", includeFontPadding: false,
  },
  notFoundBody: {
    fontSize: 14, lineHeight: 21, color: theme.colors.text.secondary,
    textAlign: "center", maxWidth: 320, includeFontPadding: false,
  },
}); }
