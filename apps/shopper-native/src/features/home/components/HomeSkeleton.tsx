/**
 * HomeSkeleton — loading placeholder for the customer home page.
 *
 * Rendered while initial data is loading. Matches the geometry of the real
 * Hero (dark gradient + search bar + Rx row) and section list to avoid
 * layout shift when content arrives. Theme-driven for light/dark.
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Skeleton as KitSkeleton } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { useScreenLayout } from "@/utils/responsive";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

export const HomeSkeleton = memo(function HomeSkeleton() {
  const { pagePad, width } = useScreenLayout();

  return (
    <View style={s.root} accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      {/* Hero skeleton — mirrors the real dark gradient hero's shape */}
      <View style={s.heroWrap}>
        <LinearGradient
          colors={gradients.heroPrimary as unknown as [string, string, string]}
          style={[s.heroCard, { paddingHorizontal: pagePad }]}
        >
          <View style={{ paddingTop: 96, gap: 14 }}>
            <View style={{ gap: 6 }}>
              <View style={[s.line, { width: "40%", backgroundColor: "rgba(255,255,255,0.18)" }]} />
              <View style={[s.line, { width: "70%", height: 22, backgroundColor: "rgba(255,255,255,0.24)" }]} />
            </View>
            <View style={[s.searchSkel, { backgroundColor: "rgba(255,255,255,0.14)" }]} />
            <View style={[s.line, { width: "50%", backgroundColor: "rgba(255,255,255,0.16)" }]} />
          </View>
        </LinearGradient>
      </View>

      {/* Section header row */}
      <View style={[s.sectionHeader, { paddingHorizontal: pagePad }]}>
        <View style={[s.sectionHeaderLeft, { flexDirection: flexRow(IS_RTL) }]}>
          <KitSkeleton width={44} height={44} borderRadius={14} />
          <View style={{ gap: 4 }}>
            <KitSkeleton width={60} height={10} borderRadius={4} />
            <KitSkeleton width={120} height={18} borderRadius={6} />
          </View>
        </View>
        <KitSkeleton width={72} height={30} borderRadius={999} />
      </View>

      {/* Category strip */}
      <View style={[s.categoryStrip, { paddingHorizontal: pagePad }]}>
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <View key={k} style={{ alignItems: "center", gap: 6 }}>
            <KitSkeleton variant="circle" width={72} height={72} />
            <KitSkeleton width={60} height={10} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Product cards row */}
      <View style={[s.productRow, { paddingHorizontal: pagePad }]}>
        {[1, 2].map((k) => (
          <View key={k} style={{ width: (width - pagePad * 2 - 12) / 2, gap: 0 }}>
            <KitSkeleton width="100%" height={150} borderRadius={16} />
            <View style={{ paddingTop: 10, gap: 6 }}>
              <KitSkeleton width="60%" height={10} borderRadius={4} />
              <KitSkeleton width="80%" height={13} borderRadius={5} />
              <KitSkeleton width="40%" height={18} borderRadius={6} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, gap: 24 },
  heroWrap: { overflow: "hidden" },
  heroCard: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: 24 },
  line: { height: 14, borderRadius: 6 },
  searchSkel: { height: 52, borderRadius: 26 },
  sectionHeader: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  sectionHeaderLeft: { alignItems: "center", gap: 12 },
  categoryStrip: { flexDirection: flexRow(IS_RTL), gap: 10, paddingVertical: 4 },
  productRow: { flexDirection: flexRow(IS_RTL), gap: 12 },
});
