/**
 * AddRxEntry — entry-point for adding a new prescription. VIP 2026.
 *
 * Options stacked vertically (working paths first):
 *   1. Send via WhatsApp              → wa.me link (live operational channel)
 *   2. Enter the Rx number manually   → /prescriptions/manual
 *   3. Scan the label (camera)        → /prescriptions/scan   (coming soon)
 *   4. Transfer from another pharmacy → /prescriptions/transfer (coming soon)
 */

import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kit } from "@/shared/kit";
import { theme } from "@/shared/theme";
import { Text } from "@/shared/ui";
import { flexRow, isRtl, FORWARD_CHEVRON, BACK_CHEVRON } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface EntryOption {
  icon:        IoniconsName;
  tint:        string;
  bg:          string;
  title:       string;
  description: string;
  comingSoon?: boolean;
  onPress:     () => void;
}

const IS_RTL = isRtl();

function EntryCard({ option }: { option: EntryOption }): React.ReactElement {
  return (
    <Pressable
      onPress={option.onPress}
      accessibilityRole="button"
      accessibilityLabel={option.title}
      accessibilityState={{ disabled: option.comingSoon }}
      style={({ pressed }) => [
        s.card,
        { flexDirection: flexRow(IS_RTL) },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        option.comingSoon && s.cardMuted,
      ]}>

      {/* Icon tile */}
      <View style={[s.iconTile, { backgroundColor: option.bg }]}>
        <Ionicons name={option.icon} size={22} color={option.tint} />
      </View>

      {/* Text block */}
      <View style={s.cardBody}>
        <View style={[s.cardTitleRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Text style={[s.cardTitle, { flex: 1 }]} numberOfLines={1}>
            {option.title}
          </Text>
          {option.comingSoon && (
            <View style={s.comingSoonBadge}>
              <Text style={s.comingSoonText}>قريباً</Text>
            </View>
          )}
        </View>
        <Text style={s.cardDesc} numberOfLines={2}>{option.description}</Text>
      </View>

      <Ionicons
        name={FORWARD_CHEVRON}
        size={16}
        color={option.comingSoon ? kit.color.inkFaint : kit.color.inkSoft}
      />
    </Pressable>
  );
}

const WHATSAPP_RX_URL =
  `https://wa.me/201112343212?text=${encodeURIComponent("مرحباً، أريد إضافة وصفة طبية إلى حسابي.")}`;

export function AddRxEntry(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const options: EntryOption[] = [
    {
      icon:        "logo-whatsapp",
      tint:        "#16A34A",
      bg:          "#DCFCE7",
      title:       "إرسال الوصفة عبر واتساب",
      description: "أرسل صورة الوصفة وسيضيفها فريق الصيدلية إلى حسابك",
      onPress:     () => { void Linking.openURL(WHATSAPP_RX_URL).catch(() => {}); },
    },
    {
      icon:        "keypad-outline",
      tint:        kit.color.warn,
      bg:          kit.color.warnTint,
      title:       "إدخال رقم الوصفة",
      description: "اكتبه يدوياً من ورقة الوصفة أو الملصق",
      onPress:     () => router.push("/prescriptions/manual" as never),
    },
    {
      icon:        "scan-outline",
      tint:        kit.color.accentDeep,
      bg:          kit.color.accentTint,
      title:       "مسح ملصق الوصفة",
      description: "مسح الوصفة بالكاميرا مباشرةً",
      comingSoon:  true,
      onPress:     () => router.push("/prescriptions/scan" as never),
    },
    {
      icon:        "swap-horizontal-outline",
      tint:        "#7C3AED",
      bg:          "#F5F3FF",
      title:       "نقل من صيدلية أخرى",
      description: "انقل وصفاتك من صيدلية أخرى بسهولة",
      comingSoon:  true,
      onPress:     () => router.push("/prescriptions/transfer" as never),
    },
  ];

  return (
    <View style={s.screen}>

      {/* VIP header */}
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            style={s.backBtn}>
            <Ionicons name={BACK_CHEVRON} size={20} color={kit.color.ink} />
          </Pressable>
        </View>
        <View style={[s.identityRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.heroTile}>
            <Ionicons name="add-circle-outline" size={22} color={kit.color.accentDeep} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>الوصفات الطبية</Text>
            <Text style={s.title}>إضافة وصفة</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop:        20,
          paddingBottom:     insets.bottom + 32,
          gap:               10,
        }}
        showsVerticalScrollIndicator={false}>

        <Text style={s.sectionLabel}>اختر طريقة الإضافة</Text>

        {options.map((opt) => (
          <EntryCard key={opt.title} option={opt} />
        ))}

        {/* Controlled-substance callout */}
        <View style={[s.infoCallout, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={s.infoIconWell}>
            <Ionicons name="shield-checkmark-outline" size={16} color={kit.color.warn} />
          </View>
          <Text style={s.infoText}>
            الأدوية الخاضعة للرقابة تتطلب وصفة طبية ورقية أصلية تُسلَّم للصيدلية، وفقاً للوائح وزارة الصحة المصرية.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  // ── VIP header ───────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 20,
    paddingBottom:     18,
    gap:               16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    alignItems: "center",
  },
  backBtn: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: kit.color.well,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
  },
  identityRow: {
    alignItems: "center",
    gap:        14,
  },
  heroTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     kit.color.line,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    textAlign:          "right",
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         36,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    textAlign:          "right",
    includeFontPadding: false,
  },

  // ── Section label ─────────────────────────────────────────────────────────────
  sectionLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    letterSpacing:      0.4,
    textAlign:          "right",
    marginBottom:       2,
    includeFontPadding: false,
  },

  // ── Entry card ────────────────────────────────────────────────────────────────
  card: {
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: 14,
    paddingVertical:   16,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.raised,
  },
  cardMuted: {
    opacity: 0.7,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  cardBody: {
    flex: 1,
    gap:  3,
  },
  cardTitleRow: {
    alignItems: "center",
    gap:        8,
  },
  cardTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.ink,
    textAlign:          "right",
    includeFontPadding: false,
  },
  cardDesc: {
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         18,
    color:              kit.color.inkSoft,
    textAlign:          "right",
    includeFontPadding: false,
  },
  comingSoonBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  comingSoonText: {
    fontFamily:         theme.fonts.black,
    fontSize:           9,
    lineHeight:         13,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Info callout ─────────────────────────────────────────────────────────────
  infoCallout: {
    alignItems:      "flex-start",
    gap:             12,
    marginTop:       8,
    padding:         14,
    backgroundColor: kit.color.warnTint,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.warn,
  },
  infoIconWell: {
    width:           32,
    height:          32,
    borderRadius:    10,
    backgroundColor: "rgba(245,158,11,0.15)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  infoText: {
    flex:               1,
    fontFamily:         theme.fonts.regular,
    fontSize:           12,
    lineHeight:         19,
    color:              kit.color.inkSoft,
    textAlign:          "right",
    includeFontPadding: false,
  },
});
