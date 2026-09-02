/**
 * DeliveryLocationCard — the one reusable "where do I go and what do I need
 * to know when I get there" component for the driver app. Used by the
 * active-delivery screen for both the pickup (pharmacy) and destination
 * (customer) legs, so a driver sees the exact same shape of information
 * regardless of which leg of the trip they're on.
 *
 * Deliberately field-guarded: a field only renders when it actually has a
 * value, so an order with no landmark/instructions doesn't leave a wall of
 * empty labelled rows — a plain formatted address is a perfectly complete
 * card on its own.
 */
import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText, Card, useTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export interface DeliveryLocationCardProps {
  kind: "pharmacy" | "customer";
  title: string;
  name?: string | null;
  formattedAddress?: string | null;
  building?: string | null;
  floor?: string | null;
  apartment?: string | null;
  landmark?: string | null;
  instructions?: string | null;
  zoneName?: string | null;
  phone?: string | null;
  coords?: { lat: number; lng: number } | null;
  pagePad?: number;
}

function buildNavigationUrl(coords: { lat: number; lng: number } | null | undefined, address: string | null | undefined): string | null {
  if (coords) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;
  }
  if (address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  }
  return null;
}

export function DeliveryLocationCard({
  kind, title, name, formattedAddress, building, floor, apartment, landmark, instructions, zoneName, phone, coords, pagePad = kit.inset.screen,
}: DeliveryLocationCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const s = useMemo(() => StyleSheet.create({
    card: { gap: 12 },
    headerRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 10 },
    iconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: kind === "pharmacy" ? `${theme.colors.status.info}1A` : theme.colors.brand.primaryLight },
    unitRow: { flexDirection: flexRow(IS_RTL), flexWrap: "wrap", gap: 8, marginTop: 2 },
    unitChip: { flexDirection: flexRow(IS_RTL), alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, backgroundColor: theme.colors.canvas.surfaceMuted },
    noteRow: { flexDirection: flexRow(IS_RTL), alignItems: "flex-start", gap: 8, marginTop: 4, padding: 10, borderRadius: 12, backgroundColor: `${theme.colors.status.warning}12` },
    actionsRow: { flexDirection: flexRow(IS_RTL), gap: 10, marginTop: 4 },
    actionBtn: { flex: 1, flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 14 },
    navigateBtn: { backgroundColor: theme.colors.brand.primary },
    callBtn: { backgroundColor: theme.colors.canvas.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border.default },
  }), [theme, kind, pagePad]);

  const address = formattedAddress?.trim() || null;
  const navUrl = buildNavigationUrl(coords ?? null, address);
  const cleanPhone = phone?.replace(/\s/g, "") || null;
  const unitParts = [
    building ? { icon: "business-outline" as const, label: `${t("driver.building")} ${building}` } : null,
    floor ? { icon: "layers-outline" as const, label: `${t("driver.floor")} ${floor}` } : null,
    apartment ? { icon: "key-outline" as const, label: `${t("driver.apartment")} ${apartment}` } : null,
  ].filter((v): v is { icon: "business-outline" | "layers-outline" | "key-outline"; label: string } => v != null);

  return (
    <Card style={s.card} padding="lg">
      <View style={s.headerRow}>
        <View style={s.iconWrap}>
          <Ionicons name={kind === "pharmacy" ? "storefront-outline" : "home-outline"} size={18} color={kind === "pharmacy" ? theme.colors.status.info : theme.colors.brand.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>{title}</UIText>
          {name ? <UIText variant="card-title" style={{ textAlign: TEXT_START, marginTop: 2 }}>{name}</UIText> : null}
        </View>
      </View>

      {address ? (
        <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START }}>{address}</UIText>
      ) : null}

      {unitParts.length > 0 ? (
        <View style={s.unitRow}>
          {unitParts.map((part) => (
            <View key={part.label} style={s.unitChip}>
              <Ionicons name={part.icon} size={12} color={theme.colors.text.muted} />
              <UIText variant="caption" color="secondary">{part.label}</UIText>
            </View>
          ))}
        </View>
      ) : null}

      {zoneName ? (
        <View style={s.unitRow}>
          <View style={s.unitChip}>
            <Ionicons name="map-outline" size={12} color={theme.colors.text.muted} />
            <UIText variant="caption" color="secondary">{zoneName}</UIText>
          </View>
        </View>
      ) : null}

      {landmark ? (
        <View style={[s.unitRow, { marginTop: 0 }]}>
          <Ionicons name="flag-outline" size={14} color={theme.colors.text.muted} />
          <UIText variant="body-sm" color="secondary" style={{ flex: 1, textAlign: TEXT_START }}>{landmark}</UIText>
        </View>
      ) : null}

      {instructions ? (
        <View style={s.noteRow}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.status.warning} />
          <UIText variant="body-sm" style={{ flex: 1, textAlign: TEXT_START }}>{instructions}</UIText>
        </View>
      ) : null}

      <View style={s.actionsRow}>
        <Pressable
          onPress={() => { if (navUrl) void Linking.openURL(navUrl); }}
          disabled={!navUrl}
          style={[s.actionBtn, s.navigateBtn, !navUrl && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel={t("driver.navigate")}
        >
          <Ionicons name="navigate" size={16} color="#fff" />
          <UIText color="#fff" variant="label">{t("driver.navigate")}</UIText>
        </Pressable>
        {cleanPhone ? (
          <Pressable
            onPress={() => void Linking.openURL(`tel:${cleanPhone}`)}
            style={[s.actionBtn, s.callBtn]}
            accessibilityRole="button"
            accessibilityLabel={t("driver.callCustomer")}
          >
            <Ionicons name="call-outline" size={16} color={theme.colors.text.primary} />
            <UIText variant="label">{t("driver.callCustomer")}</UIText>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

export default DeliveryLocationCard;
