import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, useTheme, Button, Screen } from "@pharmacy/ui-native";
import { useOrderDetail } from "@/features/orders/hooks/useOrders";
import { HeaderBackButton } from "@/features/orders/components/OrderDetailHelpers";
import { isRtl, flexRow, textAlignStart } from "@/utils/layout";
import { supabase } from "@/lib/supabase";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

interface EligibleItem {
  order_item_id: number;
  product_id: string;
  purchased_quantity: number;
  already_returned: number;
  available_quantity: number;
  eligible: boolean;
  reason: string | null;
}

interface EligibilityResult {
  eligible: boolean;
  reason: string | null;
  items: EligibleItem[];
}

export default function OrderReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: order, isLoading: isOrderLoading } = useOrderDetail(id);

  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [returnItems, setReturnItems] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!id) return;
    setIsChecking(true);
    supabase.rpc("get_return_eligibility", { p_order_id: id as string })
      .then(({ error, data }) => {
        if (error) {
          console.error("Eligibility check failed:", error);
          showErrorSheet(t("common.error", "Error"), error.message);
        } else {
          setEligibility(data as unknown as EligibilityResult);
        }
        setIsChecking(false);
      });
  }, [id]);

  if (isOrderLoading || isChecking || !order) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.brand.primary} />
      </View>
    );
  }

  const TEXT_START = textAlignStart(isRtl());

  if (!eligibility || !eligibility.eligible) {
    return (
      <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <HeaderBackButton onPress={() => router.back()} />
          <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START, marginHorizontal: 12 }}>
            {t("orders.requestReturn", "Request Return")}
          </UIText>
        </View>
        <View style={styles.centerScreen}>
          <Ionicons name="close-circle-outline" size={64} color={"#EF4444"} />
          <UIText variant="card-title" style={{ marginTop: 16 }}>Return Not Available</UIText>
          <UIText variant="body-sm" color="secondary" style={{ marginTop: 8, textAlign: "center", marginHorizontal: 32 }}>
            {eligibility?.reason || "This order is not eligible for a return."}
          </UIText>
          <Button label="Go Back" onPress={() => router.back()} style={{ marginTop: 24 }} />
        </View>
      </Screen>
    );
  }

  const increment = (orderItemId: number, maxQty: number) => {
    setReturnItems(prev => {
      const current = prev[orderItemId] || 0;
      if (current >= maxQty) return prev;
      return { ...prev, [orderItemId]: current + 1 };
    });
  };

  const decrement = (orderItemId: number) => {
    setReturnItems(prev => {
      const current = prev[orderItemId] || 0;
      if (current <= 0) return prev;
      return { ...prev, [orderItemId]: current - 1 };
    });
  };

  const hasItems = Object.values(returnItems).some(qty => qty > 0);

  const handleSubmit = async () => {
    if (!hasItems) {
      showErrorSheet(t("orders.returnError", "Error"), t("orders.returnNoItems", "Please select at least one item to return."));
      return;
    }
    if (!reason.trim()) {
      showErrorSheet(t("orders.returnError", "Error"), t("orders.returnNoReason", "Please provide a reason for the return."));
      return;
    }

    try {
      setIsSubmitting(true);
      
      const itemsPayload = Object.entries(returnItems)
        .filter(([_, qty]) => qty > 0)
        .map(([orderItemId, quantity]) => ({
          order_item_id: parseInt(orderItemId, 10),
          quantity
        }));

      const idempotencyKey = `req-${Date.now()}`;

      const { error } = await supabase.rpc("request_return", {
        p_order_id: id as string,
        p_reason: reason.trim(),
        p_resolution_type: 'PHYSICAL_RETURN',
        p_idempotency_key: idempotencyKey,
        p_items: itemsPayload
      });

      if (error) throw error;

      showSuccessSheet(
        t("common.success", "Success"),
        t("orders.returnSubmitted", "Your return request has been submitted and is pending review."),
        () => router.back(),
      );

    } catch (e: any) {
      console.error(e);
      showErrorSheet(t("common.error", "Error"), e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <HeaderBackButton onPress={() => router.back()} />
        <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START, marginHorizontal: 12 }}>
          {t("orders.requestReturn", "Request Return")}
        </UIText>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}>
        <UIText variant="body-sm" color="secondary" style={{ marginBottom: 24, textAlign: TEXT_START }}>
          {t("orders.returnInstructions", "Select the items you wish to return and provide a reason. A pharmacist will review your request shortly.")}
        </UIText>

        <UIText variant="eyebrow" color="tertiary" style={{ marginBottom: 12, textAlign: TEXT_START }}>
          {t("orders.itemsToReturn", "Items to Return")}
        </UIText>

        <View style={{ gap: 12 }}>
          {eligibility.items.map(eItem => {
            const orderItem = order.items.find(i => i.id === eItem.order_item_id);
            if (!orderItem) return null;

            const qty = returnItems[eItem.order_item_id] || 0;
            const isEligible = eItem.eligible && eItem.available_quantity > 0;

            return (
              <View key={eItem.order_item_id} style={[styles.itemCard, { borderColor: theme.colors.border.subtle, opacity: isEligible ? 1 : 0.6 }]}>
                <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <UIText variant="body-sm" weight="bold" numberOfLines={2} style={{ textAlign: TEXT_START }}>
                    {orderItem.name}
                  </UIText>
                  <UIText variant="caption" color="secondary" style={{ textAlign: TEXT_START, marginTop: 4 }}>
                    {isEligible ? `Max: ${eItem.available_quantity}` : (eItem.reason || "Not eligible")}
                  </UIText>
                </View>
                
                {isEligible && (
                  <View style={[styles.stepper, { backgroundColor: theme.colors.canvas.surface }]}>
                    <Pressable onPress={() => decrement(eItem.order_item_id)} style={styles.stepperBtn}>
                      <Ionicons name="remove" size={16} color={theme.colors.text.primary} />
                    </Pressable>
                    <UIText variant="body-sm" weight="bold" style={{ width: 24, textAlign: "center" }}>
                      {qty}
                    </UIText>
                    <Pressable onPress={() => increment(eItem.order_item_id, eItem.available_quantity)} style={styles.stepperBtn}>
                      <Ionicons name="add" size={16} color={theme.colors.text.primary} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <UIText variant="eyebrow" color="tertiary" style={{ marginTop: 32, marginBottom: 12, textAlign: TEXT_START }}>
          {t("orders.returnReason", "Reason for Return")}
        </UIText>
        
        <View style={styles.reasonInputContainer}>
          <Pressable 
            style={[styles.reasonChip, reason === "Wrong item" && { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }]}
            onPress={() => setReason("Wrong item")}
          >
            <UIText variant="caption" style={{ color: reason === "Wrong item" ? theme.colors.brand.primary : theme.colors.text.primary }}>Wrong item</UIText>
          </Pressable>
          <Pressable 
            style={[styles.reasonChip, reason === "Damaged / Defective" && { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }]}
            onPress={() => setReason("Damaged / Defective")}
          >
            <UIText variant="caption" style={{ color: reason === "Damaged / Defective" ? theme.colors.brand.primary : theme.colors.text.primary }}>Damaged / Defective</UIText>
          </Pressable>
          <Pressable 
            style={[styles.reasonChip, reason === "Changed mind" && { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }]}
            onPress={() => setReason("Changed mind")}
          >
            <UIText variant="caption" style={{ color: reason === "Changed mind" ? theme.colors.brand.primary : theme.colors.text.primary }}>Changed mind</UIText>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: theme.colors.canvas.background, borderTopColor: theme.colors.border.subtle }]}>
        <Button 
          label={t("orders.submitReturn", "Submit Return Request")}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!hasItems || !reason || isSubmitting}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerScreen: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  itemCard: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  stepper: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  stepperBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonInputContainer: {
    flexDirection: flexRow(isRtl()),
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  }
});
