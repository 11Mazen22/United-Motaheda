/**
 * AssignmentOffersList — all pending assignment offers awaiting this
 * driver's response. Usually just one, but staff can offer more than one
 * order at a time, so this list exists rather than assuming a single offer.
 */
import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Screen, Text as UIText } from "@/shared/ui";
import { kit } from "@/shared/kit";
import { useAuth } from "@/features/auth";
import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";
import { useDriverOffers } from "../hooks/useDriverManifest";
import { DriverScreenHeader } from "../components/DriverScreenHeader";

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
      <DriverScreenHeader title={t("driver.offersTitle")} subtitle={t("driver.tapToRespond")} />

      <FlatList
        data={offers}
        keyExtractor={(o) => o.id}
        contentContainerStyle={s.listContent}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(driver)/offer/${item.id}` as never)}
            style={s.card}>
            <View style={s.offerIcon}><Ionicons name="flash-outline" size={19} color={kit.color.warn} /></View>
            <View style={{ flex: 1 }}>
              <View style={s.cardTitleRow}>
                <UIText variant="card-title" style={{ textAlign: TEXT_START }}>#{item.orderId.slice(-8).toUpperCase()}</UIText>
                <View style={s.newPill}><Ionicons name="time-outline" size={12} color={kit.color.warn} /></View>
              </View>
              <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>
                {t("driver.tapToRespond")}
              </UIText>
            </View>
            <Ionicons name={FORWARD_CHEVRON} size={18} color={kit.color.inkFaint} />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={
          offersQuery.isLoading ? (
            <View style={s.emptyState}><ActivityIndicator color={kit.color.accent} /></View>
          ) : offersQuery.isError ? (
            <View style={s.emptyState}>
              <Ionicons name="cloud-offline-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>{t("errors.network")}</UIText>
              <Pressable onPress={() => void offersQuery.refetch()} style={s.retryBtn}><UIText variant="body-sm" color="brand">{t("common.retry")}</UIText></Pressable>
            </View>
          ) : (
            <View style={s.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={40} color={kit.color.inkFaint} />
              <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
                {t("driver.noOffersTitle")}
              </UIText>
            </View>
          )
        }
      />
    </Screen>
  );
}

const s = StyleSheet.create({
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
    borderWidth: 1,
    borderColor: kit.color.warnTint,
    ...kit.shadow.card,
  },
  offerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: kit.color.warnTint, alignItems: "center", justifyContent: "center" },
  cardTitleRow: { flexDirection: flexRow(IS_RTL), alignItems: "center", justifyContent: "space-between", gap: 8 },
  newPill: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: kit.color.warnTint },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  retryBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: kit.radius.pill, backgroundColor: kit.color.accentTint },
});
