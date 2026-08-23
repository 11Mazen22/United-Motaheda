import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen, Button } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import RouteSummary from "../components/RouteSummary";
import { useDriverOrderDetail } from "../hooks/useDriverManifest";
import { DriverScreenHeader } from "../components/DriverScreenHeader";
import { Ionicons as Ion } from "@expo/vector-icons";

export default function DriverMap({ compact }: { compact?: boolean } = {}): React.ReactElement {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const orderQ = useDriverOrderDetail(orderId);
  const order = orderQ.data;
  const router = useRouter();

  const dest = order && typeof order.customerLat === 'number' && typeof order.customerLng === 'number' ? { lat: order.customerLat, lng: order.customerLng } : undefined;

  if (compact) {
    return (
      <Pressable onPress={() => router.push('/(driver)/map' as never)} style={{ height: 120 }} accessibilityRole="button">
        <View style={[s.mapPreviewCompact, { backgroundColor: kit.color.surface }]}> 
          <View style={s.mapPlaceholderCompact} />
          <View style={s.compactOverlay}>
            <Ion name="navigate" size={16} color="#fff" />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <DriverScreenHeader title="Map" subtitle="Tap to navigate" />

      <View style={s.container}>
        <View style={s.mapBox}>
          {/* Static placeholder for native map; keep rounded edges */}
          <View style={s.mapPlaceholder} />

          <View style={s.mapOverlayRow}>
            <Ion name="locate" size={18} color="#fff" />
            <Button label="Navigate" onPress={() => {
              if (dest) void (window as unknown as { open: (url: string) => void }).open(`https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=driving`);
            }} style={s.navigateBtn} />
          </View>
        </View>

        <View style={s.routeWrap}>
          <RouteSummary driverCoords={undefined} destCoords={dest} />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: kit.inset.screen, paddingTop: 12 },
  mapBox: { borderRadius: 12, overflow: 'hidden', backgroundColor: kit.color.surface, borderWidth: 1, borderColor: kit.color.line, height: 320, justifyContent: 'center', alignItems: 'center', ...kit.shadow.card },
  mapPlaceholder: { width: '100%', height: '100%', backgroundColor: kit.color.well },
  mapOverlayRow: { position: 'absolute', bottom: 12, start: 12, end: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navigateBtn: { paddingHorizontal: 12 },
  routeWrap: { marginTop: 12 },
  mapPreviewCompact: { borderRadius: 12, overflow: 'hidden', height: 120, justifyContent: 'center' },
  mapPlaceholderCompact: { width: '100%', height: '100%', backgroundColor: kit.color.well },
  compactOverlay: { position: 'absolute', start: 12, bottom: 12, backgroundColor: kit.color.accent, padding: 8, borderRadius: 10 },
});
