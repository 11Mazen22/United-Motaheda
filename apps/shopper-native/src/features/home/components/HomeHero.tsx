import React, { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { CustomerUI, kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { useAuth } from "@/features/auth";

const IS_RTL = isRtl();

interface HomeHeroProps {
  onScanRx: () => void;
  onDeals: () => void;
  onSearch?: () => void;
  onFastDeliv?: () => void;
}

export const HomeHero = memo(function HomeHero({ onScanRx, onDeals, onSearch, onFastDeliv }: HomeHeroProps) {
  const { t } = useTranslation();
  const { pagePad } = useScreenLayout();
  const { user } = useAuth();
  const firstName = useMemo(() => (user?.name ?? "").split(" ")[0].trim() || null, [user?.name]);

  const actions = [
    { icon: "document-text", label: t("home.heroScanRx", "Prescription"), sub: t("home.heroScanRxSub", "Upload"), onPress: onScanRx, color: "#14b8a6" },
    { icon: "bicycle", label: t("home.heroFastDeliv", "Fast Delivery"), sub: t("home.heroFastDelivSub", "Under 30m"), onPress: onFastDeliv ?? onDeals, color: "#f59e0b" },
    { icon: "star", label: t("home.heroExclusiveOffers", "Offers"), sub: t("home.heroExclusiveOffersSub", "Save 20%"), onPress: onDeals, color: "#ec4899" },
  ];

  return (
    <View style={styles.container}>
      {/* Background Deep Luxury Gradient */}
      <LinearGradient
        colors={[kit.color.accentDeep, kit.color.accent, kit.color.surface]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={[styles.content, { paddingHorizontal: pagePad }]}>
        <Animated.View entering={FadeInDown.duration(800).springify()}>
          <CustomerUI.Typography scale="productMeta" color="rgba(255,255,255,0.8)" style={{ textAlign: textAlignStart(IS_RTL) }}>
            {firstName ? t("home.heroGreetingNamed", `Welcome back, ${firstName}`) : t("home.heroGreeting", "Welcome to United")}
          </CustomerUI.Typography>
          <CustomerUI.Typography scale="screenTitle" color="white" style={{ textAlign: textAlignStart(IS_RTL), marginTop: 4, marginBottom: 24, fontSize: 28, lineHeight: 36 }}>
            {t("home.heroSubtitle", "What can we help you find today?")}
          </CustomerUI.Typography>
        </Animated.View>

        <Pressable onPress={onSearch} style={styles.searchBox}>
          <View style={[styles.searchInner, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="search" size={20} color={kit.color.inkSoft} />
            <CustomerUI.Typography scale="buttonMd" color="muted" style={{ marginHorizontal: 12, flex: 1, textAlign: textAlignStart(IS_RTL) }}>
              {t("home.searchPlaceholder", "Search medicines, products...")}
            </CustomerUI.Typography>
            <View style={styles.scanBtn}>
              <Ionicons name="scan-outline" size={18} color="white" />
            </View>
          </View>
        </Pressable>

        <View style={[styles.actionRow, { flexDirection: flexRow(IS_RTL) }]}>
          {actions.map((act, i) => (
            <Pressable key={i} onPress={act.onPress} style={styles.actionCard}>
              <View style={[styles.iconCircle, { backgroundColor: act.color + '1A' }]}>
                <Ionicons name={act.icon as unknown as never} size={24} color={act.color} />
              </View>
              <CustomerUI.Typography scale="navLabel" color="primary" style={{ marginTop: 12, marginBottom: 2, textAlign: "center", fontSize: 13, fontFamily: "Cairo_700Bold" }}>
                {act.label}
              </CustomerUI.Typography>
              <CustomerUI.Typography scale="productMeta" color="muted" style={{ textAlign: "center", fontSize: 11 }}>
                {act.sub}
              </CustomerUI.Typography>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  content: {
    paddingTop: 120, // Space for header
  },
  searchBox: {
    backgroundColor: 'white',
    borderRadius: 100,
    padding: 6,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  searchInner: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  scanBtn: {
    backgroundColor: kit.color.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 8,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
