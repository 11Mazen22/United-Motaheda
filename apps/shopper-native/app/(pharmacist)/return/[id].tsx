/**
 * ReturnInspectionScreen — pharmacist inspects a customer's return request
 * item by item (approved quantity + disposition), then submits to
 * process-return's complete_inspection action, which drives
 * transition_return_status server-side (refund creation, restock, etc).
 *
 * Rebuilt from a rough, English-only, untyped, hardcoded-colour first draft
 * to match the rest of the pharmacist product: theme tokens instead of raw
 * hex, real RTL via flexRow/textAlignStart, every string translated, and
 * errors routed through getPharmacistActionErrorMessage instead of a raw
 * Alert.alert(e.message) leaking Postgres/RPC codes at the pharmacist.
 */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText, useTheme, Button, Screen, Card, PressableScale } from "@pharmacy/ui-native";
import { supabase } from "@/lib/supabase";
import { flexRow, isRtl, textAlignStart, valueTextAlign } from "@/utils/layout";
import { useScreenLayout } from "@/utils/responsive";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";
import { PharmacistScreenHeader } from "@/features/pharmacist/components/PharmacistScreenHeader";
import { getPharmacistActionErrorMessage } from "@/features/pharmacist/lib/errorMessage";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

type Disposition = "PENDING_INSPECTION" | "RESTOCK" | "DAMAGED" | "EXPIRED";
const DISPOSITIONS: Disposition[] = ["PENDING_INSPECTION", "RESTOCK", "DAMAGED", "EXPIRED"];

interface ReturnRequestRow {
  id: string;
  order_id: string;
  status: string;
  reason: string;
  orders: { customer_name: string | null } | null;
}

interface ReturnItemRow {
  id: string;
  requested_quantity: number;
  order_items: {
    product_snapshot: { name?: string; name_en?: string } | null;
  } | null;
}

interface ItemDraft {
  qty: number;
  disp: Disposition;
}

export default function ReturnInspectionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { pagePad, isTablet } = useScreenLayout();

  const [returnRequest, setReturnRequest] = useState<ReturnRequestRow | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});

  useEffect(() => {
    void fetchReturn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchReturn = async () => {
    setLoading(true);
    try {
      const { data: reqData, error: reqErr } = await supabase
        .from("return_requests")
        .select(`id, order_id, status, reason, orders(customer_name)`)
        .eq("order_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (reqErr) throw reqErr;
      setReturnRequest(reqData as unknown as ReturnRequestRow);

      const { data: itemsData, error: itemsErr } = await supabase
        .from("return_items")
        .select(`id, requested_quantity, disposition, order_items(product_snapshot)`)
        .eq("request_id", reqData.id);
      if (itemsErr) throw itemsErr;

      const items = (itemsData ?? []) as unknown as (ReturnItemRow & { disposition: Disposition })[];
      setReturnItems(items);
      const initDrafts: Record<string, ItemDraft> = {};
      items.forEach((item) => {
        initDrafts[item.id] = { qty: item.requested_quantity, disp: item.disposition ?? "PENDING_INSPECTION" };
      });
      setDrafts(initDrafts);
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), getPharmacistActionErrorMessage(e, t, t("pharmacist.actionFailedBody")));
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (itemId: string, patch: Partial<ItemDraft>) => {
    setDrafts((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  };

  const handleSubmit = async () => {
    if (!returnRequest) return;
    setSubmitting(true);
    try {
      const itemsPayload = Object.entries(drafts).map(([itemId, draft]) => ({
        id: itemId,
        disposition: draft.disp,
        approved_quantity: draft.qty,
      }));

      const { data, error } = await supabase.functions.invoke("process-return", {
        body: { requestId: returnRequest.id, action: "complete_inspection", payload: { items: itemsPayload } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      showSuccessSheet(
        t("pharmacist.returnInspection.successTitle"),
        t("pharmacist.returnInspection.successBody"),
        () => router.back(),
      );
    } catch (e) {
      showErrorSheet(t("pharmacist.actionFailedTitle"), getPharmacistActionErrorMessage(e, t, t("pharmacist.actionFailedBody")));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <PharmacistScreenHeader title={t("pharmacist.returnInspection.title")} />
        <View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.brand.primary} /></View>
      </Screen>
    );
  }

  if (!returnRequest) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background}>
        <PharmacistScreenHeader title={t("pharmacist.returnInspection.title")} />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.colors.text.muted} />
          <UIText variant="card-title" style={{ marginTop: 10, textAlign: "center" }}>
            {t("pharmacist.returnInspection.notFoundTitle")}
          </UIText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <PharmacistScreenHeader title={t("pharmacist.returnInspection.title")} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: pagePad }, isTablet && styles.scrollTablet]}
        showsVerticalScrollIndicator={false}
      >
        <Card padding="md" style={styles.summaryCard}>
          <View style={[styles.row, { justifyContent: "space-between" }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.returnInspection.customerLabel")}</UIText>
            <UIText variant="body-sm" weight="bold">{returnRequest.orders?.customer_name ?? "—"}</UIText>
          </View>
          <View style={[styles.row, { justifyContent: "space-between", marginTop: 4 }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.returnInspection.reasonLabel")}</UIText>
            <UIText variant="body-sm" weight="bold" style={{ flexShrink: 1, textAlign: valueTextAlign }} numberOfLines={2}>
              {returnRequest.reason}
            </UIText>
          </View>
          <View style={[styles.row, { justifyContent: "space-between", marginTop: 4 }]}>
            <UIText variant="body-sm" color="secondary">{t("pharmacist.returnInspection.statusLabel")}</UIText>
            <UIText variant="body-sm" weight="bold">{returnRequest.status}</UIText>
          </View>
        </Card>

        <UIText variant="eyebrow" color="tertiary" style={{ marginBottom: 12, textAlign: TEXT_START }}>
          {t("pharmacist.returnInspection.itemsToInspect")}
        </UIText>

        <View style={{ gap: 16 }}>
          {returnItems.map((item) => {
            const snap = item.order_items?.product_snapshot;
            const draft = drafts[item.id];
            if (!draft) return null;
            return (
              <Card key={item.id} padding="md" style={[styles.itemCard, { borderColor: theme.colors.border.default }]}>
                <UIText variant="body-sm" weight="bold" style={{ textAlign: TEXT_START }}>
                  {snap?.name || snap?.name_en || t("pharmacist.returnInspection.unknownItem")}
                </UIText>
                <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START }}>
                  {t("pharmacist.returnInspection.requestedQty")}: {item.requested_quantity}
                </UIText>

                <View style={{ marginTop: 12, gap: 12 }}>
                  <View>
                    <UIText variant="caption" style={{ marginBottom: 4, textAlign: TEXT_START }}>
                      {t("pharmacist.returnInspection.approvedQty")}
                    </UIText>
                    <View style={[styles.stepper, { flexDirection: flexRow(IS_RTL), backgroundColor: theme.colors.canvas.surfaceMuted }]}>
                      <PressableScale
                        onPress={() => updateDraft(item.id, { qty: Math.max(0, draft.qty - 1) })}
                        style={styles.stepperBtn}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.decrement")}
                      >
                        <Ionicons name="remove" size={16} color={theme.colors.text.primary} />
                      </PressableScale>
                      <UIText variant="body-sm" weight="bold" style={{ width: 28, textAlign: "center" }}>{draft.qty}</UIText>
                      <PressableScale
                        onPress={() => updateDraft(item.id, { qty: Math.min(item.requested_quantity, draft.qty + 1) })}
                        style={styles.stepperBtn}
                        accessibilityRole="button"
                        accessibilityLabel={t("common.increment")}
                      >
                        <Ionicons name="add" size={16} color={theme.colors.text.primary} />
                      </PressableScale>
                    </View>
                  </View>

                  <View>
                    <UIText variant="caption" style={{ marginBottom: 4, textAlign: TEXT_START }}>
                      {t("pharmacist.returnInspection.dispositionLabel")}
                    </UIText>
                    <View style={[styles.chipRow, { flexDirection: flexRow(IS_RTL) }]}>
                      {DISPOSITIONS.map((d) => {
                        const active = draft.disp === d;
                        return (
                          <PressableScale
                            key={d}
                            onPress={() => updateDraft(item.id, { disp: d })}
                            style={[
                              styles.chip,
                              { borderColor: active ? theme.colors.brand.primary : theme.colors.border.default },
                              active && { backgroundColor: theme.colors.brand.primaryLight },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                          >
                            <UIText variant="caption" style={{ color: active ? theme.colors.brand.primary : theme.colors.text.primary }}>
                              {t(`pharmacist.returnInspection.disposition.${d}`)}
                            </UIText>
                          </PressableScale>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.canvas.background, borderTopColor: theme.colors.border.default, paddingHorizontal: pagePad }]}>
        <Button
          label={t("pharmacist.returnInspection.submitButton")}
          onPress={() => void handleSubmit()}
          loading={submitting}
          disabled={submitting}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
    centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    scroll: { paddingTop: 16, paddingBottom: 120 },
    scrollTablet: { maxWidth: 720, alignSelf: "center", width: "100%" },
    row: { flexDirection: flexRow(IS_RTL), alignItems: "center" },
    summaryCard: { marginBottom: 16, gap: 2 },
    itemCard: { borderWidth: 1 },
    stepper: {
      alignItems: "center",
      borderRadius: 10,
      alignSelf: "flex-start",
    },
    stepperBtn: { padding: 10 },
    chipRow: { flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 9999,
      borderWidth: 1,
    },
    footer: {
      position: "absolute",
      bottom: 0,
      start: 0,
      end: 0,
      paddingTop: 16,
      paddingBottom: 28,
      borderTopWidth: StyleSheet.hairlineWidth,
  },
});
