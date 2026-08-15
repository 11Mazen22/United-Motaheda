import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText, Avatar, Button } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export default function DriverProfile(): React.ReactElement {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <View style={s.header}>
        <Avatar size={72} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <UIText variant="screen-title" style={{ textAlign: TEXT_START }}>{user?.name}</UIText>
          <UIText color="secondary" style={{ marginTop: 4, textAlign: TEXT_START }}>{user?.email}</UIText>
          <View style={{ flexDirection: flexRow(IS_RTL), gap: 8, marginTop: 10 }}>
            <Button label={"Edit profile"} variant="ghost" onPress={() => router.push('/edit-profile' as never)} />
            <Button label={"Vehicle & Docs"} onPress={() => router.push('/(driver)/profile/vehicle' as never)} />
          </View>
        </View>
        <View style={{ marginLeft: 8 }}>
          <Pressable onPress={() => signOut()} style={s.signOutBtn} accessibilityRole="button"><Ionicons name="log-out-outline" size={20} color={kit.color.ink} /></Pressable>
        </View>
      </View>

      <View style={s.metricsRow}>
        <View style={s.metricCol}>
          <UIText variant="caption" color="secondary">{t('driver.today')}</UIText>
          <UIText variant="card-title">—</UIText>
        </View>
        <View style={s.metricCol}>
          <UIText variant="caption" color="secondary">{t('driver.earnings')}</UIText>
          <UIText variant="card-title">—</UIText>
        </View>
        <View style={s.metricCol}>
          <UIText variant="caption" color="secondary">{t('driver.acceptance')}</UIText>
          <UIText variant="card-title">—</UIText>
        </View>
      </View>

      <View style={s.section}>
        <View style={s.quickTilesRow}>
          <Pressable onPress={() => router.push('/(driver)' as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="list-outline" size={20} color={kit.color.accentDeep} />
            <UIText variant="caption">{t('driver.manifest')}</UIText>
          </Pressable>
          <Pressable onPress={() => router.push('/(driver)/offers' as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="notifications" size={20} color={kit.color.accentDeep} />
            <UIText variant="caption">{t('driver.offers')}</UIText>
          </Pressable>
          <Pressable onPress={() => router.push('/(driver)/map' as never)} style={s.quickTile} accessibilityRole="button">
            <Ionicons name="map-outline" size={20} color={kit.color.accentDeep} />
            <UIText variant="caption">{t('driver.map')}</UIText>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: flexRow(IS_RTL), alignItems: 'center', paddingHorizontal: kit.inset.screen, paddingTop: 16, paddingBottom: 18 },
  signOutBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: kit.color.surface, alignItems: 'center', justifyContent: 'center' },
  metricsRow: { flexDirection: flexRow(IS_RTL), paddingHorizontal: kit.inset.screen, justifyContent: 'space-between', marginTop: 12 },
  metricCol: { alignItems: 'center', flex: 1 },
  section: { paddingHorizontal: kit.inset.screen, marginTop: 20 },
  quickTilesRow: { flexDirection: flexRow(IS_RTL), gap: 10, justifyContent: 'space-between' },
  quickTile: { flex: 1, backgroundColor: kit.color.surface, paddingVertical: 12, borderRadius: kit.radius.lg, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
});
