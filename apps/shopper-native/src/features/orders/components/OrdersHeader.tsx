/**
 * OrdersHeader — shared gradient hero for every Orders-tab state (populated
 * list, loading, error, and empty). Previously the empty state alone used a
 * separate plain AppHeader, which meant a brand-new customer — the exact
 * account state a demo runs into — never saw the redesigned header at all.
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme, gradients } from "@pharmacy/design-tokens";

import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import type { Order } from "@/stores/orders";

export function OrdersHeader({
  t, insetsTop, orders, showBack, onBack,
}: {
  t:         (key: string, opts?: Record<string, unknown>) => string;
  insetsTop: number;
  orders:    Order[];
  showBack:  boolean;
  onBack:    () => void;
}) {
  const { theme } = useTheme();
  const h = useMemo(() => getHeaderStyles(theme), [theme]);
  const total     = orders.length;
  const active    = orders.filter((o) => !["delivered", "cancelled"].includes(o.status)).length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const { pagePad } = useScreenLayout();

  return (
    <LinearGradient
      colors={gradients.brandPrimary as unknown as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[h.header, { paddingTop: insetsTop + 14, paddingHorizontal: pagePad }]}
    >
      {/* Top row — back + icon tile + title block */}
      <View style={[h.topRow, { flexDirection: flexRow(isRtl()) }]}>
        {showBack ? (
          <Pressable
            onPress={onBack}
            style={h.backBtnTouchable}
            accessibilityRole="button"
            hitSlop={8}>
            {({ pressed }) => (
              <View style={[h.backBtn, pressed && h.backBtnPressed]}>
                <Ionicons name={BACK_CHEVRON} size={18} color="#fff" />
              </View>
            )}
          </Pressable>
        ) : null}

        <View style={h.iconTile}>
          <Ionicons name="bag-handle-outline" size={22} color="#fff" />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <UIText style={h.eyebrow}>{t("orders.eyebrow")}</UIText>
          <UIText numberOfLines={1} style={h.title}>{t("orders.title")}</UIText>
        </View>
      </View>

      {/* Inline stat band — glass pills on the gradient, matching the same
          hero-stat treatment now shared with Pharmacist's Workbench header. */}
      <View style={[h.statsRow, { flexDirection: flexRow(isRtl()) }]}>
        <View style={h.statCell}>
          <View style={h.statIconWell}>
            <Ionicons name="bag-handle-outline" size={13} color="#fff" />
          </View>
          <UIText style={h.statVal}>{total}</UIText>
          <UIText style={h.statLbl} numberOfLines={1}>{t("orders.countOrders", { count: total })}</UIText>
        </View>

        <View style={h.statCell}>
          <View style={h.statIconWell}>
            <Ionicons name="refresh-outline" size={13} color="#fff" />
          </View>
          <UIText style={h.statVal}>{active}</UIText>
          <UIText style={h.statLbl} numberOfLines={1}>{t("orders.processing")}</UIText>
        </View>

        <View style={h.statCell}>
          <View style={h.statIconWell}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#fff" />
          </View>
          <UIText style={h.statVal}>{delivered}</UIText>
          <UIText style={h.statLbl} numberOfLines={1}>{t("orders.delivered")}</UIText>
        </View>
      </View>
    </LinearGradient>
  );
}

function getHeaderStyles(theme: NativeTheme) {
  return StyleSheet.create({
    // paddingHorizontal is set inline via useScreenLayout().pagePad for breakpoint-aware gutter.
    // Gradient hero -- same brand treatment now shared with Home's TodayCare,
    // Pharmacist's Workbench header, and Driver's manifest hero, instead of
    // the plain white bar this used to be.
    header: {
      paddingBottom: 18,
      gap:           16,
      ...theme.shadows[2],
    },

    // Top row
    topRow: {
      alignItems: "center",
      gap:        14,
    },
    // Touchable wrapper carries only sizing/radius — visual styling lives on
    // the plain View inside instead of on the Pressable's own function-computed
    // style, which is unreliable under this app's RN/Fabric setup.
    backBtnTouchable: {
      width:        40,
      height:       40,
      borderRadius: 20,
      flexShrink:   0,
    },
    backBtn: {
      width:           40,
      height:          40,
      borderRadius:    20,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems:      "center",
      justifyContent:  "center",
      flexShrink:      0,
    },
    backBtnPressed: {
      opacity:   0.82,
      transform: [{ scale: 0.96 }],
    },
    eyebrow: {
      fontFamily:         legacyTheme.fonts.bold,
      fontSize:           10,
      lineHeight:         14,
      color:              "rgba(255,255,255,0.75)",
      letterSpacing:      0.5,
      textAlign:          textAlignStart(isRtl()),
      includeFontPadding: false,
    },
    title: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           28,
      lineHeight:         36,
      color:              "#fff",
      letterSpacing:      -0.6,
      textAlign:          textAlignStart(isRtl()),
      includeFontPadding: false,
    },
    iconTile: {
      width:           52,
      height:          52,
      borderRadius:    16,
      backgroundColor: "rgba(255,255,255,0.16)",
      alignItems:      "center",
      justifyContent:  "center",
      flexShrink:      0,
    },

    // Stat band — glass pills on the gradient
    statsRow: {
      gap: 10,
    },
    statCell: {
      flex:            1,
      minWidth:        0,
      alignItems:      "center",
      justifyContent:  "center",
      gap:             4,
      paddingVertical: 14,
      borderRadius:    14,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    statIconWell: {
      width:           28,
      height:          28,
      borderRadius:    9,
      alignItems:      "center",
      justifyContent:  "center",
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    statVal: {
      fontFamily:         legacyTheme.fonts.black,
      fontSize:           20,
      lineHeight:         26,
      color:              "#fff",
      letterSpacing:      -0.4,
      includeFontPadding: false,
    },
    statLbl: {
      fontFamily:         legacyTheme.fonts.semibold,
      fontSize:           9,
      lineHeight:         13,
      color:              "rgba(255,255,255,0.8)",
      textAlign:          "center",
      includeFontPadding: false,
    },
  });
}
