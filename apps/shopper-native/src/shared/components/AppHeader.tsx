/**
 * AppHeader — reusable top bar for non-tab routes.
 *
 * Spec: HANDOFF.md §2.3. Used by future pharmacy routes (/prescriptions,
 * /reminders, /locator, /health-profile, …) where we want a consistent
 * back-button + title + right-slot + cart-icon-with-badge.
 *
 * Tab screens (home, products, profile) intentionally use richer custom
 * heroes and do NOT mount AppHeader.
 *
 * // HANDOFF: deviated from §2.3 snippet which imports Text/Button from
 * // @pharmacy/ui-native — that atom doesn't exist yet (see SPEC §9.1). Using RN
 * // <UIText> styled via theme.fonts/fontSize tokens until the Text atom
 * // lands on Day 2.
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart, BACK_ARROW } from "@/utils/layout";
import { useCartStore } from "@/stores/cart";
import { theme as legacyTheme } from "@pharmacy/design-tokens";

const IS_RTL = isRtl();

export type AppHeaderVariant = "default" | "hero";

export interface AppHeaderProps {
  title?:     string;
  showBack?:  boolean;
  rightSlot?: React.ReactNode;
  /** "default" = light surface; "hero" = transparent over a dark gradient. */
  variant?:   AppHeaderVariant;
  /** Show the cart icon + count badge on the trailing edge. Default true. */
  showCart?:  boolean;
  /** When true, include safe-area top padding. Default true. */
  withInsets?: boolean;
}

export function AppHeader({
  title,
  showBack    = false,
  rightSlot,
  variant     = "default",
  showCart    = true,
  withInsets  = true,
}: AppHeaderProps): React.ReactElement {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { t }     = useTranslation();
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.itemCount());

  const isHero = variant === "hero";
  const fg     = isHero ? theme.colors.text.inverse : theme.colors.text.primary;
  const subtle = isHero ? "rgba(255,255,255,0.85)" : theme.colors.text.primary;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: withInsets ? insets.top : 0 },
        isHero ? null : styles.containerDefault,
      ]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}>
            {/* BACK_ARROW: arrow-back in LTR, arrow-forward in RTL.
                Ionicons glyphs aren't auto-mirrored by I18nManager. */}
            <Ionicons name={BACK_ARROW} size={20} color={subtle} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}

        {title ? (
          <UIText
            numberOfLines={1}
            style={[
              styles.title,
              { color: fg, fontFamily: legacyTheme.fonts.extrabold },
            ]}>
            {title}
          </UIText>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        <View style={styles.rightCluster}>
          {rightSlot}
          {showCart && (
            <Pressable
              onPress={() => router.push("/(customer)/(tabs)/cart")}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={cartCount > 0 ? t("common.cartWithCount", { count: cartCount }) : t("common.cartLabel")}>
              <Ionicons name="bag-outline" size={22} color={subtle} />
              {cartCount > 0 && (
                <View
                  style={[
                    styles.badge,
                    {
                      borderColor: isHero
                        ? theme.colors.text.primary
                        : theme.colors.canvas.surface,
                    },
                  ]}>
                  <UIText style={styles.badgeText}>
                    {cartCount > 9 ? "9+" : cartCount}
                  </UIText>
                </View>
              )}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: "transparent",
    },
    containerDefault: {
      backgroundColor: theme.colors.canvas.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border.default,
    },
    row: {
      flexDirection:     flexRow(isRtl()),
      alignItems:        "center",
      justifyContent:    "space-between",
      height:            legacyTheme.layout.headerHeight,
      paddingHorizontal: legacyTheme.layout.pagePaddingH,
    },
    iconBtn: {
      width:          legacyTheme.layout.iconButtonSize,
      height:         legacyTheme.layout.iconButtonSize,
      alignItems:     "center",
      justifyContent: "center",
      position:       "relative",
    },
    title: {
      flex:          1,
      textAlign:     textAlignStart(isRtl()),
      fontSize:      theme.typography.sizes[24],
      letterSpacing: -0.4,
      marginHorizontal: theme.spacing[1],
    },
    rightCluster: {
      flexDirection: flexRow(isRtl()),
      alignItems:    "center",
      gap:           2,
    },
    badge: {
      position:          "absolute",
      top:               6,
      // RTL: badge on right edge; LTR: badge on left edge (matches ProductCard's
      // top-start badge convention — mirrors instead of double-flipping in RTL).
      ...(IS_RTL ? { end: 4 } : { start: 4 }),
      minWidth:          18,
      height:            18,
      paddingHorizontal: 4,
      borderRadius:      9,
      backgroundColor:   theme.colors.status.error,
      borderWidth:       2,
      alignItems:        "center",
      justifyContent:    "center",
    },
    badgeText: {
      color:               "#fff",
      fontSize:            10,
      lineHeight:          10,        // must equal fontSize — prevents vertical push-down
      fontFamily:          legacyTheme.fonts.extrabold,
      includeFontPadding:  false,     // Android: remove internal font top/bottom padding
      textAlign:           "center",
      textAlignVertical:   "center",
    },
  });
}
