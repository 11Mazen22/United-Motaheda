/**
 * CategoryStrip — creative horizontal scrollable category rail with animations.
 *
 * V3.3:
 *   • Floating left / right arrow buttons that fade + spring-in when there is
 *     content to scroll in that direction.
 *   • Press triggers a withSequence spring-bounce on the button.
 *   • FlatList.scrollToOffset provides a smooth native scroll.
 *   • RTL-aware: chevron icons and scroll direction flip in Arabic.
 */

import React, { memo, useCallback, useRef } from "react";
import { FlatList, I18nManager, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { kit } from "@/shared/kit";
import { CategoryCard } from "@/components/CategoryCard";
import { CategoryCardSkeleton } from "@/components/ui/Skeleton";
import { HomeSectionHeader } from "./HomeSectionHeader";
import { sectionStyles } from "./home.styles";
import { useScreenLayout } from "@/utils/responsive";
import type { NativeCategory } from "@/features/products";

const IS_RTL    = I18nManager.isRTL;
const STEP      = 240;
const THRESHOLD = 6;

interface CategoryStripProps {
  categories:      NativeCategory[];
  isLoading:       boolean;
  lang:            "ar" | "en";
  onCategoryPress: (id: string, name: string, nameEn: string) => void;
  onViewAll:       () => void;
}

export const CategoryStrip = memo(function CategoryStrip({
  categories,
  isLoading,
  lang,
  onCategoryPress,
  onViewAll,
}: CategoryStripProps) {
  const { t }       = useTranslation();
  const { pagePad } = useScreenLayout();

  const listRef    = useRef<FlatList>(null);
  const scrollX    = useRef(0);
  const contentW   = useRef(0);
  const containerW = useRef(0);

  // Visibility: opacity + pop-in scale for each arrow
  const lOp    = useSharedValue(0);
  const rOp    = useSharedValue(0);
  const lSc    = useSharedValue(0.72);
  const rSc    = useSharedValue(0.72);
  // Press-bounce scale
  const lPress = useSharedValue(1);
  const rPress = useSharedValue(1);

  const recalc = useCallback(() => {
    const max   = Math.max(0, contentW.current - containerW.current);
    const x     = scrollX.current;
    const showL = x > THRESHOLD;
    const showR = x < max - THRESHOLD;

    lOp.value = withTiming(showL ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
    rOp.value = withTiming(showR ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
    lSc.value = withSpring(showL ? 1 : 0.72, { damping: 18, stiffness: 300 });
    rSc.value = withSpring(showR ? 1 : 0.72, { damping: 18, stiffness: 300 });
  }, []);

  const handleScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      scrollX.current = e.nativeEvent.contentOffset.x;
      recalc();
    },
    [recalc],
  );

  const handleContentSize = useCallback(
    (w: number) => { contentW.current = w; recalc(); },
    [recalc],
  );

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      containerW.current = e.nativeEvent.layout.width;
      recalc();
    },
    [recalc],
  );

  const scrollBack = useCallback(() => {
    if (scrollX.current <= THRESHOLD) return;
    lPress.value = withSequence(
      withSpring(0.80, { damping: 7, stiffness: 540 }),
      withSpring(1.0,  { damping: 14, stiffness: 260 }),
    );
    listRef.current?.scrollToOffset({
      offset:   Math.max(0, scrollX.current - STEP),
      animated: true,
    });
  }, []);

  const scrollFwd = useCallback(() => {
    const max = Math.max(0, contentW.current - containerW.current);
    if (scrollX.current >= max - THRESHOLD) return;
    rPress.value = withSequence(
      withSpring(0.80, { damping: 7, stiffness: 540 }),
      withSpring(1.0,  { damping: 14, stiffness: 260 }),
    );
    listRef.current?.scrollToOffset({
      offset:   Math.min(max, scrollX.current + STEP),
      animated: true,
    });
  }, []);

  const lStyle = useAnimatedStyle(() => ({
    opacity:   lOp.value,
    transform: [{ scale: lSc.value * lPress.value }],
  }));
  const rStyle = useAnimatedStyle(() => ({
    opacity:   rOp.value,
    transform: [{ scale: rSc.value * rPress.value }],
  }));

  const renderCategory = useCallback(
    ({ item, index }: { item: NativeCategory; index: number }) => (
      <CategoryCard
        category={item}
        gradientIdx={index}
        lang={lang}
        variant="pill"
        onPress={() => onCategoryPress(item.id, item.name ?? "", item.nameEn ?? "")}
      />
    ),
    [lang, onCategoryPress],
  );

  const CONTENT_STYLE = {
    paddingHorizontal: pagePad,
    paddingTop:        12,
    paddingBottom:     8,
    gap:               12,
  } as const;

  // Visual left = previous in LTR, next in RTL. The chevron glyph picks the
  // right direction per language; the scroll direction adapts via the
  // physical-position handlers so the rail scrolls toward what the chevron
  // points to.
  const onLeftPress  = IS_RTL ? scrollFwd  : scrollBack;
  const onRightPress = IS_RTL ? scrollBack : scrollFwd;
  // Arrow glyphs: left button always shows a "<" (chevron-back),
  // right button always shows a ">" (chevron-forward). The visual meaning
  // is "scroll in this direction" — independent of language semantics.
  const leftChevron: React.ComponentProps<typeof Ionicons>["name"]  = "chevron-back";
  const rightChevron: React.ComponentProps<typeof Ionicons>["name"] = "chevron-forward";

  return (
    <View style={[sectionStyles.wrap, s.containerWrap]}>
      <HomeSectionHeader
        eyebrow={t("products.allProducts")}
        title={t("search.categoriesTitle")}
        icon="grid-outline"
        onMore={onViewAll}
      />

      {/* outer: relative container for arrows; no overflow clip so arrows aren't cut */}
      <View style={s.outer} onLayout={handleLayout}>

        {/* Rail — overflow:hidden clips FlatList to rounded corners */}
        <View style={s.railWrapper}>
          {isLoading ? (
            <FlatList
              data={SKELETON_KEYS}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={CONTENT_STYLE}
              keyExtractor={(k) => String(k)}
              renderItem={renderSkeleton}
              scrollEnabled={false}
            />
          ) : (
            <FlatList
              ref={listRef}
              data={categories}
              keyExtractor={(c) => c.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={CONTENT_STYLE}
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={50}
              renderItem={renderCategory}
              scrollEventThrottle={16}
              onScroll={handleScroll}
              onContentSizeChange={handleContentSize}
            />
          )}
        </View>

        {/* Arrows sit OUTSIDE railWrapper so they're never clipped by overflow:hidden */}
        {!isLoading && (
          <>
            <Animated.View style={[s.arrow, s.arrowLeft, lStyle]} pointerEvents="box-none">
              <Pressable onPress={onLeftPress} style={s.arrowBtn} hitSlop={10}
                accessibilityRole="button">
                <Ionicons name={leftChevron} size={15} color={kit.color.ink} />
              </Pressable>
            </Animated.View>

            <Animated.View style={[s.arrow, s.arrowRight, rStyle]} pointerEvents="box-none">
              <Pressable onPress={onRightPress} style={s.arrowBtn} hitSlop={10}
                accessibilityRole="button">
                <Ionicons name={rightChevron} size={15} color={kit.color.ink} />
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  containerWrap: {
    paddingTop: kit.sp(7),
  },
  outer: {
    // No overflow clip — arrows float above the rail
  },
  railWrapper: {
    overflow:        "hidden",
    borderRadius:    kit.radius.lg,
    backgroundColor: kit.color.canvas,
  },

  // Shared arrow container: spans full height so the circle is vertically centred
  arrow: {
    position:       "absolute",
    top:            0,
    bottom:         0,
    width:          46,
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         10,
  },
  arrowLeft:  { left:  4 },
  arrowRight: { right: 4 },

  // The floating circle pill
  arrowBtn: {
    width:           34,
    height:          34,
    borderRadius:    17,
    backgroundColor: kit.color.surface,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    ...kit.shadow.floating,
  },
});

const SKELETON_KEYS  = [1, 2, 3, 4];
const renderSkeleton = () => <CategoryCardSkeleton />;
