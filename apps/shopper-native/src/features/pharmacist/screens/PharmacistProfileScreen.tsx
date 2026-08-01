/**
 * PharmacistProfileScreen — pharmacist identity, settings, and sign-out.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Screen, Text as UIText } from "@/shared/ui";
import { kit }                    from "@/shared/kit";
import { theme }                  from "@/shared/theme";
import { useAuth }                from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { PharmacistScreenHeader } from "../components/PharmacistScreenHeader";

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
      <View style={[s.menuIcon, { backgroundColor: danger ? kit.color.dangerTint : kit.color.accentTint }]}>
        <Ionicons name={icon} size={16} color={danger ? kit.color.danger : kit.color.accentDeep} />
      </View>
      <UIText
        variant="body-sm"
        style={{ flex: 1, textAlign: TEXT_START, color: danger ? kit.color.danger : kit.color.ink }}
      >
        {label}
      </UIText>
      {!danger && <Ionicons name="chevron-forward" size={14} color={kit.color.inkFaint} />}
    </Pressable>
  );
}

export function PharmacistProfileScreen(): React.ReactElement {
  const { t }              = useTranslation();
  const { user, signOut }  = useAuth();

  return (
    <Screen edgeTop background={kit.color.canvas}>
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
            <Ionicons name="shield-checkmark-outline" size={12} color={kit.color.accentDeep} />
            <UIText variant="eyebrow" style={{ color: kit.color.accentDeep }}>
              {t("pharmacist.roleLabel")}
            </UIText>
          </View>
        </View>

        {/* Menu */}
        <View style={s.card}>
          <MenuRow icon="notifications-outline" label={t("pharmacist.profileNotifications")} onPress={() => {}} />
          <View style={s.divider} />
          <MenuRow icon="language-outline"      label={t("pharmacist.profileLanguage")}      onPress={() => {}} />
          <View style={s.divider} />
          <MenuRow icon="lock-closed-outline"   label={t("pharmacist.profileSecurity")}      onPress={() => {}} />
          <View style={s.divider} />
          <MenuRow icon="help-circle-outline"   label={t("pharmacist.profileHelp")}          onPress={() => {}} />
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

const s = StyleSheet.create({
  scroll:        { paddingBottom: 60 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 28 },
  avatar: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: kit.color.accent,
    alignItems:      "center",
    justifyContent:  "center",
    ...kit.shadow.brandGlow,
  },
  avatarLetter: {
    fontSize:   34,
    fontFamily: theme.fonts.black,
    color:      "#fff",
  },
  roleBadge: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 12,
    paddingVertical:   5,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.accentTint,
    borderWidth:       1,
    borderColor:       kit.color.accent,
    marginTop:         4,
  },
  card: {
    marginHorizontal: kit.inset.screen,
    backgroundColor:  kit.color.surface,
    borderRadius:     kit.radius.xl,
    borderWidth:      1,
    borderColor:      kit.color.line,
    overflow:         "hidden",
    ...kit.shadow.card,
  },
  menuRow: {
    alignItems:        "center",
    gap:               12,
    paddingHorizontal: kit.inset.card,
    paddingVertical:   14,
  },
  menuRowPressed: { backgroundColor: kit.color.well },
  menuIcon: {
    width:           34,
    height:          34,
    borderRadius:    11,
    alignItems:      "center",
    justifyContent:  "center",
  },
  divider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  kit.color.line,
    marginHorizontal: kit.inset.card,
  },
});
