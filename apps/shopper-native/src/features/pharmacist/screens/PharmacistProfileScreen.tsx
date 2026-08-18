/**
 * PharmacistProfileScreen — pharmacist identity, settings, and sign-out.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import { useRouter }      from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen, Text as UIText } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { kit }                    from "@pharmacy/ui-native";

import { useAuth }                from "@/features/auth";
import { useAppLanguage }         from "@/i18n/LanguageProvider";
import { FORWARD_CHEVRON, flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";
import { usePharmacistDashboard } from "../hooks/usePharmacistQueries";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface MenuRowProps {
  icon:    React.ComponentProps<typeof Ionicons>["name"];
  label:   string;
  onPress: () => void;
  danger?: boolean;
}

function MenuRow({ icon, label, onPress, danger = false }: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.menuRow, pressed && s.menuRowPressed, { flexDirection: flexRow(IS_RTL) }]}
      accessibilityRole="button"
    >
      <View style={[s.menuIcon, { backgroundColor: danger ? c.dangerTint : c.accentTint }]}>
        <Ionicons name={icon} size={16} color={danger ? c.danger : c.accentDeep} />
      </View>
      <UIText
        variant="body-sm"
        style={{ flex: 1, textAlign: TEXT_START, color: danger ? c.danger : c.ink }}
      >
        {label}
      </UIText>
      {!danger && <Ionicons name={FORWARD_CHEVRON} size={14} color={c.inkFaint} />}
    </Pressable>
  );
}

export function PharmacistProfileScreen(): React.ReactElement {
  const { c } = useDarkColors();
  const s = useSStyles(c);
  const { t }              = useTranslation();
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const statsQ             = usePharmacistDashboard();

  const stats = [
    {
      label: t("pharmacist.statActiveOrders"),
      value: statsQ.data?.activeOrders ?? 0,
      icon: "bag-handle-outline" as const,
      color: c.accentDeep,
      bg: c.accentTint,
    },
    {
      label: t("pharmacist.statPendingRx"),
      value: statsQ.data?.pendingPrescriptions ?? 0,
      icon: "document-text-outline" as const,
      color: "#7C3AED",
      bg: "#F5F3FF",
    },
    {
      label: t("pharmacist.statLowStock"),
      value: statsQ.data?.lowStockCount ?? 0,
      icon: "alert-circle-outline" as const,
      color: c.danger,
      bg: c.dangerTint,
    },
  ];

  const nextLanguage = language === "ar" ? "en" : "ar";
  const languageLabel = language === "ar" ? "العربية" : "English";

  return (
    <Screen edgeTop background={c.canvas}>
      <PharmacistScreenHeader title={t("pharmacist.profileTitle")} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <UIText style={s.avatarLetter}>
              {(user?.name ?? user?.email ?? "P").charAt(0).toUpperCase()}
            </UIText>
          </View>
          <UIText variant="screen-title" style={{ textAlign: "center" }}>
            {user?.name || t("pharmacist.unnamed")}
          </UIText>
          <UIText variant="body-sm" color="secondary" style={{ textAlign: "center" }}>
            {user?.email || ""}
          </UIText>
          <View style={s.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color={c.accentDeep} />
            <UIText variant="eyebrow" style={{ color: c.accentDeep }}>
              {t("pharmacist.roleLabel")}
            </UIText>
          </View>
        </View>

        <View style={s.statsCard}>
          {stats.map((item, index) => (
            <View
              key={item.label}
              style={[
                s.statRow,
                { flexDirection: flexRow(IS_RTL) },
                index !== stats.length - 1 && s.statRowBorder,
              ]}
            >
              <View style={[s.menuIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={16} color={item.color} />
              </View>
              <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>
                {item.label}
              </UIText>
              <UIText style={s.statValue}>{item.value}</UIText>
            </View>
          ))}
        </View>

        {/* Menu */}
        <View style={s.card}>
          <MenuRow
            icon="notifications-outline"
            label={t("pharmacist.profileNotifications")}
            onPress={() => router.push("/(pharmacist)/notifications" as never)}
          />
          <View style={s.divider} />
          <MenuRow
            icon="language-outline"
            label={`${t("pharmacist.profileLanguage")} · ${languageLabel}`}
            onPress={() => { void setLanguage(nextLanguage); }}
          />
          <View style={s.divider} />
          <MenuRow
            icon="lock-closed-outline"
            label={t("pharmacist.profileSecurity")}
            onPress={() => router.push("/change-password" as never)}
          />
          <View style={s.divider} />
          <MenuRow
            icon="help-circle-outline"
            label={t("pharmacist.profileHelp")}
            onPress={() => router.push("/faq" as never)}
          />
        </View>

        <View style={[s.card, { marginTop: 12 }]}>
          <MenuRow
            icon="log-out-outline"
            label={t("pharmacist.signOut")}
            onPress={() => void signOut()}
            danger
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const useSStyles = (c: any) => StyleSheet.create({
  scroll:        { paddingBottom: 60 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 28 },
  avatar: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: c.accent,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },
  avatarLetter: {
    fontSize:   34,
    fontFamily: kit.font.black,
    color:      "#fff",
  },
  roleBadge: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      kit.radius.pill,
    backgroundColor:   c.accentTint,
    borderWidth:       1,
    borderColor:       c.accent,
    marginTop:         4,
  },
  card: {
    marginHorizontal: kit.inset.screen,
    backgroundColor:  c.surface,
    borderRadius:     kit.radius.xl,
    borderWidth:      1,
    borderColor:      c.line,
    overflow:         "hidden",
    ...kit.shadow.card,
  },
  statsCard: {
    marginHorizontal: kit.inset.screen,
    marginBottom:     12,
    backgroundColor:  c.surface,
    borderRadius:     kit.radius.xl,
    borderWidth:      1,
    borderColor:      c.line,
    overflow:         "hidden",
    ...kit.shadow.card,
  },
  statRow: {
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: kit.inset.card,
    paddingVertical:   14,
  },
  statRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.line,
  },
  statValue: {
    fontSize:   16,
    fontFamily: kit.font.black,
    color:      c.ink,
  },
  menuRow: {
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: kit.inset.card,
    paddingVertical:   14,
  },
  menuRowPressed: { backgroundColor: c.well },
  menuIcon: {
    width:           34,
    height:          34,
    borderRadius:    11,
    alignItems:      "center",
    justifyContent:  "center",
  },
  divider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  c.line,
    marginHorizontal: kit.inset.card,
  },
});
