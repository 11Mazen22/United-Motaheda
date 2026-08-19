/**

 * BranchSelector — list of branches with selection state.

 *

 * Sorts by distance when customer coordinates are provided; otherwise

 * shows the primary branch first.

 */



import React, { memo, useCallback, useMemo } from "react";

import { StyleSheet, View } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import { Ionicons } from "@expo/vector-icons";

import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, useReducedMotion } from "react-native-reanimated";

import { BranchCard } from "./BranchCard";

import { useBranches } from "../branches/useBranches";

import { sortBranchesByDistance, type Coordinates } from "../geofencing";

import { theme } from "@pharmacy/design-tokens";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import type { Branch } from "../branches/types";



interface BranchSelectorProps {

  selectedId: string | null;

  onSelect: (branch: Branch) => void;

  customerCoords?: Coordinates | null;

  compact?: boolean;

  maxItems?: number;

}



export function BranchSelector({

  selectedId,

  onSelect,

  customerCoords,

  compact,

  maxItems,

}: BranchSelectorProps) {

  const { data: branches = [], isLoading } = useBranches();



  const ranked = useMemo(() => {

    const enabled = branches.filter((b) => b.deliveryEnabled);

    if (customerCoords) {

      return sortBranchesByDistance(customerCoords, enabled);

    }

    const primary = enabled.filter((b) => b.isPrimary).map((b) => ({ branch: b, distanceKm: undefined as number | undefined }));

    const rest    = enabled.filter((b) => !b.isPrimary).map((b) => ({ branch: b, distanceKm: undefined as number | undefined }));

    return [...primary, ...rest];

  }, [branches, customerCoords]);



  const visible = maxItems ? ranked.slice(0, maxItems) : ranked;



  const handleSelect = useCallback(

    (branch: Branch) => onSelect(branch),

    [onSelect],

  );



  if (isLoading) {

    return <BranchSkeletons count={compact ? 2 : 3} />;

  }



  if (visible.length === 0) {

    return (

      <Animated.View entering={FadeIn.duration(200)} style={styles.emptyCard}>

        <Ionicons name="storefront-outline" size={20} color={kit.color.slate[400]} />

        <UIText style={styles.emptyText}>لا توجد فروع متاحة للتوصيل حالياً</UIText>

      </Animated.View>

    );

  }



  return (

    <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="اختر فرع التوصيل">

      {visible.map(({ branch, distanceKm }, i) => (

        <Animated.View key={branch.id} entering={FadeInDown.delay(i * 50).duration(220)}>

          <BranchCard

            branch={branch}

            selected={branch.id === selectedId}

            distanceKm={distanceKm}

            onPress={() => handleSelect(branch)}

            compact={compact}

          />

        </Animated.View>

      ))}

    </View>

  );

}



// ─── Animated shimmer skeleton ─────────────────────────────────────────────



const SkeletonRow = memo(function SkeletonRow({ delay }: { delay: number }) {

  const opacity = useSharedValue(1);



  React.useEffect(() => {

    opacity.value = withRepeat(

      withSequence(

        withTiming(0.4, { duration: 700 }),

        withTiming(1,   { duration: 700 }),

      ),

      -1,

      true,

    );

  }, [opacity]);



  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));



  return (

    <Animated.View

      entering={FadeIn.delay(delay).duration(200)}

      style={[styles.skel, animStyle]}

    />

  );

});



function BranchSkeletons({ count }: { count: number }) {

  return (

    <View style={{ gap: 8 }} accessibilityLabel="جارٍ تحميل الفروع">

      {Array.from({ length: count }).map((_, i) => (

        <SkeletonRow key={i} delay={i * 80} />

      ))}

    </View>

  );

}



const styles = StyleSheet.create({

  skel: {

    height: 76,

    borderRadius: 16,

    backgroundColor: kit.color.slate[100],

  },

  emptyCard: {

    flexDirection: flexRow(isRtl()),

    alignItems: "center",

    gap: 10,

    padding: 14,

    borderRadius: 16,

    backgroundColor: kit.color.slate[50],

    borderWidth: 1,

    borderStyle: "dashed",

    borderColor: kit.color.slate[200],

  },

  emptyText: {

    flex: 1,

    fontSize: 12,

    fontFamily: theme.fonts.semibold,

    color: kit.color.slate[500],

    textAlign: textAlignStart(isRtl()),

  },

});

