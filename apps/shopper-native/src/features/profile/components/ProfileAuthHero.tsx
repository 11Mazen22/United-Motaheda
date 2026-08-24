/**

 * ProfileAuthHero — premium hero for authenticated users.

 *

 * Performance wins vs. previous version:

 *   - StatPill press:          Reanimated withSpring(0.97) on UI thread

 *     (was `({ pressed }) => [style, pressed && { opacity, scale }]` — JS thread)

 *   - QuickActionTile press:   Reanimated withSpring(0.94) on UI thread

 *     (was same JS-thread pattern)

 *   - QuickActionTile extracted as memo'd component so each tile owns its

 *     useSharedValue — parent re-renders never recreate the animation state

 *   - All onPress handlers: useCallback at component level, passed as stable refs

 *

 * Visual upgrades (2026):

 *   - avatarRing: subtle white hairline ring behind the tier-colour glow

 *   - quickCardIcon: LinearGradient fill instead of flat brand.lighter surface

 *   - heroDecor4: new fourth decorative orb added via profile.styles.ts

 */

import React, { memo, useCallback } from "react";

import { Platform, Pressable, StyleSheet, View } from "react-native";

import { Image } from "expo-image";


import { Ionicons } from "@expo/vector-icons";

import Animated, {

  useAnimatedStyle,

  useSharedValue,

  withSpring,

} from "react-native-reanimated";

import { useRouter } from "expo-router";

import { useTranslation } from "react-i18next";

import * as Haptics from "expo-haptics";

import { Text as UIText } from "@pharmacy/ui-native";

import { defaultTheme as theme } from "@pharmacy/ui-native";

import { flexRow, isRtl, FORWARD_CHEVRON } from "@/utils/layout";

import { styles, HERO_GLASS, PROFILE } from "./profile.styles";



const PRESS_SPRING = { damping: 18, stiffness: 360, mass: 0.7 } as const;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];



interface HeroUser {

  name?:      string | null;

  email:      string;

  avatarUrl?: string;

}



interface LastOrder {

  id:     string;

  items:  readonly unknown[];

  total:  number;

}



interface ProfileAuthHeroProps {

  user:          HeroUser;

  orderCount:    number;

  wishlistCount: number;

  cartCount:     number;

  lastOrder:     LastOrder | null;

  insetsTop:     number;

}



// ─── StatPill — Reanimated UI-thread scale ────────────────────────────────────



const StatPill = memo(function StatPill({

  value, label, icon, accent, onPress,

}: {

  value:   string | number;

  label:   string;

  icon:    IoniconsName;

  accent:  string;

  onPress: () => void;

}) {

  const scale = useSharedValue(1);

  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));



  const handleIn    = useCallback(() => { scale.value = withSpring(0.97, PRESS_SPRING); }, [scale]);

  const handleOut   = useCallback(() => { scale.value = withSpring(1,   PRESS_SPRING); }, [scale]);

  const handlePress = useCallback(() => {

    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});

    onPress();

  }, [onPress]);



  return (

    <Pressable

      onPress={handlePress}

      onPressIn={handleIn}

      onPressOut={handleOut}

      accessibilityRole="button"

      accessibilityLabel={`${label}: ${value}`}

      style={styles.statCol}>

      <Animated.View style={[sp.inner, anim]}>

        <View style={[

          styles.statIconWrap,

          { backgroundColor: `${accent}14`, borderColor: `${accent}26` },

        ]}>

          <Ionicons name={icon} size={15} color={accent} />

        </View>

        <UIText variant="card-title" weight="black" style={styles.statValueNew}>

          {value}

        </UIText>

        <UIText variant="eyebrow" color="tertiary">

          {label}

        </UIText>

      </Animated.View>

    </Pressable>

  );

});



// ─── QuickActionTile — Reanimated UI-thread scale ─────────────────────────────



interface TileProps {

  icon:     IoniconsName;

  labelKey: string;

  grad:     readonly [string, string];

  route:    string;

  onPress:  (route: string) => void;

}



const QuickActionTile = memo(function QuickActionTile({

  icon, labelKey, grad, route, onPress,

}: TileProps) {

  const { t } = useTranslation();

  const scale = useSharedValue(1);

  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));



  // 0.94 — more aggressive press for tiles vs. rows (0.985) / cards (0.97)

  const handleIn    = useCallback(() => { scale.value = withSpring(0.94, PRESS_SPRING); }, [scale]);

  const handleOut   = useCallback(() => { scale.value = withSpring(1,   PRESS_SPRING); }, [scale]);

  const handlePress = useCallback(() => {

    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});

    onPress(route);

  }, [route, onPress]);



  return (

    <Pressable

      onPress={handlePress}

      onPressIn={handleIn}

      onPressOut={handleOut}

      accessibilityRole="button"

      accessibilityLabel={t(labelKey)}

      style={styles.quickGridItem}>

      <Animated.View style={[qt.iconWrap, anim]}>

        <View style={[styles.quickGridIconWrap, { backgroundColor: grad[0] }]}>

          <View style={styles.quickGridShine} />

          <Ionicons name={icon} size={22} color={HERO_GLASS.w95} />

        </View>

      </Animated.View>

      <UIText variant="caption" weight="bold" align="center" color="secondary">

        {t(labelKey)}

      </UIText>

    </Pressable>

  );

});



// ─── Module-level quick actions (zero re-allocation per render) ───────────────



const QUICK_ACTIONS = [

  {

    icon:     "bag-handle-outline" as IoniconsName,

    labelKey: "profile.myOrders",

    grad:     [theme.colors.brand.primary, theme.colors.brand.primary] as const,

    route:    "/orders",

  },

  {

    icon:     "heart-outline" as IoniconsName,

    labelKey: "profile.wishlist",

    grad:     [PROFILE.wishlistRed, theme.colors.status.error] as const,

    route:    "/favorites",

  },

  {

    icon:     "pricetag-outline" as IoniconsName,

    labelKey: "profile.offers",

    grad:     [PROFILE.loyaltyViolet, PROFILE.loyaltyPurple] as const,

    route:    "/offers",

  },

  {

    icon:     "location-outline" as IoniconsName,

    labelKey: "profile.addresses",

    grad:     [theme.colors.status.warning, "#f59e0b"] as const,

    route:    "/addresses",

  },

] as const;



// ─── ProfileAuthHero ──────────────────────────────────────────────────────────



export const ProfileAuthHero = memo(function ProfileAuthHero({

  user,

  orderCount,

  wishlistCount,

  cartCount,

  lastOrder,

  insetsTop,

}: ProfileAuthHeroProps) {

  const router = useRouter();

  const { t }  = useTranslation();



  // Stable per-destination handlers — QuickActionTile memo never re-renders

  // when unrelated hero state changes.

  const goCart     = useCallback(() => router.push("/(customer)/(tabs)/cart"),    [router]);

  const goSettings = useCallback(() => router.push("/notifications"),  [router]);

  const goOrders   = useCallback(() => router.push("/orders"),         [router]);

  const goWishlist = useCallback(() => router.push("/favorites"),      [router]);



  // Single stable handler passed to every QuickActionTile

  const goRoute = useCallback(

    (route: string) => router.push(route as Parameters<typeof router.push>[0]),

    [router],

  );



  return (

    <View>

      <View style={[styles.hero, { backgroundColor: theme.colors.text.primary, paddingTop: insetsTop + 14 }]}>



        {/* Four layered decorative orbs + stripe for depth */}

        <View style={styles.heroDecor1} />

        <View style={styles.heroDecor2} />

        <View style={styles.heroDecor3} />

        <View style={styles.heroDecor4} />

        <View style={styles.heroDecorStripe} />



        {/* Top bar — title + cart + settings */}

        <View style={styles.heroTopBar}>

          <View style={tb.start}>

            <UIText variant="eyebrow" style={styles.heroPageLabelNew}>{t("profile.title")}</UIText>

          </View>

          <View style={tb.end}>

            <Pressable

              onPress={goCart}

              accessibilityRole="button"

              accessibilityLabel={t("tabs.cart")}

              style={styles.heroIconBtn}>

              <Ionicons name="bag-outline" size={16} color={HERO_GLASS.w80} />

              {cartCount > 0 && (

                <View style={styles.heroIconBadge}>

                  <UIText variant="eyebrow" style={styles.heroIconBadgeText}>

                    {cartCount > 9 ? "9+" : cartCount}

                  </UIText>

                </View>

              )}

            </Pressable>

            <Pressable

              onPress={goSettings}

              accessibilityRole="button"

              accessibilityLabel={t("profile.settings")}

              style={styles.heroIconBtn}>

              <Ionicons name="settings-outline" size={16} color={HERO_GLASS.w80} />

            </Pressable>

          </View>

        </View>



        {/* Avatar + identity — asymmetric horizontal layout */}

        <View style={styles.heroIdentity}>

          {/* Avatar column */}

          <View style={styles.avatarContainer}>

            {/*

              avatarRing: subtle white hairline ring rendered behind the glow —

              adds perceived depth. Must be first child so it sits behind it.

            */}

            <View style={styles.avatarRing} />

            <View style={[styles.avatarGlow, { backgroundColor: theme.colors.brand.primary }]} />

            {user.avatarUrl ? (

              <Image

                source={{ uri: user.avatarUrl }}

                style={styles.avatar}

                contentFit="cover"

                transition={150}

              />

            ) : (

              <View style={styles.avatar}>

                <UIText style={styles.avatarLetter}>

                  {(user.name ?? user.email)?.[0]?.toUpperCase() ?? "U"}

                </UIText>

              </View>

            )}

          </View>



          {/* Identity column — name, email, tier chip stacked beside avatar */}

          <View style={styles.heroIdentityCol}>

            <View style={styles.heroTextGroup}>

              <UIText variant="sheet-title" color="inverse" numberOfLines={1} style={styles.userNameNew}>

                {user.name ?? t("profile.userFallback")}

              </UIText>

              <UIText variant="body-sm" color="inverse-muted" numberOfLines={1}>

                {user.email}

              </UIText>

            </View>

          </View>

        </View>

      </View>



      {/* Stats card (overlaps hero) */}

      <View style={styles.statsCard}>

        <StatPill

          value={orderCount}

          label={t("profile.statOrders")}

          icon="bag-handle-outline"

          accent={theme.colors.brand.primary}

          onPress={goOrders}

        />

        <View style={styles.statDivider} />

        <StatPill

          value={wishlistCount}

          label={t("profile.statWishlist")}

          icon="heart-outline"

          accent={theme.colors.status.error}

          onPress={goWishlist}

        />

        <View style={styles.statDivider} />

        <StatPill

          value={cartCount}

          label={t("profile.statCart")}

          icon="cart-outline"

          accent={theme.colors.status.warning}

          onPress={goCart}

        />

      </View>



      {/* Last order quick-peek */}

      {lastOrder && (

        <View style={styles.quickCardWrap}>

          {/* Bare Pressable — visual row layout (incl. `gap`) lives on the

              inner View via function-as-children. A raw Pressable whose own

              function-computed `style` mixes `gap` + row flexDirection has

              caused real layout corruption elsewhere in this app. */}

          <Pressable onPress={goOrders} style={lo.touchable}>

            {({ pressed }) => (

              <View style={[styles.quickCard, pressed && lo.pressed]}>

                {/*

                  quickCardIcon: LinearGradient background instead of flat brand.lighter

                  — adds more visual depth and premium feel to the icon container.

                */}

                <View style={[styles.quickCardIcon, { backgroundColor: theme.colors.brand.primaryLight }]}>

                  <Ionicons name="bag-handle" size={17} color={theme.colors.brand.primary} />

                </View>

                <View style={lo.info}>

                  <View style={lo.nameRow}>

                    <UIText variant="body-sm" weight="bold" align="right">

                      {t("profile.lastOrderCard")}

                    </UIText>

                    <View style={styles.statusDot} />

                  </View>

                  <UIText variant="caption" color="tertiary" align="right" style={styles.quickCardSubNew}>

                    #{lastOrder.id.slice(-6)}{"  "}•{"  "}

                    {t("orders.items", { count: lastOrder.items.length })}{"  "}•{"  "}

                    {lastOrder.total.toFixed(0)} {t("common.currency")}

                  </UIText>

                </View>

                <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.text.muted} />

              </View>

            )}

          </Pressable>

        </View>

      )}



      {/* Quick action grid */}

      <View style={styles.quickGrid}>

        {QUICK_ACTIONS.map((a) => (

          <QuickActionTile

            key={a.route}

            icon={a.icon}

            labelKey={a.labelKey}

            grad={a.grad}

            route={a.route}

            onPress={goRoute}

          />

        ))}

      </View>

    </View>

  );

});



// ─── Local styles ─────────────────────────────────────────────────────────────



// StatPill inner: Animated.View wraps the visual content so the scale

// worklet can run on the UI thread. The outer Pressable keeps a fixed touch

// target (flex:1) that doesn't scale with the animation.

const sp = StyleSheet.create({

  inner: {

    alignItems: "center",

    gap:        6,

  },

});



// QuickActionTile icon wrapper — shadow/elevation lives here (no overflow:hidden)

// so the gradient tile can clip its corners independently.

const qt = StyleSheet.create({

  iconWrap: {

    borderRadius:  20,

    shadowColor:   PROFILE.shadowDark,

    shadowOffset:  { width: 0, height: 4 },

    shadowOpacity: 0.22,

    shadowRadius:  10,

    elevation:     5,

  },

});



// Top-bar flex rows

const tb = StyleSheet.create({

  start: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 8 },

  end: { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 8 },

});



// Last-order info block

const lo = StyleSheet.create({

  touchable: { borderRadius: 16 },

  pressed:   { opacity: 0.88 },

  info:      { flex: 1 },

  nameRow:   { flexDirection: flexRow(isRtl()), alignItems: "center", gap: 6 },

});

