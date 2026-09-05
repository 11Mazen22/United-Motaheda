import React from "react";
import { View } from "react-native";
import { SkeletonCard } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export function DashboardSkeleton(): React.ReactElement {
  const pagePad = kit.inset.screen;

  return (
    <View>
      <SkeletonCard lines={1} style={{ height: 180, borderRadius: 28, marginBottom: 16 }} />
      <View style={{ flexDirection: flexRow(IS_RTL), gap: 10, marginBottom: 12, paddingHorizontal: pagePad }}>
        <SkeletonCard lines={1} style={{ flex: 1, height: 72, borderRadius: 16 }} />
        <SkeletonCard lines={1} style={{ flex: 1, height: 72, borderRadius: 16 }} />
        <SkeletonCard lines={1} style={{ flex: 1, height: 72, borderRadius: 16 }} />
      </View>
      <View style={{ paddingHorizontal: pagePad }}>
        <SkeletonCard lines={3} style={{ height: 200, borderRadius: 20 }} />
      </View>
      <View style={{ paddingHorizontal: pagePad, marginTop: 16 }}>
        <SkeletonCard lines={2} style={{ height: 160, borderRadius: 20 }} />
      </View>
    </View>
  );
}

export function QueueSkeleton({ count = 3 }: { count?: number }): React.ReactElement {
  const pagePad = kit.inset.screen;

  return (
    <View>
      <View style={{ flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: pagePad, marginTop: 20, marginBottom: 8 }}>
        <View style={{ width: 140, height: 18, borderRadius: 8, backgroundColor: "#E2E8F0" }} />
        <View style={{ width: 60, height: 14, borderRadius: 6, backgroundColor: "#E2E8F0" }} />
      </View>
      <View style={{ paddingHorizontal: pagePad, gap: 12 }}>
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} lines={3} style={{ borderRadius: 16 }} />
        ))}
      </View>
    </View>
  );
}

export default DashboardSkeleton;
