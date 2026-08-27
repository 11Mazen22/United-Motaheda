import React, { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText } from "@pharmacy/ui-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useTheme } from "@pharmacy/ui-native";

import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface PreferenceSwitchProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isLast?: boolean;
}

function PreferenceSwitch({ title, description, value, onValueChange, isLast = false }: PreferenceSwitchProps) {
  const { theme } = useTheme();
  
  const handleToggle = (val: boolean) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(val);
  };

  return (
    <View style={[styles.switchRow, { borderBottomColor: isLast ? "transparent" : theme.colors.border.default, flexDirection: flexRow(IS_RTL) }]}>
      <View style={styles.switchTextContainer}>
        <UIText style={[styles.switchTitle, { color: theme.colors.text.primary, textAlign: TEXT_START }]}>{title}</UIText>
        <UIText style={[styles.switchDesc, { color: theme.colors.text.secondary, textAlign: TEXT_START }]}>{description}</UIText>
      </View>
      <Switch 
        value={value} 
        onValueChange={handleToggle} 
        trackColor={{ false: theme.colors.border.default, true: theme.colors.brand.primary }}
        ios_backgroundColor={theme.colors.border.default}
      />
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Mock State for Redesign (Replace with actual store hooks in production)
  const [masterToggle, setMasterToggle] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [stockAlerts, setStockAlerts] = useState(true);
  const [newsletter, setNewsletter] = useState(false);

  const handleMasterToggle = (val: boolean) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMasterToggle(val);
    if (!val) {
      setOrderUpdates(false);
      setPromotions(false);
      setStockAlerts(false);
      setNewsletter(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}>
      <Animated.View entering={FadeIn.duration(200)} style={[styles.header, { paddingTop: insets.top, backgroundColor: theme.colors.canvas.surface, borderBottomColor: theme.colors.border.default }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backBtn}
        >
          <Ionicons name={BACK_CHEVRON} size={24} color={theme.colors.text.primary} />
        </Pressable>
        <UIText style={[styles.title, { color: theme.colors.text.primary }]}>{t("profile.notifications", { defaultValue: "Notifications" })}</UIText>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(50)}>
          
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[theme.colors.brand.primaryLight, theme.colors.canvas.background]}
              style={styles.heroRing}
            >
               <Ionicons name="notifications" size={48} color={theme.colors.brand.primary} />
            </LinearGradient>
            <UIText style={[styles.heroInstruction, { color: theme.colors.text.secondary }]}>
              {t("profile.notificationsInstruction", { defaultValue: "Control how and when you want to be notified about your orders, health reminders, and exclusive offers." })}
            </UIText>
          </View>

          {/* Master Toggle */}
          <View style={[styles.cardGroup, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default, marginBottom: 24 }]}>
             <View style={[styles.switchRow, { flexDirection: flexRow(IS_RTL) }]}>
               <View style={styles.switchTextContainer}>
                 <UIText style={[styles.switchTitle, { color: theme.colors.text.primary, textAlign: TEXT_START, fontSize: 16 }]}>
                   {t("notifications.allowAll", { defaultValue: "Allow Notifications" })}
                 </UIText>
               </View>
               <Switch 
                 value={masterToggle} 
                 onValueChange={handleMasterToggle} 
                 trackColor={{ false: theme.colors.border.default, true: theme.colors.status.success }}
               />
             </View>
          </View>

          {masterToggle && (
            <Animated.View layout={Layout.springify().damping(20)} entering={FadeInDown.duration(300)}>
              
              <View style={styles.sectionHeader}>
                <UIText style={[styles.sectionTitle, { color: theme.colors.text.secondary, textAlign: TEXT_START }]}>{t("notifications.orders", { defaultValue: "ORDERS & DELIVERIES" })}</UIText>
              </View>
              <View style={[styles.cardGroup, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
                <PreferenceSwitch 
                  title={t("notifications.orderStatus", { defaultValue: "Order Status" })}
                  description={t("notifications.orderStatusDesc", { defaultValue: "Get real-time updates on your delivery." })}
                  value={orderUpdates}
                  onValueChange={setOrderUpdates}
                />
                <PreferenceSwitch 
                  title={t("notifications.stockAlerts", { defaultValue: "Back in Stock" })}
                  description={t("notifications.stockAlertsDesc", { defaultValue: "Be notified when your favorites are available." })}
                  value={stockAlerts}
                  onValueChange={setStockAlerts}
                  isLast={true}
                />
              </View>

              <View style={styles.sectionHeader}>
                <UIText style={[styles.sectionTitle, { color: theme.colors.text.secondary, textAlign: TEXT_START }]}>{t("notifications.marketing", { defaultValue: "OFFERS & MARKETING" })}</UIText>
              </View>
              <View style={[styles.cardGroup, { backgroundColor: theme.colors.canvas.surface, borderColor: theme.colors.border.default }]}>
                <PreferenceSwitch 
                  title={t("notifications.promotions", { defaultValue: "Exclusive Promotions" })}
                  description={t("notifications.promotionsDesc", { defaultValue: "Discounts, flash sales, and special events." })}
                  value={promotions}
                  onValueChange={setPromotions}
                />
                <PreferenceSwitch 
                  title={t("notifications.newsletter", { defaultValue: "Pharmacy Newsletter" })}
                  description={t("notifications.newsletterDesc", { defaultValue: "Health tips and curated product drops." })}
                  value={newsletter}
                  onValueChange={setNewsletter}
                  isLast={true}
                />
              </View>
            </Animated.View>
          )}

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: 18,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  heroRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroInstruction: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cardGroup: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  switchRow: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  switchTextContainer: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  switchDesc: {
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
