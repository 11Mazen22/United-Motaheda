import React, { useMemo } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Text as UIText, EmptyState, useTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";
import type { ManifestOrder } from "../hooks/useDriverManifest";
import { sortByUrgency } from "../lib/stageMachine";
import { OrderCardNew } from "./OrderCardNew";

const IS_RTL = isRtl();

interface Props {
  orders: ManifestOrder[];
  onRefresh: () => void;
  refreshing: boolean;
  onOrderPress: (order: ManifestOrder) => void;
  pagePad: number;
}

export function DeliveryQueue({ orders, onRefresh, refreshing, onOrderPress, pagePad }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const sortedOrders = useMemo(() => sortByUrgency(orders), [orders]);

  const s = useMemo(() => StyleSheet.create({
    sectionHeader: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", paddingHorizontal: pagePad, marginTop: 20, marginBottom: 8 },
    sectionTitle: { fontSize: 16, fontFamily: legacyTheme.fonts.black, color: theme.colors.text.primary },
    countBadge: { fontSize: 12, fontFamily: legacyTheme.fonts.bold, color: theme.colors.text.muted },
    listContent: { paddingHorizontal: pagePad, paddingBottom: 40, maxWidth: 720, alignSelf: "center" as const, width: "100%" as const },
    emptyWrap: { paddingTop: 60, paddingHorizontal: pagePad, alignItems: "center" as const },
  }), [theme, pagePad]);

  if (orders.length === 0) {
    return (
      <View>
        <View style={s.sectionHeader}>
          <UIText variant="h6" style={s.sectionTitle}>{t("driver.yourQueue", "Your Queue")}</UIText>
        </View>
        <View style={s.emptyWrap}>
          <EmptyState
            icon="list-outline"
            title={t("driver.queueEmptyTitle", "No deliveries yet")}
            subtitle={t("driver.queueEmptySubtitle", "Your assigned orders will appear here.")}
          />
        </View>
      </View>
    );
  }

  const renderItem = ({ item, index }: { item: ManifestOrder; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
      <OrderCardNew order={item} onPress={() => onOrderPress(item)} pagePad={pagePad} />
    </Animated.View>
  );

  return (
    <View>
      <View style={s.sectionHeader}>
        <UIText variant="h6" style={s.sectionTitle}>{t("driver.nextDeliveries", "Next Deliveries")}</UIText>
        <UIText variant="caption" color="muted" style={s.countBadge}>{orders.length} {t("driver.items", "items")}</UIText>
      </View>
      <FlatList
        data={sortedOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand.primary} />
        }
        scrollEnabled={false}
      />
    </View>
  );
}

export default DeliveryQueue;
