import { useTheme } from "@pharmacy/ui-native";
import React, { useEffect, useMemo } from "react";

import { Platform, Pressable, ScrollView, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import Animated, {

  FadeInDown,

  useAnimatedStyle,

  useReducedMotion,

  useSharedValue,

  withRepeat,

  withSequence,

  withTiming,

} from "react-native-reanimated";

import * as Haptics from "expo-haptics";

import { useRouter } from "expo-router";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTranslation } from "react-i18next";

import { Text as UIText } from "@pharmacy/ui-native";

import { OrdersHeader } from "./OrdersHeader";

import { Button } from "@pharmacy/ui-native";

import { getOrdersStyles } from "./orders.styles";

export function EmptyOrdersState({ showBack }: { showBack: boolean }): React.ReactElement {
  const { theme } = useTheme();
  const { emptyS } = useMemo(() => getOrdersStyles(theme), [theme]);
  // Category chips — kit semantic tints
  const CAT_CHIPS = useMemo(() => [
    { icon: "leaf-outline"     as const, labelKey: "home.qaVitamins", color: theme.colors.status.success, bg: theme.colors.statusSoft.success.bg },
    { icon: "sparkles-outline" as const, labelKey: "home.qaMomBaby",  color: theme.colors.status.warning, bg: theme.colors.statusSoft.warning.bg },
    { icon: "medkit-outline"   as const, labelKey: "home.qaRx",       color: theme.colors.brand.primary,  bg: theme.colors.brand.primaryLight },
  ] as const, [theme]);

  const router  = useRouter();

  const insets  = useSafeAreaInsets();

  const { t }   = useTranslation();

  const goBack  = () => router.back();

  const reduced = useReducedMotion();



  const floatY = useSharedValue(0);

  useEffect(() => {

    if (reduced) return;

    floatY.value = withRepeat(

      withSequence(withTiming(-9, { duration: 2000 }), withTiming(0, { duration: 2000 })),

      -1, false,

    );

  }, [floatY, reduced]);

  const floatAnim = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));



  return (

    <View style={{ flex: 1, backgroundColor: theme.colors.canvas.background }}>

      <OrdersHeader t={t} insetsTop={insets.top} orders={[]} showBack={showBack} onBack={goBack} />

      <ScrollView

        contentContainerStyle={[emptyS.container, { paddingBottom: insets.bottom + 40 }]}

        showsVerticalScrollIndicator={false}>



        <Animated.View style={[emptyS.illusWrap, floatAnim]}>

          <View style={emptyS.illusBg}>

            <View style={emptyS.illusRing}>

              <Ionicons name="bag-handle-outline" size={64} color={theme.colors.brand.primary} />

            </View>

            <View style={emptyS.illusBadge}>

              <Ionicons name="add" size={14} color={theme.colors.text.inverse} />

            </View>

          </View>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(420).delay(80)} style={emptyS.textBlock}>

          <UIText variant="sheet-title" align="center" style={emptyS.headline}>

            {t("orders.emptyHeadline")}

          </UIText>

          <UIText variant="body-sm" color="secondary" align="center" style={emptyS.sub}>

            {t("orders.emptyDescription")}

          </UIText>

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(400).delay(160)}>

          <Button

            label={t("common.shopNow")}

            icon="storefront-outline"

            size="lg"

            onPress={() => {

              if (Platform.OS !== "web")

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

              router.push("/(customer)/(tabs)/products");

            }}

            style={{ alignSelf: "center" }}

          />

        </Animated.View>



        <Animated.View entering={FadeInDown.duration(400).delay(240)} style={emptyS.catsSection}>

          <UIText

            variant="eyebrow"

            color="tertiary"

            align="center"

            style={{ marginBottom: 14, letterSpacing: 0.4 }}>

            {t("search.categoriesTitle")}

          </UIText>

          <View style={emptyS.catRow}>

            {CAT_CHIPS.map((cat) => (

              <Pressable

                key={cat.labelKey}

                onPress={() => router.push("/(customer)/(tabs)/products")}

                style={[emptyS.catChip, { backgroundColor: cat.bg }]}>

                <Ionicons name={cat.icon} size={16} color={cat.color} />

                <UIText style={[emptyS.catLabel, { color: cat.color }]} numberOfLines={1}>

                  {t(cat.labelKey)}

                </UIText>

              </Pressable>

            ))}

          </View>

        </Animated.View>

      </ScrollView>

    </View>

  );

}

