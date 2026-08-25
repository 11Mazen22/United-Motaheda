import React, { memo, useCallback, useMemo } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Text as UIText, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import type { FAQItem } from "../data";
import { getFaqCategories } from "../data";

interface Props {
  item: FAQItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

const TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

export const FAQAccordion = memo(function FAQAccordion({
  item,
  index,
  expanded,
  onToggle,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const categories = useMemo(() => getFaqCategories(theme), [theme]);
  const cat = categories.find((c) => c.key === item.category) ?? categories[0];

  // Reanimated chevron rotation — consistent with rest of app's motion system
  const rotation = useSharedValue(expanded ? 1 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(expanded ? 1 : 0, TIMING);
  }, [expanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    onToggle();
  }, [onToggle]);

  return (
    // LinearTransition: card container smoothly grows/shrinks when answer appears/disappears
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(220)}
      layout={LinearTransition.duration(240).easing(Easing.out(Easing.cubic))}
      style={[styles.card, expanded && styles.cardExpanded]}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={item.question}
        accessibilityState={{ expanded }}
        accessibilityHint={expanded ? "اضغط لإغلاق الإجابة" : "اضغط لعرض الإجابة"}>

        {/* Question row */}
        <View style={styles.questionRow}>
          <View style={[styles.catDot, { backgroundColor: cat.color }]} />
          <UIText
            style={[styles.question, expanded && styles.questionExpanded]}
            numberOfLines={expanded ? undefined : 2}>
            {item.question}
          </UIText>
          <Animated.View style={[styles.chevronWrap, expanded && styles.chevronWrapExpanded, chevronStyle]}>
            <Ionicons
              name="chevron-down"
              size={14}
              color={expanded ? theme.colors.brand.primary : theme.colors.neutrals[400]}
            />
          </Animated.View>
        </View>

        {/* Answer — smooth entry AND smooth exit (FadeOut) */}
        {expanded && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.answerWrap}>
            <View style={styles.answerDivider} />
            <UIText style={styles.answer}>{item.answer}</UIText>
            <View style={styles.catPill}>
              <UIText style={[styles.catPillText, { color: cat.color }]}>{cat.label}</UIText>
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
});

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.canvas.surface,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      ...theme.shadows[0],
    },
    cardExpanded: {
      borderColor: theme.colors.brand.primaryLight,
      ...theme.shadows[0],
    },
    questionRow: {
      flexDirection: flexRow(isRtl()),
      alignItems: "flex-start",
      gap: 10,
    },
    catDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 7,
    },
    question: {
      flex:       1,
      fontSize:   14,
      fontFamily: legacyTheme.fonts.black,
      color:      theme.colors.text.primary,
      textAlign:  textAlignStart(isRtl()),
      lineHeight: 22,
    },
    questionExpanded: {
      color: theme.colors.brand.primary,
    },
    chevronWrap: {
      width: 28,
      height: 28,
      borderRadius: 9,
      backgroundColor: theme.colors.neutrals[100],
      alignItems: "center",
      justifyContent: "center",
    },
    chevronWrapExpanded: {
      backgroundColor: theme.colors.brand.primaryLight,
    },
    answerWrap: {
      marginTop: 12,
      gap: 10,
    },
    answerDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.neutrals[200],
    },
    answer: {
      fontSize:   13,
      fontFamily: legacyTheme.fonts.regular,
      color:      theme.colors.text.muted,
      textAlign:  textAlignStart(isRtl()),
      lineHeight: 24,
    },
    catPill: {
      alignSelf: "flex-end",
      backgroundColor: theme.colors.neutrals[100],
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    catPillText: {
      fontSize: 9,
      fontFamily: legacyTheme.fonts.bold,
    },
  });
}
