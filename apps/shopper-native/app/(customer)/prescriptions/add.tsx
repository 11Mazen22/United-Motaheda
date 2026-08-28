import { useTheme, type NativeTheme } from "@pharmacy/ui-native";
import React, { useCallback, useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { CustomerUI } from "@pharmacy/ui-native";
import { Text } from "@pharmacy/ui-native";
import {
  flexRow,
  isRtl,
  textAlignStart,
  FORWARD_CHEVRON,
} from "@/utils/layout";
import { useAuth } from "@/features/auth";
import { createWhatsAppPrescriptionPlaceholder } from "@/features/prescriptions";
import { PrescriptionsHeader } from "@/features/prescriptions/components/PrescriptionsHeader";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface EntryOption {
  key:         string;
  icon:        IoniconsName;
  tint:        string;
  bg:          string;
  title:       string;
  description: string;
  badge?:      string;
  onPress:     () => void;
}

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const WHATSAPP_RX_URL =
  `https://wa.me/201112343212?text=${encodeURIComponent("مرحباً، أريد إضافة وصفة طبية إلى حسابي.")}`;

function EntryCard({ option, index }: { option: EntryOption; index: number }): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);

  return (
    <Animated.View entering={FadeInDown.duration(340).delay(Math.min(index, 6) * 45).springify()}>
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
              <View style={s.cardTitleRow}>
                <Text weight="black" style={s.cardTitle} numberOfLines={1}>
                  {option.title}
                </Text>
                {option.badge && (
                  <View style={s.badge}>
                    <Text weight="black" style={s.badgeText} numberOfLines={1}>{option.badge}</Text>
                  </View>
                )}
              </View>
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
    </Animated.View>
  );
}


export default function Page(): React.ReactElement {
  const { theme } = useTheme();
  const s = React.useMemo(() => get_s(theme), [theme]);
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const { t }    = useTranslation();
  const { user } = useAuth();

  // Best-effort staff-visibility record for the WhatsApp path — the actual
  // submission is still a human WhatsApp conversation, this just means it no
  // longer silently disappears from the admin queue's view. Never blocks
  // opening WhatsApp: if the write fails, the customer's flow still works.
  const handleWhatsApp = useCallback(() => {
    if (user?.id) {
      createWhatsAppPrescriptionPlaceholder(user.id, t("prescriptions.whatsappPlaceholderName"))
        .catch(() => {});
    }
    void Linking.openURL(WHATSAPP_RX_URL).catch(() => {});
  }, [user?.id, t]);

  const options: EntryOption[] = useMemo(() => [
    {
      key:         "whatsapp",
      icon:        "logo-whatsapp",
      tint:        "#16A34A",
      bg:          "#DCFCE7",
      title:       t("prescriptions.addWhatsAppTitle"),
      description: t("prescriptions.addWhatsAppDesc"),
      onPress:     handleWhatsApp,
    },
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
  ], [router, t, handleWhatsApp, theme.colors.brand.primary, theme.colors.brand.primaryLight, theme.colors.status.warning]);

  return (
    <View style={s.screen}>
      <PrescriptionsHeader
        insetsTop={insets.top}
        icon="add-circle-outline"
        eyebrow={t("prescriptions.headerEyebrow")}
        title={t("prescriptions.addTitle")}
        onBack={() => router.back()}
      />

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

        {options.map((opt, i) => (
          <EntryCard key={opt.key} option={opt} index={i} />
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



function get_s(theme: NativeTheme) { return StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: theme.colors.canvas.background,
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
  cardBody: { flex: 1, gap: 4, minWidth: 0 },
  cardTitleRow: {
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           8,
  },
  cardTitle: {
    flex:               1,
    minWidth:           0,
    fontSize:           15,
    lineHeight:         21,
    color:              theme.colors.text.primary,
    letterSpacing:      -0.2,
    textAlign:          TEXT_START,
    includeFontPadding: false,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical:   3,
    borderRadius:      9999,
    backgroundColor:   theme.colors.brand.primaryLight,
    borderWidth:       StyleSheet.hairlineWidth,
    borderColor:       theme.colors.brand.primary,
    flexShrink:        0,
  },
  badgeText: {
    fontSize:           9,
    lineHeight:         13,
    letterSpacing:      0.5,
    color:              theme.colors.brand.primary,
    textTransform:      "uppercase",
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
