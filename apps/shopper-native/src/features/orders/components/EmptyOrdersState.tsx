import React, { useEffect } from "react";
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
import { AppHeader } from "@/shared/components";
import { kit, Button } from "@pharmacy/ui-native";
import { emptyS } from "./orders.styles";

// Category chips — kit semantic tints
const CAT_CHIPS = [
  { icon: "leaf-outline"     as const, labelKey: "home.qaVitamins", color: kit.color.success,    bg: kit.color.successTint },
  { icon: "sparkles-outline" as const, labelKey: "home.qaMomBaby",  color: kit.color.warn,       bg: kit.color.warnTint    },
  { icon: "medkit-outline"   as const, labelKey: "home.qaRx",       color: kit.color.accentDeep, bg: kit.color.accentTint  },
] as const;

export function EmptyOrdersState({ showBack }: { showBack: boolean }): React.ReactElement {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();
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
    <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>
      <AppHeader title={t("orders.title")} showBack={showBack} />
      <ScrollView
        contentContainerStyle={[emptyS.container, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}>

        <Animated.View style={[emptyS.illusWrap, floatAnim]}>
          <View style={emptyS.illusBg}>
            <View style={emptyS.illusRing}>
              <Ionicons name="bag-handle-outline" size={64} color={kit.color.accentDeep} />
            </View>
            <View style={emptyS.illusBadge}>
              <Ionicons name="add" size={14} color={kit.color.onInk} />
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
              router.push("/(tabs)/products");
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
                onPress={() => router.push("/(tabs)/products")}
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
