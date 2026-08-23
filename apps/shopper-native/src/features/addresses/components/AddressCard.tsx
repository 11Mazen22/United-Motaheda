import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, useReducedMotion } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { AddressMapPlaceholder } from "./AddressMapPlaceholder";
import { ADDRESS_LABELS } from "../types";
import type { Address } from "../types";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  address: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

export function AddressCard({ address, onEdit, onDelete, onSetDefault }: Props) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const IS_RTL = isRtl();

  // Smart Zone Pulse Animation
  const pulse = useSharedValue(1);
  React.useEffect(() => {
    if (!reducedMotion && address.is_default) {
      pulse.value = withRepeat(withTiming(1.5, { duration: 1200 }), -1, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, address.is_default]);

  const animatedDotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 - (pulse.value - 1),
  }));

  const labelConfig = ADDRESS_LABELS.find(l => l.key === address.label) || ADDRESS_LABELS[3];

  // Mock a smart zone
  const smartZone = address.city?.toLowerCase().includes("riyadh") 
    ? t("addresses.zoneFast", { defaultValue: "Express Delivery Zone" })
    : t("addresses.zoneStandard", { defaultValue: "Standard Zone" });
  const zoneColor = address.city?.toLowerCase().includes("riyadh") ? kit.color.success : kit.color.accentDeep;

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.card}>
      <AddressMapPlaceholder lat={address.lat} lng={address.lng} compact />
      
      {/* Smart Zone Badge */}
      <View style={[styles.zoneBadge, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={styles.pulseContainer}>
          <Animated.View style={[styles.pulseRing, { backgroundColor: zoneColor }, animatedDotStyle]} />
          <View style={[styles.pulseCore, { backgroundColor: zoneColor }]} />
        </View>
        <UIText style={[styles.zoneText, { color: zoneColor }]}>{smartZone}</UIText>
      </View>

      <View style={styles.content}>
        <View style={[styles.headerRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[styles.labelBadge, { backgroundColor: labelConfig.bg, flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name={labelConfig.icon as IoniconsName} size={14} color={labelConfig.color} />
            <UIText style={[styles.labelText, { color: labelConfig.color }]}>
              {t(labelConfig.labelKey)}
            </UIText>
          </View>
          {address.is_default && (
            <View style={[styles.defaultBadge, { flexDirection: flexRow(IS_RTL) }]}>
              <Ionicons name="checkmark-circle" size={14} color={kit.color.accentDeep} />
              <UIText style={styles.defaultText}>{t("addresses.default")}</UIText>
            </View>
          )}
        </View>

        <UIText style={[styles.street, { textAlign: textAlignStart(IS_RTL) }]} numberOfLines={2}>
          {address.street}
        </UIText>
        <UIText style={[styles.details, { textAlign: textAlignStart(IS_RTL) }]} numberOfLines={1}>
          {address.district}, {address.city}
        </UIText>
      </View>

      <View style={[styles.actions, { flexDirection: flexRow(IS_RTL) }]}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            onEdit();
          }}
        >
          <Ionicons name="create-outline" size={18} color={kit.color.inkSoft} />
          <UIText style={styles.actionText}>{t("common.edit")}</UIText>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            onDelete();
          }}
        >
          <Ionicons name="trash-outline" size={18} color={kit.color.danger} />
          <UIText style={[styles.actionText, { color: kit.color.danger }]}>{t("common.delete")}</UIText>
        </Pressable>

        {!address.is_default && (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSetDefault();
            }}
          >
            <UIText style={styles.actionTextPrimary}>{t("addresses.setAsDefault")}</UIText>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 16,
    ...kit.shadow.raised,
  },
  map: {
    height: 120,
  },
  zoneBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    left: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
    gap: 6,
    ...kit.shadow.floating,
    zIndex: 10,
  },
  pulseContainer: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  pulseCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneText: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  content: {
    padding: 20,
  },
  headerRow: {
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  labelBadge: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  labelText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
  },
  defaultBadge: {
    alignItems: "center",
    gap: 4,
  },
  defaultText: {
    fontFamily: theme.fonts.bold,
    fontSize: 12,
    color: kit.color.accentDeep,
  },
  street: {
    fontFamily: theme.fonts.extrabold,
    fontSize: 18,
    color: kit.color.ink,
    marginBottom: 4,
  },
  details: {
    fontFamily: theme.fonts.medium,
    fontSize: 14,
    color: kit.color.inkSoft,
    marginBottom: 8,
  },
  notesRow: {
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  notes: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 13,
    color: kit.color.inkFaint,
  },
  actions: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: kit.color.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: kit.color.inkSoft,
  },
  actionBtnPrimary: {
    backgroundColor: kit.color.accentTint,
    borderRadius: 12,
  },
  actionTextPrimary: {
    fontFamily: theme.fonts.bold,
    fontSize: 14,
    color: kit.color.accentDeep,
  },
});
