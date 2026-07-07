/**
 * AssignmentOffersList — all pending assignment offers awaiting this
 * driver's response. Usually just one, but staff can offer more than one
 * order at a time, so this list exists rather than assuming a single offer.
 */
import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { HeaderBackButton } from "@/features/orders/components/OrderDetailHelpers";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useDriverOffers } from "../hooks/useDriverManifest";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export function AssignmentOffersList(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const offersQuery = useDriverOffers(user?.id);
  const offers = offersQuery.data ?? [];

  return (
    <Screen edgeTop background={kit.color.canvas}>
      <View style={s.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <UIText variant="sheet-title" style={{ textAlign: TEXT_START, flex: 1 }}>
          {t("driver.offersTitle")}
        </UIText>
      </View>

      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(driver)/offer/${item.id}` as never)}
            style={s.card}>
            <View style={{ flex: 1 }}>
              <UIText variant="card-title" style={{ textAlign: TEXT_START }}>
                #{item.orderId.slice(-8).toUpperCase()}
              </UIText>
              <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>
                {t("driver.tapToRespond")}
              </UIText>
            </View>
            <Ionicons name={FORWARD_CHEVRON} size={18} color={kit.color.inkFaint} />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          !offersQuery.isLoading ? (
            <View style={s.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
                {t("driver.noOffersTitle")}
              </UIText>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 12,
    paddingHorizontal: kit.inset.screen,
    paddingTop: 12,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: kit.inset.screen,
    paddingBottom: 40,
  },
  card: {
    flexDirection: flexRow(IS_RTL),
    alignItems: "center",
    gap: 12,
    backgroundColor: kit.color.surface,
    borderRadius: kit.radius.xl,
    padding: 16,
    ...kit.shadow.card,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
});
