import React, { useMemo, useEffect } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, View, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, SlideInDown, withRepeat, withTiming, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";

import { useOrderTracking } from "../hooks/useOrderTracking";
import { Button, kit, Text as UIText } from "@pharmacy/ui-native";
import { useDarkColors } from "@/hooks/useDarkColors";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const STATUS_STEPS = [
  { status: "placed", icon: "receipt-outline", labelKey: "order.statusPlaced" },
  { status: "confirmed", icon: "checkmark-done-outline", labelKey: "order.statusConfirmed" },
  { status: "preparing", icon: "cube-outline", labelKey: "order.statusPreparing" },
  { status: "out_for_delivery", icon: "bicycle-outline", labelKey: "order.statusOutForDelivery" },
  { status: "delivered", icon: "home-outline", labelKey: "order.statusDelivered" },
];

function TimelineStep({ step, isCompleted, isCurrent, isLast }: any) {
  const { c } = useDarkColors();
  const { t } = useTranslation();
  
  // Pulse animation for current step
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    if (isCurrent) {
      pulse.value = withRepeat(withTiming(1.3, { duration: 1000 }), -1, true);
    } else {
      pulse.value = 1;
    }
  }, [isCurrent]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const iconColor = isCompleted || isCurrent ? kit.color.canvas : kit.color.inkFaint;
  const bgColor = isCompleted ? kit.color.success : isCurrent ? kit.color.accentDeep : c.line;

  return (
    <View style={[styles.stepContainer, { flexDirection: flexRow(IS_RTL) }]}>
      <View style={styles.stepIndicator}>
        <Animated.View style={[styles.stepDot, { backgroundColor: bgColor }, animatedDotStyle]}>
          <Ionicons name={step.icon} size={16} color={iconColor} />
        </Animated.View>
        {!isLast && (
          <View style={[styles.stepLine, { backgroundColor: isCompleted ? kit.color.success : c.line }]} />
        )}
      </View>
      <View style={styles.stepContent}>
        <UIText style={[styles.stepLabel, { color: isCompleted || isCurrent ? c.ink : kit.color.inkSoft, textAlign: TEXT_START }]}>
          {t(step.labelKey, { defaultValue: step.status })}
        </UIText>
        {isCurrent && (
          <UIText style={[styles.stepSublabel, { color: kit.color.accentDeep, textAlign: TEXT_START }]}>
            {t("order.inProgress", { defaultValue: "In Progress..." })}
          </UIText>
        )}
      </View>
    </View>
  );
}

export default function TrackOrderScreen() {
  const { c } = useDarkColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, token } = useLocalSearchParams<{ id: string; token: string }>();

  const { data: track, isLoading, isError } = useOrderTracking(id as string, token as string);

  const currentStepIndex = useMemo(() => {
    if (!track) return 0;
    const idx = STATUS_STEPS.findIndex(s => s.status === track.status);
    return idx >= 0 ? idx : 0;
  }, [track]);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <Animated.View entering={FadeIn.duration(200)} style={[styles.header, { paddingTop: insets.top, backgroundColor: c.surface, borderBottomColor: c.line }]}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backBtn}
        >
          <Ionicons name={BACK_CHEVRON} size={24} color={c.ink} />
        </Pressable>
        <UIText style={[styles.title, { color: c.ink }]}>{t("order.trackTitle", { defaultValue: "Track Order" })}</UIText>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView 
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(50)}>
          
          {/* Order Meta Header */}
          <View style={[styles.metaCard, { backgroundColor: c.surface, borderColor: c.line }]}>
             <View style={[styles.metaRow, { flexDirection: flexRow(IS_RTL) }]}>
               <View>
                 <UIText style={[styles.metaLabel, { color: c.inkSoft, textAlign: TEXT_START }]}>{t("order.orderId", { defaultValue: "Order ID" })}</UIText>
                 <UIText style={[styles.metaValue, { color: c.ink, textAlign: TEXT_START }]}>#{id?.slice(0, 8).toUpperCase()}</UIText>
               </View>
               <View>
                 <UIText style={[styles.metaLabel, { color: c.inkSoft, textAlign: IS_RTL ? "left" : "right" }]}>{t("order.eta", { defaultValue: "Est. Arrival" })}</UIText>
                 <UIText style={[styles.metaValue, { color: kit.color.accentDeep, textAlign: IS_RTL ? "left" : "right" }]}>45 mins</UIText>
               </View>
             </View>
          </View>

          {/* Map Placeholder */}
          <View style={[styles.mapPlaceholder, { backgroundColor: c.line }]}>
             <Ionicons name="map" size={48} color={c.inkFaint} />
             <UIText style={{ color: c.inkSoft, marginTop: 8 }}>{t("order.mapLoading", { defaultValue: "Driver Location (Simulated)" })}</UIText>
             
             {track?.location && (
               <Pressable 
                 style={styles.mapBtn}
                 onPress={() => Linking.openURL(`https://maps.google.com/?q=${track.location!.lat},${track.location!.lng}`)}
               >
                 <UIText style={styles.mapBtnText}>{t("order.openMaps", { defaultValue: "Open in Maps" })}</UIText>
               </Pressable>
             )}
          </View>

          {/* Timeline Card */}
          <View style={[styles.timelineCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <UIText style={[styles.timelineHeader, { color: c.ink, textAlign: TEXT_START }]}>{t("order.timeline", { defaultValue: "Delivery Status" })}</UIText>
            <View style={styles.timelineList}>
              {STATUS_STEPS.map((step, idx) => (
                <TimelineStep
                  key={step.status}
                  step={step}
                  isCompleted={idx < currentStepIndex}
                  isCurrent={idx === currentStepIndex}
                  isLast={idx === STATUS_STEPS.length - 1}
                />
              ))}
            </View>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
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
    paddingTop: 24,
  },
  metaCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  metaRow: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 12,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    fontFamily: theme.fonts.extrabold,
    fontSize: 18,
  },
  mapPlaceholder: {
    height: 180,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    overflow: "hidden",
  },
  mapBtn: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: kit.color.canvas,
    borderRadius: 20,
    ...kit.shadow.raised,
  },
  mapBtnText: {
    fontFamily: theme.fonts.bold,
    fontSize: 13,
    color: kit.color.accentDeep,
  },
  timelineCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  timelineHeader: {
    fontFamily: theme.fonts.bold,
    fontSize: 16,
    marginBottom: 24,
  },
  timelineList: {
    paddingLeft: 8,
  },
  stepContainer: {
    alignItems: "flex-start",
  },
  stepIndicator: {
    alignItems: "center",
    width: 32,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  stepLine: {
    width: 2,
    height: 40,
    marginVertical: -4,
    zIndex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
    minHeight: 64,
  },
  stepLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 15,
  },
  stepSublabel: {
    fontFamily: theme.fonts.medium,
    fontSize: 13,
    marginTop: 4,
  },
});
