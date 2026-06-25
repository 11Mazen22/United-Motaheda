/**
 * AddRxEntry — entry-point for adding a new prescription.
 *
 * Redesign (2026 visual pass):
 *   • Premium list cards with deeper padding (18/16/14), centered icon
 *     tiles in a 56pt accent well, 13pt subtitle line-clamped to two lines.
 *   • Unified "coming soon" pill — warn-tinted, hairline border, micro-cap
 *     typography (10pt black, +0.6 tracking) so it reads as a system label
 *     rather than a sticker.
 *   • Controlled-substance callout becomes a structured card with an
 *     eyebrow + body + amber shield well; the icon never floats next to a
 *     wall of text.
 *   • Strict RTL via flexRow / textAlignStart everywhere — no hardcoded
 *     `textAlign: "right"`. Chevrons use FORWARD_CHEVRON, back arrow uses
 *     BACK_CHEVRON; both flip on I18nManager.isRTL.
 */

import React, { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kit } from "@/shared/kit";
import { Text } from "@/shared/ui";
import {
  flexRow,
  isRtl,
  textAlignStart,
  FORWARD_CHEVRON,
  BACK_CHEVRON,
} from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface EntryOption {
  key:         string;
  icon:        IoniconsName;
  tint:        string;
  bg:          string;
  title:       string;
  description: string;
  comingSoon?: boolean;
  onPress:     () => void;
}

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

// ─── EntryCard ────────────────────────────────────────────────────────────────

function EntryCard({ option }: { option: EntryOption }): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={option.onPress}
      accessibilityRole="button"
      accessibilityLabel={option.title}
      accessibilityState={{ disabled: option.comingSoon }}
      style={({ pressed }) => [
        s.card,
        pressed && s.cardPressed,
        option.comingSoon && s.cardMuted,
      ]}>

      {/* Icon tile — flush with the card's start edge */}
      <View style={[s.iconTile, { backgroundColor: option.bg }]}>
        <Ionicons name={option.icon} size={24} color={option.tint} />
      </View>

      {/* Center column: title + coming-soon pill + description */}
      <View style={s.cardBody}>
        <View style={s.cardTitleRow}>
          <Text weight="black" style={s.cardTitle} numberOfLines={1}>
            {option.title}
          </Text>
          {option.comingSoon && (
            <View style={s.comingSoonBadge}>
              <Text weight="black" style={s.comingSoonText}>
                {t("prescriptions.comingSoon")}
              </Text>
            </View>
          )}
        </View>
        <Text style={s.cardDesc} numberOfLines={2}>
          {option.description}
        </Text>
      </View>

      {/* Trailing chevron — flips via FORWARD_CHEVRON on RTL */}
      <View style={s.chevronWell}>
        <Ionicons
          name={FORWARD_CHEVRON}
          size={16}
          color={option.comingSoon ? kit.color.inkFaint : kit.color.inkSoft}
        />
      </View>
    </Pressable>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WHATSAPP_RX_URL =
  `https://wa.me/201112343212?text=${encodeURIComponent("مرحباً، أريد إضافة وصفة طبية إلى حسابي.")}`;

// ─── Screen ───────────────────────────────────────────────────────────────────

export function AddRxEntry(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const options: EntryOption[] = useMemo(() => [
    {
      key:         "whatsapp",
      icon:        "logo-whatsapp",
      tint:        "#16A34A",
      bg:          "#DCFCE7",
      title:       t("prescriptions.addWhatsAppTitle"),
      description: t("prescriptions.addWhatsAppDesc"),
      onPress:     () => { void Linking.openURL(WHATSAPP_RX_URL).catch(() => {}); },
    },
    {
      key:         "manual",
      icon:        "keypad-outline",
      tint:        kit.color.warn,
      bg:          kit.color.warnTint,
      title:       t("prescriptions.addManualTitle"),
      description: t("prescriptions.addManualDesc"),
      onPress:     () => router.push("/prescriptions/manual" as never),
    },
    {
      key:         "scan",
      icon:        "scan-outline",
      tint:        kit.color.accentDeep,
      bg:          kit.color.accentTint,
      title:       t("prescriptions.addScanTitle"),
      description: t("prescriptions.addScanDesc"),
      comingSoon:  true,
      onPress:     () => router.push("/prescriptions/scan" as never),
    },
    {
      key:         "transfer",
      icon:        "swap-horizontal-outline",
      tint:        "#7C3AED",
      bg:          "#F5F3FF",
      title:       t("prescriptions.addTransferTitle"),
      description: t("prescriptions.addTransferDesc"),
      comingSoon:  true,
      onPress:     () => router.push("/prescriptions/transfer" as never),
    },
  ], [router, t]);

  return (
    <View style={s.screen}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.navRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}>
            <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
          </Pressable>

          {/* Spacer keeps the back button hugging the start edge */}
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.identityRow}>
          <View style={s.heroTile}>
            <Ionicons name="add-circle-outline" size={24} color={kit.color.accentDeep} />
          </View>
          <View style={s.identityText}>
            <Text weight="bold" style={s.eyebrow}>
              {t("prescriptions.headerEyebrow")}
            </Text>
            <Text weight="black" style={s.title}>
              {t("prescriptions.addTitle")}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop:        20,
          paddingBottom:     insets.bottom + 32,
          gap:               12,
        }}
        showsVerticalScrollIndicator={false}>

        <Text weight="bold" style={s.sectionLabel}>
          {t("prescriptions.chooseMethod")}
        </Text>

        {options.map((opt) => (
          <EntryCard key={opt.key} option={opt} />
        ))}

        {/* Controlled-substance callout */}
        <View style={s.infoCallout}>
          <View style={s.infoHead}>
            <View style={s.infoIconWell}>
              <Ionicons name="shield-checkmark-outline" size={18} color={kit.color.warn} />
            </View>
            <Text weight="bold" style={s.infoEyebrow} numberOfLines={1}>
              {t("prescriptions.controlledEyebrow")}
            </Text>
          </View>
          <Text style={s.infoText}>
            {t("prescriptions.controlledBody")}
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_PAD_H   = 16;
const CARD_PAD_V   = 16;
const ICON_TILE    = 52;
const BADGE_RADIUS = 999;

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    minHeight:     36,
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
    textAlign:          TEXT_START,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },
  title: {
    fontSize:           28,
    lineHeight:         34,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },

  // ── Section label ───────────────────────────────────────────────────────
  sectionLabel: {
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    marginBottom:       4,
    includeFontPadding: false,
  },

  // ── Entry card ──────────────────────────────────────────────────────────
  card: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: CARD_PAD_H,
    paddingVertical:   CARD_PAD_V,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  cardPressed: {
    opacity:         0.92,
    backgroundColor: kit.color.well,
    transform:       [{ scale: 0.99 }],
  },
  cardMuted: {
    opacity: 0.74,
  },
  iconTile: {
    width:          ICON_TILE,
    height:         ICON_TILE,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },
  cardBody: {
    flex: 1,
    gap:  4,
  },
  cardTitleRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  cardTitle: {
    flex:               1,
    fontSize:           15,
    lineHeight:         21,
    color:              kit.color.ink,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  cardDesc: {
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  chevronWell: {
    width:          24,
    height:         24,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  // ── Unified "coming soon" pill ──────────────────────────────────────────
  comingSoonBadge: {
    paddingHorizontal: 10,
    paddingVertical:   3,
    borderRadius:      BADGE_RADIUS,
    backgroundColor:   kit.color.warnTint,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       kit.color.warn,
    flexShrink:        0,
  },
  comingSoonText: {
    fontSize:           10,
    lineHeight:         14,
    letterSpacing:      0.6,
    color:              kit.color.warn,
    textTransform:      "uppercase",
    includeFontPadding: false,
  },

  // ── Info callout (controlled medicines) ─────────────────────────────────
  infoCallout: {
    marginTop:       12,
    padding:         16,
    gap:             10,
    backgroundColor: kit.color.warnTint,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     "rgba(245,158,11,0.32)",
  },
  infoHead: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           10,
  },
  infoIconWell: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: "rgba(245,158,11,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  infoEyebrow: {
    flex:               1,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.warn,
    letterSpacing:      0.3,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  infoText: {
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
});
