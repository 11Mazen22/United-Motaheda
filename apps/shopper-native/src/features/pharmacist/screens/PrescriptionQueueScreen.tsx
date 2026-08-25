/**
 * PrescriptionQueueScreen — pharmacist reBox queue for pending prescriptions.
 *
 * Shows a filterable list of prescriptions (pending / approved / rejected).
 * Tapping a row opens PrescriptionDetailScreen for reBox.
 */

import React, { useMemo, useState } from "react";

import {

  ActivityIndicator,

  FlatList,

  RefreshControl,

  StyleSheet,

  View,

} from "react-native";

import { useRouter }       from "expo-router";

import { Ionicons }        from "@expo/vector-icons";

import { useTranslation }  from "react-i18next";

import { useQueryClient }  from "@tanstack/react-query";



import { Screen, Text as UIText, Card, Chip, EmptyState as PUIEmptyState } from "@pharmacy/ui-native";
import { useTheme } from "@pharmacy/ui-native";

import { kit } from "@pharmacy/ui-native";

import { flexRow, isRtl, textAlignStart, FORWARD_CHEVRON } from "@/utils/layout";



import { useAllPrescriptions }     from "../hooks/usePharmacistQueries";

import { PharmacistScreenHeader }  from "../components/PharmacistScreenHeader";

import type { PrescriptionReviewStatus, PharmacistPrescription } from "../api/types";



const IS_RTL     = isRtl();

const TEXT_START = textAlignStart(IS_RTL);



const STATUS_FILTERS: { key: PrescriptionReviewStatus | "all"; labelKey: string }[] = [

  { key: "all",            labelKey: "pharmacist.rxAll"     },

  { key: "pending_review", labelKey: "pharmacist.rxPending" },

  { key: "approved",       labelKey: "pharmacist.rxApproved"},

  { key: "rejected",       labelKey: "pharmacist.rxRejected"},

];



function RxCard({ rx, onPress }: { rx: PharmacistPrescription; onPress: () => void }) {

  const { t } = useTranslation();

  const { theme } = useTheme();

  const s = useMemo(() => StyleSheet.create({

    card: {

      borderRadius:    16,

      padding:         16,

      borderWidth:     1,

      borderColor:     theme.colors.border.default,

    },

    cardHeader: {

      alignItems:     "center",

      justifyContent: "space-between",

      gap:            8,

    },

    statusDot: {

      paddingHorizontal: 10,

      paddingVertical:   4,

      borderRadius:      9999,

      borderWidth:       1,

    },

  }), [theme]);



  const chipColor =

    rx.reviewStatus === "approved"

      ? theme.colors.status.success

      : rx.reviewStatus === "rejected"

        ? theme.colors.status.error

        : theme.colors.status.warning;



  const chipBg =

    rx.reviewStatus === "approved"

      ? `${theme.colors.status.success}1A`

      : rx.reviewStatus === "rejected"

        ? `${theme.colors.status.error}1A`

        : `${theme.colors.status.warning}1A`;



  return (

    <Card onPress={onPress} style={s.card} elevation="sm">

      <View style={[s.cardHeader, { flexDirection: flexRow(IS_RTL) }]}>

        <View style={[s.statusDot, { backgroundColor: chipBg, borderColor: chipColor }]}>

          <UIText variant="eyebrow" style={{ color: chipColor }}>

            {t(`pharmacist.rx${rx.reviewStatus === "pending_review" ? "Pending" : rx.reviewStatus === "approved" ? "Approved" : "Rejected"}`)}

          </UIText>

        </View>

        <UIText variant="caption" color="secondary">

          {rx.submissionSource === "whatsapp" ? "WhatsApp" : rx.submissionSource === "scan" ? t("pharmacist.scan") : t("pharmacist.manual")}

        </UIText>

        <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.text.muted} />

      </View>

      <UIText variant="card-title" style={{ textAlign: TEXT_START, marginTop: 8 }} numberOfLines={1}>

        {rx.name || "—"}

      </UIText>

      <UIText variant="body-sm" color="secondary" style={{ textAlign: TEXT_START, marginTop: 2 }}>

        {rx.customerName}

        {rx.doctor ? ` · Dr. ${rx.doctor}` : ""}

      </UIText>

      <UIText variant="caption" color="muted" style={{ textAlign: TEXT_START, marginTop: 4 }}>

        {new Date(rx.addedAt ?? "").toLocaleDateString()}

      </UIText>

    </Card>

  );

}



export function PrescriptionQueueScreen(): React.ReactElement {

  const { t }       = useTranslation();

  const { theme } = useTheme();

  const router      = useRouter();

  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<PrescriptionReviewStatus | "all">("pending_review");

  const s = useMemo(() => StyleSheet.create({

    filterRow: {

      gap:               8,

      paddingHorizontal: kit.inset.screen,

      paddingVertical:   12,

      flexWrap:          "wrap",

    },

    filterChip: {

      borderColor:     theme.colors.border.default,

      backgroundColor: theme.colors.canvas.surface,

    },

    filterChipActive: {

      backgroundColor: theme.colors.brand.primaryLight,

      borderColor:     theme.colors.brand.primary,

    },

    listContent: {

      paddingHorizontal: kit.inset.screen,

      paddingBottom:     48,

    },

    empty: {

      alignItems:    "center",

      paddingTop:    60,

      paddingBottom: 40,

    },

  }), [theme]);



  const rxQuery = useAllPrescriptions(

    filter === "all" ? undefined : filter,

  );



  const items = rxQuery.data ?? [];



  const onRefresh = async () => {

    await queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] });

  };



  return (

    <Screen edgeTop background={theme.colors.canvas.background}>

      <PharmacistScreenHeader

        title={t("pharmacist.prescriptionsTitle")}

        subtitle={t("pharmacist.prescriptionsSubtitle", { count: items.length })}

      />



      {/* Filter tabs */}

      <View style={[s.filterRow, { flexDirection: flexRow(IS_RTL) }]}>

        {STATUS_FILTERS.map((f) => (

          <Chip

            key={f.key}

            label={t(f.labelKey)}

            selected={filter === f.key}

            selectable

            onPress={() => setFilter(f.key)}

            style={[s.filterChip, filter === f.key && s.filterChipActive]}

          />

        ))}

      </View>



      <FlatList

        data={items}

        keyExtractor={(rx) => rx.id}

        contentContainerStyle={s.listContent}

        showsVerticalScrollIndicator={false}

        refreshControl={

          <RefreshControl

            refreshing={rxQuery.isFetching}

            onRefresh={onRefresh}

            tintColor={theme.colors.brand.primary}

          />

        }

        renderItem={({ item }) => (

          <RxCard

            rx={item}

            onPress={() => router.push(`/(pharmacist)/prescription/${item.id}`)}

          />

        )}

        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}

        ListEmptyComponent={

          rxQuery.isLoading ? (

            <View style={s.empty}>

              <ActivityIndicator size="large" color={theme.colors.brand.primary} />

            </View>

          ) : (

            <PUIEmptyState

              illustration={<Ionicons name="document-text-outline" size={32} color={theme.colors.text.muted} />}

              title={t("pharmacist.emptyRxTitle")}

              subtitle={t("pharmacist.emptyRxSubtitle")}

            />

          )

        }

      />

    </Screen>

  );

}


