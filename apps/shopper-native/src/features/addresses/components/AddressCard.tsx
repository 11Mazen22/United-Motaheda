import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { AddressMapPlaceholder } from "./AddressMapPlaceholder";
import { ADDRESS_LABELS } from "../types";
import type { Address } from "../types";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
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
              <Ionicons name="checkmark-circle" size={11} color={theme.colors.green[600]} />
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
          <Ionicons name="call-outline" size={11} color={theme.colors.slate[400]} />
          <UIText style={styles.phoneText}>{address.phone}</UIText>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {!address.is_default && (
            <Pressable
              onPress={() => { haptic(); onSetDefault(); }}
              style={styles.actionBtn}>
              <Ionicons name="star-outline" size={13} color={kit.color.accentDeep} />
              <UIText style={[styles.actionText, { color: kit.color.accentDeep }]}>{t("address.setDefault")}</UIText>
            </Pressable>
          )}
          <Pressable
            onPress={() => { haptic(); onEdit(); }}
            style={styles.actionBtn}>
            <Ionicons name="create-outline" size={13} color={theme.colors.slate[500]} />
            <UIText style={styles.actionText}>{t("address.edit")}</UIText>
          </Pressable>
          <Pressable
            onPress={() => { haptic(); onDelete(); }}
            style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={13} color={theme.colors.red[500]} />
            <UIText style={[styles.actionText, { color: theme.colors.red[500] }]}>{t("address.delete")}</UIText>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    ...theme.shadow.card,
  },
  cardDefault: {
    borderColor: "rgba(14,126,116,0.25)",
    borderWidth: 1.5,
  },
  body: {
    padding: 14,
    gap: 8,
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
    borderRadius: 999,
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
    backgroundColor: theme.colors.green[50],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  defaultText: {
    fontSize: 10,
    fontFamily: theme.fonts.bold,
    color: theme.colors.green[700],
  },
  recipient: {
    fontSize: 14,
    fontFamily: theme.fonts.black,
    color: theme.colors.text.primary,
    textAlign: textAlignStart(isRtl()),
  },
  addressText: {
    fontSize: 12,
    fontFamily: theme.fonts.regular,
    color: theme.colors.slate[500],
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
    color: theme.colors.slate[400],
  },
  actions: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.slate[100],
  },
  actionBtn: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.colors.slate[50],
  },
  actionText: {
    fontSize: 10.5,
    fontFamily: theme.fonts.bold,
    color: theme.colors.slate[500],
  },
});
