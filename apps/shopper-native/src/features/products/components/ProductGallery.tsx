import { defaultTheme as theme } from "@pharmacy/ui-native";
import React, { useState, useCallback } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import { Text as UIText } from "@pharmacy/ui-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { isRtl, flexRow } from "@/utils/layout";

const IS_RTL = isRtl();
const SCREEN_W = Dimensions.get("window").width;
const STAGE_W = SCREEN_W;

function ImageCarousel({ images, accessibilityName, parallaxStyle }: { images: string[]; accessibilityName: string; parallaxStyle: Record<string, unknown> }) {
  const [idx, setIdx] = useState(0);
  const onPageScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / STAGE_W);
    const logical = IS_RTL ? Math.max(0, images.length - 1 - next) : next;
    if (logical !== idx) setIdx(logical);
  }, [idx, images.length]);

  if (images.length === 0) {
    return (
      <View style={carousel.emptyWrap}>
        <View style={carousel.emptyTile}>
          <MaterialCommunityIcons name="pill" size={56} color={theme.colors.text.muted} />
        </View>
      </View>
    );
  }

  if (images.length === 1) {
    return (
      <Animated.View style={[carousel.page, parallaxStyle]} accessible accessibilityLabel={accessibilityName}>
        <Image source={{ uri: images[0] }} style={carousel.img} contentFit="contain" transition={300} />
      </Animated.View>
    );
  }

  const physicalPages = IS_RTL ? [...images].reverse() : images;

  return (
    <View style={carousel.multi}>
      <ScrollView horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} onScroll={onPageScroll} scrollEventThrottle={16} style={{ direction: "ltr" }}>
        {physicalPages.map((uri, i) => (
          <Animated.View key={`${uri}-${i}`} style={[carousel.page, parallaxStyle]} accessibilityLabel={`${accessibilityName} — ${i + 1}`}>
            <Image source={{ uri }} style={carousel.img} contentFit="contain" transition={300} />
          </Animated.View>
        ))}
      </ScrollView>
      <View style={[carousel.dots, { flexDirection: flexRow(IS_RTL) }]}>
        {images.map((_, i) => (
          <View key={i} style={[carousel.dot, i === idx && carousel.dotActive]} />
        ))}
      </View>
    </View>
  );
}

export const ProductGallery = React.memo(function ProductGallery({ product, isLoading, haloAnim, imgParallax, sealAnim, t }: { product: { imageUrl?: string; nameAr?: string; name?: string; discountPercent?: number; inStock?: boolean; stock?: number }; isLoading: boolean; haloAnim: Record<string, unknown>; imgParallax: Record<string, unknown>; sealAnim: Record<string, unknown>; t: (key: string) => string }) {
  return (
    <View style={stage.wrap}>
      {isLoading ? (
        <Skeleton height={400} radius={0} />
      ) : (
        <>
          <Animated.View style={[stage.haloWrap, haloAnim]} pointerEvents="none">
            <View style={stage.haloOuter} />
            <View style={stage.haloInner} />
          </Animated.View>

          <ImageCarousel
            images={product?.imageUrl ? [product.imageUrl] : []}
            accessibilityName={product?.nameAr ?? product?.name ?? ""}
            parallaxStyle={imgParallax}
          />

          {product?.discountPercent && product.discountPercent > 0 && (
            <View style={stage.discountBadge} pointerEvents="none">
              <UIText variant="caption" weight="bold" style={{ color: theme.colors.text.inverse }}>
                -{product.discountPercent}%
              </UIText>
            </View>
          )}

          {product && (
            <Animated.View entering={FadeIn.duration(400).delay(220).springify().damping(18)} style={[stage.seal, sealAnim]}>
              <Ionicons name="shield-checkmark" size={12} color={theme.colors.brand.primary} />
              <UIText variant="caption" weight="bold" style={{ color: theme.colors.brand.primary }}>{t("product.sealVerified")}</UIText>
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
});

const stage = StyleSheet.create({
  wrap: { height: 400, backgroundColor: theme.colors.canvas.surfaceMuted, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  haloWrap: { position: "absolute", alignItems: "center", justifyContent: "center", width: 280, height: 280 },
  haloOuter: { position: "absolute", width: 280, height: 280, borderRadius: 140, backgroundColor: theme.colors.brand.primaryLight, opacity: 0.28 },
  haloInner: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: theme.colors.brand.primaryLight, opacity: 0.32 },
  seal: { position: "absolute", bottom: 16, end: 18, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.colors.canvas.surface, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(14,126,116,0.22)", ...theme.shadows[1] },
  discountBadge: { position: "absolute", top: 14, start: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: theme.colors.status.error, zIndex: 20, ...theme.shadows[1] },
});

const carousel = StyleSheet.create({
  multi: { width: "100%", height: "100%" },
  page: { width: STAGE_W, height: "100%", paddingHorizontal: 28, paddingVertical: 24 },
  img: { width: "100%", height: "100%" },
  emptyWrap: { alignItems: "center", justifyContent: "center", flex: 1 },
  emptyTile: { width: 110, height: 110, borderRadius: 34, backgroundColor: theme.colors.canvas.surface, borderWidth: 1, borderColor: theme.colors.border.default, alignItems: "center", justifyContent: "center", ...theme.shadows[1] },
  dots: { position: "absolute", bottom: 18, alignSelf: "center", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(15,23,42,0.18)" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { width: 18, backgroundColor: theme.colors.canvas.surface },
});
