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

  const { c } = useDarkColors();

  return (

    <Pressable

      onPress={onPress}

      style={({ pressed }) => [

        styles.menuRow,

        pressed && { backgroundColor: c.well },

        { flexDirection: flexRow(IS_RTL) }

      ]}

      accessibilityRole="button"

    >

      <View style={[styles.menuIcon, { backgroundColor: danger ? c.dangerTint : c.accentTint }]}>

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

  const { t }              = useTranslation();

  const router             = useRouter();

  const { user, signOut }  = useAuth();

  const { language, setLanguage } = useAppLanguage();

  const statsQ             = usePharmacistDashboard();



  const nextLanguage = language === "ar" ? "en" : "ar";

  const languageLabel = language === "ar" ? "العربية" : "English";



  return (

    <Screen edgeTop background={c.canvas}>

      <PharmacistScreenHeader title={t("pharmacist.profileTitle")} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>



        {/* Avatar + name */}

        <View style={styles.avatarSection}>

          <View style={[styles.avatar, { backgroundColor: c.accent }]}>

            <UIText style={styles.avatarLetter}>

              {(user?.name ?? user?.email ?? "P").charAt(0).toUpperCase()}

            </UIText>

          </View>

          <UIText variant="screen-title" style={{ textAlign: "center" }}>

            {user?.name || t("pharmacist.unnamed")}

          </UIText>

          <UIText variant="body-sm" color="secondary" style={{ textAlign: "center" }}>

            {user?.email || ""}

          </UIText>

          <View style={[styles.roleBadge, { backgroundColor: c.accentTint, borderColor: c.accent }]}>

            <Ionicons name="shield-checkmark-outline" size={12} color={c.accentDeep} />

            <UIText variant="eyebrow" style={{ color: c.accentDeep }}>

              {t("pharmacist.roleLabel")}

            </UIText>

          </View>

        </View>



        {/* Stats */}

        <View style={[styles.statsCard, { backgroundColor: c.surface, borderColor: c.line }]}>

          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>

            <View style={[styles.menuIcon, { backgroundColor: c.accentTint }]}>

              <Ionicons name="bag-handle-outline" size={16} color={c.accentDeep} />

            </View>

            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>

              {t("pharmacist.statActiveOrders")}

            </UIText>

            <UIText style={styles.statValue}>{statsQ.data?.activeOrders ?? 0}</UIText>

          </View>

          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>

            <View style={[styles.menuIcon, { backgroundColor: c.warnTint }]}>

              <Ionicons name="document-text-outline" size={16} color={c.warn} />

            </View>

            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>

              {t("pharmacist.statPendingRx")}

            </UIText>

            <UIText style={styles.statValue}>{statsQ.data?.pendingPrescriptions ?? 0}</UIText>

          </View>

          <View style={[styles.statRow, { flexDirection: flexRow(IS_RTL) }]}>

            <View style={[styles.menuIcon, { backgroundColor: c.dangerTint }]}>

              <Ionicons name="alert-circle-outline" size={16} color={c.danger} />

            </View>

            <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>

              {t("pharmacist.statLowStock")}

            </UIText>

            <UIText style={styles.statValue}>{statsQ.data?.lowStockCount ?? 0}</UIText>

          </View>

        </View>



        {/* Menu */}

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>          <MenuRow

            icon="notifications-outline"

            label={t("pharmacist.profileNotifications")}

            onPress={() => router.push("/(pharmacist)/notifications")}

          />

          <View style={[styles.divider, { backgroundColor: c.line }]} />

          <MenuRow

            icon="language-outline"

            label={`${t("pharmacist.profileLanguage")} · ${languageLabel}`}

            onPress={() => { void setLanguage(nextLanguage); }}

          />

          <View style={[styles.divider, { backgroundColor: c.line }]} />

          <MenuRow

            icon="lock-closed-outline"

            label={t("pharmacist.profileSecurity")}

            onPress={() => router.push("/change-password")}

          />

          <View style={[styles.divider, { backgroundColor: c.line }]} />

          <MenuRow

            icon="help-circle-outline"

            label={t("pharmacist.profileHelp")}

            onPress={() => router.push("/faq")}

          />

        </View>



        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line, marginTop: 12 }]}>          <MenuRow

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



const styles = StyleSheet.create({

  scroll:        { paddingBottom: 60 },

  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 28 },

  avatar: {

    width:           80,

    height:          80,

    borderRadius:    40,

    alignItems:      "center",

    justifyContent:  "center",

    ...kit.shadow.brandGlow,

  },

  avatarLetter: {

    fontSize:   34,

    fontFamily: "Cairo_900Black",

    color:      "#fff",

  },

  roleBadge: {

    flexDirection:     flexRow(IS_RTL),

    alignItems:        "center",

    gap:               5,

    paddingHorizontal: 12,

    paddingVertical:   5,

    borderRadius:      9999,

    marginTop:         4,

  },

  card: {

    marginHorizontal: kit.inset.screen,

    borderRadius:     16,

    borderWidth:      1,

    overflow:         "hidden",

    ...kit.shadow.card,

  },

  statsCard: {

    marginHorizontal: kit.inset.screen,

    marginBottom:     12,

    borderRadius:     16,

    borderWidth:      1,

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

    borderBottomColor: kit.color.line,

  },

  statValue: {

    fontSize:   16,

    fontFamily: "Cairo_900Black",

    color:      kit.color.ink,

  },

  menuRow: {

    alignItems:        "center",

    gap:               12,

    paddingHorizontal: kit.inset.card,

    paddingVertical:   14,

  },

  menuIcon: {

    width:           34,

    height:          34,

    borderRadius:    11,

    alignItems:      "center",

    justifyContent:  "center",

  },

  divider: {

    height:           StyleSheet.hairlineWidth,

    marginHorizontal: kit.inset.card,

  },

});
