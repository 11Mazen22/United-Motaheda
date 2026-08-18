import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
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
  const { t }    = useTranslation();
  const labelCfg = ADDRESS_LABELS.find((l) => l.key === address.label) ?? ADDRESS_LABELS[3];

  const haptic = () => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.card, address.is_default && styles.cardDefault]}>
      {/* Map preview — passes coords when available; falls back to geocoding from address fields */}
      <AddressMapPlaceholder
        lat={address.lat}
        lng={address.lng}
        addressHint={address.lat == null ? {
          street:   address.street   ?? "",
          building: address.building ?? "",
          district: address.district ?? "",
          city:     address.city,
        } : undefined}
        compact
      />

      {/* Content */}
      <View style={styles.body}>
        {/* Top row: label + default badge */}
        <View style={styles.topRow}>
          <View style={styles.labelPill}>
            <Ionicons name={labelCfg.icon as IoniconsName} size={12} color={kit.color.accentDeep} />
            <UIText style={styles.labelText}>{t(labelCfg.labelKey)}</UIText>
          </View>
          {address.is_default && (
            <View style={styles.defaultBadge}>
              <Ionicons name="checkmark-circle" size={11} color={kit.color.green[600]} />
              <UIText style={styles.defaultText}>{t("address.default")}</UIText>
            </View>
          )}
        </View>

        {/* Recipient */}
        <UIText style={styles.recipient} numberOfLines={1}>
          {address.recipient_name}
        </UIText>

        {/* Full address */}
        <UIText style={styles.addressText} numberOfLines={2}>
          {[address.street, address.building, address.district, address.city]
            .filter(Boolean)
            .join("، ")}
        </UIText>

        {/* Phone */}
        <View style={styles.phoneRow}>
          <Ionicons name="call-outline" size={11} color={kit.color.slate[400]} />
          <UIText style={styles.phoneText}>{address.phone}</UIText>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {!address.is_default && (
            <Pressable
              onPress={() => { haptic(); onSetDefault(); }}
              style={styles.actionBtnTouchable}
              accessibilityRole="button"
              accessibilityLabel={t("address.setDefault")}>
              {({ pressed }) => (
                <View style={[styles.actionBtn, pressed && styles.actionBtnPressed]}>
                  <Ionicons name="star-outline" size={13} color={kit.color.accentDeep} />
                  <UIText style={[styles.actionText, { color: kit.color.accentDeep }]}>{t("address.setDefault")}</UIText>
                </View>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={() => { haptic(); onEdit(); }}
            style={styles.actionBtnTouchable}
            accessibilityRole="button"
            accessibilityLabel={t("address.edit")}>
            {({ pressed }) => (
              <View style={[styles.actionBtn, pressed && styles.actionBtnPressed]}>
                <Ionicons name="create-outline" size={13} color={kit.color.inkSoft} />
                <UIText style={styles.actionText}>{t("address.edit")}</UIText>
              </View>
            )}
          </Pressable>
          <Pressable
            onPress={() => { haptic(); onDelete(); }}
            style={styles.actionBtnTouchable}
            accessibilityRole="button"
            accessibilityLabel={t("address.delete")}>
            {({ pressed }) => (
              <View style={[styles.actionBtn, pressed && styles.actionBtnDangerPressed]}>
                <Ionicons name="trash-outline" size={13} color={kit.color.danger} />
                <UIText style={[styles.actionText, { color: kit.color.danger }]}>{t("address.delete")}</UIText>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: kit.color.line,
    ...kit.shadow.raised,
  },
  cardDefault: {
    borderColor: "rgba(14,126,116,0.25)",
    borderWidth: 1.5,
  },
  body: {
    padding: kit.sp(3.5),
    gap: kit.sp(2),
  },
  topRow: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    justifyContent: "space-between",
  },
  labelPill: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 5,
    backgroundColor: kit.color.accentTint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: kit.radius.pill,
  },
  labelText: {
    fontSize: 11,
    fontFamily: theme.fonts.bold,
    color: kit.color.accentDeep,
  },
  defaultBadge: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 4,
    backgroundColor: kit.color.successTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: kit.radius.pill,
  },
  defaultText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: kit.color.success,
  },
  recipient: {
    fontSize: 14,
    fontFamily: theme.fonts.black,
    color: kit.color.ink,
    textAlign: textAlignStart(isRtl()),
  },
  addressText: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: kit.color.inkSoft,
    textAlign: textAlignStart(isRtl()),
    lineHeight: 18,
  },
  phoneRow: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 5,
  },
  phoneText: {
    fontSize: 11,
    fontFamily: theme.fonts.semibold,
    color: kit.color.inkFaint,
  },
  actions: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: kit.color.line,
  },
  // Touchable wrapper carries only sizing/radius — visual styling (gap,
  // flexDirection, background) lives on the plain View inside instead of on
  // the Pressable's own function-computed style, which is unreliable here.
  actionBtnTouchable: {
    borderRadius: kit.radius.control,
    flexShrink: 1,
  },
  actionBtn: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: kit.radius.control,
    backgroundColor: kit.color.well,
  },
  actionBtnPressed: {
    backgroundColor: kit.color.accentTint,
  },
  actionBtnDangerPressed: {
    backgroundColor: kit.color.dangerTint,
  },
  actionText: {
    fontSize: 10.5,
    fontFamily: theme.fonts.bold,
    color: kit.color.inkSoft,
  },
});
