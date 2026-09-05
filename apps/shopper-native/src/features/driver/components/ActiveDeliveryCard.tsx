import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { Text as UIText, Card, IconButton, useTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import type { ManifestOrder } from "../hooks/useDriverManifest";
import { getDeliveryStage, getStageAction, getStageStatusLabel } from "../lib/deliveryStage";
import { STAGE_COLORS, STAGE_ICONS } from "../lib/stageMachine";
import ProgressTracker from "./ProgressTracker";

const IS_RTL = isRtl();

interface Props {
  order: ManifestOrder;
  onPress: () => void;
  onCall: () => void;
  onPrimaryAction: () => void;
}

export function ActiveDeliveryCard({ order, onPress, onCall, onPrimaryAction }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const pagePad = kit.inset.screen;

  const stage = getDeliveryStage(order.status, order);
  const action = getStageAction(stage, order.assignmentKind);
  const statusLabel = getStageStatusLabel(stage, order.assignmentKind);
  const accentColor = STAGE_COLORS[stage] ?? theme.colors.brand.primary;
  const stageIcon = STAGE_ICONS[stage] ?? "help";

  const steps = [
    { id: "pickup", label: "Pickup", done: stage !== "to_pharmacy" },
    { id: "picked", label: "Picked", done: ["to_customer", "at_customer", "delivered"].includes(stage) },
    { id: "dropoff", label: "Dropoff", done: ["at_customer", "delivered"].includes(stage) },
    { id: "done", label: "Done", done: stage === "delivered" },
  ];

  const handleCall = () => {
    const phone = order.customerPhone?.replace(/\s/g, "");
    if (phone) void Linking.openURL(`tel:${phone}`);
  };

  const s = useMemo(() => StyleSheet.create({
    card: {
      marginHorizontal: pagePad,
      borderRadius: 20,
      padding: 18,
      gap: 12,
      backgroundColor: theme.colors.canvas.surface,
      borderWidth: 1,
      borderColor: accentColor,
      ...theme.shadows[2],
    },
    headerRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10 },
    iconWell: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand.primaryLight },
    badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, backgroundColor: theme.colors.brand.primaryLight },
    badgeText: { fontSize: 11, fontFamily: legacyTheme.fonts.bold, color: theme.colors.brand.primary },
    metaRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10, marginTop: 4 },
    actionRow: { flexDirection: flexRow(IS_RTL), gap: 10, marginTop: 12 },
    primaryBtn: { flex: 1, minHeight: 50, borderRadius: 14 },
  }), [theme, pagePad, accentColor]);

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={s.card} elevation="sm">
        <View style={s.headerRow}>
          <View style={s.iconWell}>
            <Ionicons name={stageIcon as any} size={22} color={accentColor} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 8 }}>
              <UIText variant="card-title">#{String(order.id).slice(-8).toUpperCase()}</UIText>
              <View style={s.badge}>
                <UIText style={s.badgeText}>{formatPrice(order.total ?? 0)}</UIText>
              </View>
            </View>
            <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 6, marginTop: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColor }} />
              <UIText variant="caption" color="secondary">{t(statusLabel.key, statusLabel.fallback)}</UIText>
            </View>
          </View>
        </View>

        <View style={[styles.infoRow, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="person-outline" size={14} color={theme.colors.text.muted} />
          <UIText variant="body-sm" color="secondary" numberOfLines={1} style={{ marginLeft: 6 }}>
            {order.customerName || "—"}
          </UIText>
          {order.customerPhone ? (
            <IconButton icon="call-outline" size={32} onPress={handleCall} accessibilityLabel={t("driver.phone", "Call")} />
          ) : null}
        </View>

        <ProgressTracker steps={steps} pagePad={0} />

        <View style={s.actionRow}>
          {order.customerPhone ? (
            <Pressable onPress={onCall} style={[styles.secondaryBtn, { borderColor: theme.colors.border.default }]} accessibilityRole="button">
              <Ionicons name="call-outline" size={18} color={theme.colors.text.secondary} />
              <UIText variant="label" color="secondary" style={{ marginLeft: 6 }}>Call</UIText>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}
          <Pressable onPress={onPrimaryAction} style={[styles.primaryBtn, { backgroundColor: accentColor }]} accessibilityRole="button">
            <UIText variant="label" color="inverse" style={{ fontFamily: legacyTheme.fonts.bold }}>
              {t(action.labelKey, action.fallback)}
            </UIText>
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  infoRow: { alignItems: "center", gap: 8, marginTop: 4 },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, gap: 6 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, gap: 8, flex: 1 },
});

export default ActiveDeliveryCard;
