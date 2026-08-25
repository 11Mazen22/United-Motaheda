/**
 * Preset card skeletons — app-specific composite loading placeholders.
 *
 * Design principles:
 *   - Preset card skeletons mirror the EXACT geometry of their real
 *     counterparts (radius 18, padding 14, gap 5) so the transition into
 *     real content causes zero layout reflow.
 *   - All presets layer on the canonical "card" shadow level so the loading
 *     state already feels elevated — no popping the moment data arrives.
 *
 * The base shimmer block itself is the canonical `Skeleton` from
 * `@pharmacy/ui-native` — these are just app-specific compositions of it.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Skeleton, useTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";

const _isRtl = isRtl();

// ─── Preset skeletons ─────────────────────────────────────────────────────────
// Geometry matches the real components 1:1 — when data arrives, the
// transition is invisible (no width/height/radius shift).

export function ProductCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{
      backgroundColor: theme.colors.canvas.surface,
      borderRadius:    18,                // matches ProductCard.gridCard
      overflow:        "hidden",
      ...theme.shadows[1],
    }}>
      {/* Image area — matches ProductCard.imgBox (170h, surfaceMuted bg) */}
      <View style={{ height: 170, backgroundColor: theme.colors.canvas.surfaceMuted, padding: 14, gap: 8, justifyContent: "flex-end" }}>
        {/* Wishlist heart tile placeholder (top-right) */}
        <View style={{ position: "absolute", top: 10, end: 10 }}>
          <Skeleton width={32} height={32} borderRadius={11} />
        </View>
      </View>
      {/* Info area — matches ProductCard.gridInfo (padding 14, gap 5) */}
      <View style={{ padding: 14, gap: 8 }}>
        <Skeleton width="40%" height={10} borderRadius={6} />
        <Skeleton width="85%" height={13} borderRadius={6} />
        <Skeleton width="60%" height={13} borderRadius={6} />
        <View style={{ flexDirection: flexRow(_isRtl), justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
          <View style={{ gap: 4, alignItems: "flex-end" }}>
            <Skeleton width={64} height={18} borderRadius={6} />
          </View>
          <Skeleton width={38} height={38} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

export function CategoryCardSkeleton() {
  const { theme } = useTheme();
  // matches CategoryCard.pill — 104w × 168h × radius["2xl"] (22)
  return <Skeleton width={104} height={168} borderRadius={theme.radii["2xl"]} />;
}

export function OrderCardSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{
      backgroundColor: theme.colors.canvas.surface,
      borderRadius:    18,
      padding:         18,
      gap:             14,
      ...theme.shadows[1],
    }}>
      {/* Header row — icon tile + identity stack + status badge */}
      <View style={{ flexDirection: flexRow(_isRtl), justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flexDirection: flexRow(_isRtl), gap: 10, alignItems: "center" }}>
          <Skeleton width={34} height={34} borderRadius={11} />
          <View style={{ gap: 4 }}>
            <Skeleton width={64} height={9}  borderRadius={4} />
            <Skeleton width={92} height={14} borderRadius={6} />
            <Skeleton width={80} height={10} borderRadius={4} />
          </View>
        </View>
        <Skeleton width={72} height={22} borderRadius={999} />
      </View>
      {/* Items preview row */}
      <View style={{
        backgroundColor: theme.colors.canvas.surfaceMuted,
        borderRadius: legacyTheme.radius.lg,
        padding: 12,
        flexDirection: flexRow(_isRtl),
        alignItems: "center",
        gap: 12,
      }}>
        <Skeleton width={54} height={54} borderRadius={legacyTheme.radius.md} />
        <View style={{ flex: 1, gap: 5 }}>
          <Skeleton width="70%" height={11} borderRadius={5} />
          <Skeleton width="40%" height={9}  borderRadius={4} />
        </View>
      </View>
      {/* Footer — total */}
      <View style={{
        flexDirection: flexRow(_isRtl),
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.colors.border.default,
      }}>
        <Skeleton width={56} height={11} borderRadius={5} />
        <Skeleton width={88} height={17} borderRadius={6} />
      </View>
    </View>
  );
}
