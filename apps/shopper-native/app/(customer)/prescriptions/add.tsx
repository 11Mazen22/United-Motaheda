import { defaultTheme as theme } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";

import React, { useMemo } from "react";

import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useRouter } from "expo-router";

import { useTranslation } from "react-i18next";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CustomerUI } from "@pharmacy/ui-native";

import { Text } from "@pharmacy/ui-native";

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
  onPress:     () => void;
}



const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);



function EntryCard({ option }: { option: EntryOption }): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(), []);

  return (
    <Pressable
      onPress={option.onPress}
      accessibilityRole="button"
      accessibilityLabel={option.title}
      style={s.cardOuter}>
      {({ pressed }) => (
        <View style={[s.card, pressed && s.cardPressed]}>
          <View style={[s.iconTile, { backgroundColor: option.bg }]}>
            <Ionicons name={option.icon} size={24} color={option.tint} />
          </View>
          <View style={s.cardBody}>
            <Text weight="black" style={s.cardTitle} numberOfLines={1}>
              {option.title}
            </Text>
            <Text style={s.cardDesc} numberOfLines={2}>
              {option.description}
            </Text>
          </View>
          <View style={s.chevronWell}>
            <Ionicons name={FORWARD_CHEVRON} size={16} color={theme.colors.text.secondary} />
          </View>
        </View>
      )}
    </Pressable>
  );
}


export default function Page(): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(), []);
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();

  const options: EntryOption[] = useMemo(() => [
    {
      key:         "scan",
      icon:        "scan-outline",
      tint:        theme.colors.brand.primary,
      bg:          theme.colors.brand.primaryLight,
      title:       t("prescriptions.scan"),
      description: t("prescriptions.addScanDesc"),
      onPress:     () => router.push("/prescriptions/scan" as never),
    },
    {
      key:         "manual",
      icon:        "keypad-outline",
      tint:        theme.colors.status.warning,
      bg:          `${theme.colors.status.warning}1A`,
      title:       t("prescriptions.manual"),
      description: t("prescriptions.addManualDesc"),
      onPress:     () => router.push("/prescriptions/manual" as never),
    },
    {
      key:         "transfer",
      icon:        "swap-horizontal-outline",
      tint:        "#7C3AED",
      bg:          "#F5F3FF",
      title:       t("prescriptions.transfer"),
      description: t("prescriptions.addTransferDesc"),
      onPress:     () => router.push("/prescriptions/transfer" as never),
    },
  ], [router, t, theme.colors.brand.primary, theme.colors.brand.primaryLight, theme.colors.status.warning, `${theme.colors.status.warning}1A`]);

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.navRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            style={s.backBtnTouchable}>
            {({ pressed }) => (
              <View style={[s.backBtn, pressed && s.backBtnPressed]}>
                <Ionicons name={BACK_CHEVRON} size={20} color={theme.colors.text.primary} />
              </View>
            )}
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <View style={s.identityRow}>
          <View style={s.heroTile}>
            <Ionicons name="add-circle-outline" size={24} color={theme.colors.brand.primary} />
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

        <CustomerUI.Notice
          variant="warning"
          icon={<Ionicons name="shield-checkmark-outline" size={18} color={theme.colors.status.warning} />}
          message={t("prescriptions.controlledBody")}
        />
      </ScrollView>
    </View>
  );
}



function get_s() { return StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: theme.colors.canvas.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom:     20,
    gap:               18,
    backgroundColor:   theme.colors.canvas.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border.default,
    ...theme.shadows[1],
  },
  navRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    minHeight:     38,
  },
  backBtnTouchable: { borderRadius: 14 },
  backBtn: {
    width:           38,
    height:          38,
    borderRadius:    14,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  identityRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           14,
  },
  heroTile: {
    width:           56,
    height:          56,
    borderRadius:    18,
    backgroundColor: theme.colors.brand.primaryLight,
    borderWidth:     1,
    borderColor:     theme.colors.border.default,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  identityText: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize:           10,
    lineHeight:         14,
    color:              theme.colors.brand.primary,
    letterSpacing:      0.6,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  title: {
    fontSize:           28,
    lineHeight:         34,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.6,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  sectionLabel: {
    fontSize:           11,
    lineHeight:         16,
    color:              theme.colors.text.muted,
    letterSpacing:      0.5,
    textTransform:      "uppercase",
    textAlign:          TEXT_START,
    marginBottom:       4,
    includeFontPadding: false,
  },
  cardOuter: { borderRadius: 12 },
  card: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               14,
    paddingHorizontal: 16,
    paddingVertical:   16,
    backgroundColor:   theme.colors.canvas.surface,
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       theme.colors.border.default,
    ...theme.shadows[1],
  },
  cardPressed: {
    opacity:    0.92,
    backgroundColor: theme.colors.canvas.surfaceMuted,
    transform:  [{ scale: 0.99 }],
  },
  iconTile: {
    width:         52,
    height:        52,
    borderRadius:  16,
    alignItems:    "center",
    justifyContent: "center",
    flexShrink:    0,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: {
    fontSize:           15,
    lineHeight:         21,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  cardDesc: {
    fontSize:           12,
    lineHeight:         18,
    color:              theme.colors.text.secondary,
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
}); }
