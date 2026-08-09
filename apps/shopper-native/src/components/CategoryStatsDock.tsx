import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text as UIText } from "@pharmacy/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  Easing,
  interpolate,
  cancelAnimation,
  withRepeat,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { fetchCatalogStats } from "@/services/productsApi";
import type { CatalogStats } from "@/services/productsApi";
import { theme } from "@pharmacy/design-tokens";
import { kit } from "@pharmacy/ui-native";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Animated Number ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, suffix }: { value: number; suffix?: string }) {
  const display = useSharedValue(0);

  useEffect(() => {
    display.value = withTiming(value, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, display]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(display.value, [0, Math.max(value * 0.3, 1)], [0.4, 1]),
  }));

  return (
    <Animated.Text style={[styles.statValue, animStyle]}>
      {value > 0 ? value.toLocaleString() : "—"}{suffix ?? ""}
    </Animated.Text>
  );
}

// ─── Skeleton Dock ───────────────────────────────────────────────────────────

function StatsSkeleton() {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false,
    );
    return () => cancelAnimation(shimmer);
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.4, 0.8, 0.4]),
  }));

  return (
    <View style={styles.dock}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.statCell, i < 4 && styles.cellBorder]}>
          <Animated.View style={[styles.skeletonIcon, shimmerStyle]} />
          <Animated.View style={[styles.skeletonValue, shimmerStyle]} />
          <Animated.View style={[styles.skeletonLabel, shimmerStyle]} />
        </View>
      ))}
    </View>
  );
}

// ──�� Error Dock ──────────────────────────────────────────────────────────────

function StatsError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onRetry} style={styles.errorDock}>
      <Ionicons name="refresh-outline" size={16} color={theme.colors.amber[600]} />
      <UIText style={styles.errorText}>{t("products.statsError")}</UIText>
    </Pressable>
  );
}

// ─── Stat Cell ───────────────────────────────────────────────────────────────

interface StatCellProps {
  icon: IoniconsName;
  value: string | number;
  label: string;
  accent: string;
  bg: string;
  isNumeric?: boolean;
  index: number;
  isLast: boolean;
}

function StatCell({ icon, value, label, accent, bg, isNumeric, index, isLast }: StatCellProps) {
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = index * 80;
    const timer = setTimeout(() => {
      scale.value = withSpring(1, { damping: 14, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 300 });
    }, delay);
    return () => clearTimeout(timer);
  }, [index, scale, opacity]);

  const cellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.statCell, !isLast && styles.cellBorder, cellStyle]}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      {isNumeric && typeof value === "number" ? (
        <AnimatedNumber value={value} />
      ) : (
        <UIText style={styles.statValue}>{value}</UIText>
      )}
      <UIText style={styles.statLabel}>{label}</UIText>
    </Animated.View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface CategoryStatsDockProps {
  categoriesCount?: number;
}

export function CategoryStatsDock({ categoriesCount }: CategoryStatsDockProps) {
  // ⚠ ALL hooks must be called unconditionally — before any early returns.
  const { t } = useTranslation();
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery<CatalogStats>({
    queryKey: ["catalog-stats"],
    queryFn: fetchCatalogStats,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    retryDelay: 3000,
  });

  if (isLoading) {
    return (
      <Animated.View entering={FadeInDown.duration(300)} style={styles.container}>
        <StatsSkeleton />
      </Animated.View>
    );
  }

  if (isError) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.container}>
        <StatsError onRetry={() => refetch()} />
      </Animated.View>
    );
  }
  const catCount  = categoriesCount    ?? 0;
  const prodCount = stats?.totalProducts ?? 0;

  const statItems: Omit<StatCellProps, "index" | "isLast">[] = [
    {
      icon: "grid-outline",
      value: catCount,
      label: t("products.statCategories"),
      accent: kit.color.accent,
      bg: kit.color.accentTint,
      isNumeric: true,
    },
    {
      icon: "cube-outline",
      value: prodCount,
      label: t("products.statItems"),
      accent: theme.colors.purple[600],
      bg: theme.colors.purple[50],
      isNumeric: true,
    },
    {
      icon: "flash-outline",
      value: t("products.statFastValue"),
      label: t("products.statFastLabel"),
      accent: theme.colors.amber[600],
      bg: theme.colors.amber[50],
    },
    {
      icon: "shield-checkmark-outline",
      value: t("products.statOriginalValue"),
      label: t("products.statOriginalLabel"),
      accent: theme.colors.green[600],
      bg: theme.colors.green[50],
    },
  ];

  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.container}>
      <View style={styles.dock}>
        {statItems.map((item, i) => (
          <StatCell
            key={i}
            {...item}
            index={i}
            isLast={i === statItems.length - 1}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: -18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  dock: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    flexDirection: flexRow(isRtl()),
    ...theme.shadow.lg,
    borderWidth: 1,
    borderColor: theme.colors.slate[100],
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  cellBorder: {
    borderRightWidth: 1,
    borderRightColor: theme.colors.slate[100],
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 14,
    fontFamily: theme.fonts.black,
    color: theme.colors.slate[900],
  },
  statLabel: {
    fontSize: 9,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[400],
  },

  // Skeleton
  skeletonIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: theme.colors.slate[100],
  },
  skeletonValue: {
    width: 32,
    height: 14,
    borderRadius: 6,
    backgroundColor: theme.colors.slate[100],
  },
  skeletonLabel: {
    width: 24,
    height: 10,
    borderRadius: 4,
    backgroundColor: theme.colors.slate[100],
  },

  // Error
  errorDock: {
    backgroundColor: theme.colors.amber[50],
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.amber[100],
  },
  errorText: {
    fontSize: 11,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.amber[700],
    textAlign: textAlignStart(isRtl()),
  },
});
