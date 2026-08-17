/**
 * HomeSkeleton — loading placeholder for the customer home page.
 *
 * Rendered while initial data is loading. Matches the exact geometry
 * of the real home sections to prevent layout shift when content arrives.
 *
 * Covers:
 *   1. Hero card shape (gradient card + search bar + 3 action cards)
 *   2. Section header row
 *   3. Category strip (6 tiles)
 *   4. Two product card placeholders
 *
 * Uses the existing Skeleton primitive from src/components/ui/Skeleton.tsx.
 * All dimensions mirror the real components exactly.
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { kit } from "@pharmacy/ui-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useScreenLayout } from "@/utils/responsive";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

// ─── HomeSkeleton ─────────────────────────────────────────────────────────────

export const HomeSkeleton = memo(function HomeSkeleton() {
  const { pagePad, width } = useScreenLayout();

  return (
    <View style={s.root} accessibilityLabel="تحميل..." accessibilityLiveRegion="polite">
      {/* ── Hero card skeleton ── */}
      <View style={[s.heroWrap, { marginHorizontal: pagePad }]}>
        <View style={s.heroCard}>
          {/* Headline */}
          <View style={s.heroText}>
            <Skeleton width="70%" height={24} radius={8} />
            <Skeleton width="50%" height={16} radius={6} style={{ marginTop: 6 }} />
          </View>

          {/* Search bar */}
          <Skeleton width="100%" height={52} radius={14} style={s.searchSkel} />

          {/* Quick actions row */}
          <View style={s.actionsRow}>
            <Skeleton width="31%" height={100} radius={14} />
            <Skeleton width="31%" height={100} radius={14} />
            <Skeleton width="31%" height={100} radius={14} />
          </View>
        </View>
      </View>

      {/* ── Section header row ── */}
      <View style={[s.sectionHeader, { paddingHorizontal: pagePad }]}>
        <View style={[s.sectionHeaderLeft, { flexDirection: flexRow(IS_RTL) }]}>
          <Skeleton width={44} height={44} radius={14} />
          <View style={s.sectionHeaderText}>
            <Skeleton width={60} height={10} radius={4} />
            <Skeleton width={120} height={18} radius={6} style={{ marginTop: 4 }} />
          </View>
        </View>
        <Skeleton width={72} height={30} radius={999} />
      </View>

      {/* ── Category strip ── */}
      <View style={[s.categoryStrip, { paddingHorizontal: pagePad }]}>
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <View key={k} style={s.categoryItem}>
            <Skeleton width={72} height={72} radius={18} />
            <Skeleton width={60} height={10} radius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>

      {/* ── Product cards row ── */}
      <View style={[s.productRow, { paddingHorizontal: pagePad }]}>
        {[1, 2].map((k) => (
          <View key={k} style={[s.productCard, { width: (width - pagePad * 2 - 12) / 2 }]}>
            <Skeleton width="100%" height={150} radius={16} />
            <View style={s.productCardInfo}>
              <Skeleton width="60%" height={10} radius={4} />
              <Skeleton width="80%" height={13} radius={5} style={{ marginTop: 4 }} />
              <Skeleton width="40%" height={18} radius={6} style={{ marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 8,
    gap: 24,
  },

  // Hero
  heroWrap: {
    // mirrors HomeHero paddingTop
  },
  heroCard: {
    backgroundColor: kit.color.well,
    borderRadius:    24,
    paddingTop:      24,
    paddingBottom:   20,
    paddingHorizontal: 20,
    gap:             16,
  },
  heroText: {
    gap: 0,
  },
  searchSkel: {
    // height matches new 52px search bar
  },
  actionsRow: {
    flexDirection:  flexRow(IS_RTL),
    gap:            8,
    justifyContent: "space-between",
  },

  // Section header
  sectionHeader: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    justifyContent: "space-between",
    minHeight:      44,
  },
  sectionHeaderLeft: {
    alignItems: "center",
    gap:        12,
  },
  sectionHeaderText: {
    gap: 0,
  },

  // Category strip
  categoryStrip: {
    flexDirection: flexRow(IS_RTL),
    gap:           10,
    paddingVertical: 4,
  },
  categoryItem: {
    alignItems: "center",
    gap:        4,
  },

  // Product row
  productRow: {
    flexDirection: flexRow(IS_RTL),
    gap:           12,
  },
  productCard: {
    gap: 0,
  },
  productCardInfo: {
    paddingTop: 10,
    gap:        0,
  },
});
