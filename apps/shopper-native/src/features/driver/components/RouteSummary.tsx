import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const aCalc = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
  return R * c;
}

export default function RouteSummary({ driverCoords, destCoords }: { driverCoords?: { lat: number; lng: number } | null; destCoords?: { lat: number; lng: number } | null }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: { flexDirection: flexRow(IS_RTL), justifyContent: "space-between", marginHorizontal: kit.inset.screen, marginBottom: 12, padding: 12, borderRadius: 12, backgroundColor: theme.colors.canvas.surface, borderWidth: 1, borderColor: theme.colors.border.default, ...theme.shadows[1] },
    col: { alignItems: "center", flex: 1 },
  }), [theme]);
  const data = useMemo(() => {
    if (!destCoords) return null;
    let km: number | null = null;
    if (driverCoords) {
      km = haversineKm(driverCoords, destCoords);
    }
    const distance = km != null ? `${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`}` : "—";
    const eta = km != null ? `${Math.max(1, Math.round((km / 30) * 60))} min` : "—"; // assume ~30 km/h average
    return { distance, eta };
  }, [driverCoords, destCoords]);

  return (
    <View style={s.wrap}>
      <View style={s.col}>
        <UIText variant="caption" color="secondary">{t("driver.distance")}</UIText>
        <UIText variant="card-title">{data?.distance ?? "—"}</UIText>
      </View>
      <View style={s.col}>
        <UIText variant="caption" color="secondary">{t("driver.eta")}</UIText>
        <UIText variant="card-title">{data?.eta ?? "—"}</UIText>
      </View>
    </View>
  );
}
