import React, { useState, useEffect } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text as UIText, useTheme, Button, Screen, Card } from "@pharmacy/ui-native";
import { supabase } from "@/lib/supabase";
import { isRtl, textAlignStart } from "@/utils/layout";

export default function ReturnInspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [returnRequest, setReturnRequest] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dispositions, setDispositions] = useState<Record<string, { qty: number, disp: string }>>({});

  useEffect(() => {
    fetchReturn();
  }, [id]);

  const fetchReturn = async () => {
    try {
      setLoading(true);
      const { data: reqData, error: reqErr } = await supabase
        .from("return_requests")
        .select(`*, orders(customer_name)`)
        .eq("order_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (reqErr) throw reqErr;
      setReturnRequest(reqData);

      const { data: itemsData, error: itemsErr } = await supabase
        .from("return_items")
        .select(`*, order_items(product_snapshot, quantity, unit_price)`)
        .eq("request_id", reqData.id);
      
      if (itemsErr) throw itemsErr;
      setReturnItems(itemsData || []);
      
      // Initialize dispositions
      const initDisp: Record<string, { qty: number, disp: string }> = {};
      itemsData?.forEach(item => {
        initDisp[item.id] = { qty: item.requested_quantity, disp: item.disposition };
      });
      setDispositions(initDisp);
      
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (itemId: string, field: 'qty' | 'disp', value: any) => {
    setDispositions(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      const itemsPayload = Object.entries(dispositions).map(([itemId, data]) => ({
        id: itemId,
        disposition: data.disp,
        approved_quantity: data.qty
      }));

      const { data, error } = await supabase.functions.invoke("process-return", {
        body: {
          requestId: returnRequest.id,
          action: "complete_inspection",
          payload: { items: itemsPayload }
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      Alert.alert("Success", "Return inspection completed successfully.", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !returnRequest) {
    return (
      <View style={[styles.centerScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={theme.colors.brand.primary} />
      </View>
    );
  }

  const TEXT_START = textAlignStart(isRtl());

  return (
    <Screen edgeTop background={theme.colors.canvas.background} scroll={false}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </Pressable>
        <UIText variant="card-title" style={{ flex: 1, textAlign: TEXT_START, marginHorizontal: 12 }}>
          Inspect Return
        </UIText>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }}>
        <Card padding="md" style={{ marginBottom: 16 }}>
          <UIText variant="caption" color="secondary">Customer: {returnRequest.orders?.customer_name}</UIText>
          <UIText variant="caption" color="secondary">Reason: {returnRequest.reason}</UIText>
          <UIText variant="caption" color="secondary">Status: {returnRequest.status}</UIText>
        </Card>

        <UIText variant="eyebrow" color="tertiary" style={{ marginBottom: 12 }}>Items to Inspect</UIText>
        
        <View style={{ gap: 16 }}>
          {returnItems.map(item => {
            const snap = item.order_items?.product_snapshot || {};
            const disp = dispositions[item.id];
            return (
              <Card key={item.id} padding="md" style={{ borderColor: theme.colors.border.subtle, borderWidth: 1 }}>
                <UIText variant="body-sm" weight="bold">{snap.name || snap.name_en || 'Unknown Item'}</UIText>
                <UIText variant="caption" color="secondary">Requested Qty: {item.requested_quantity}</UIText>
                
                <View style={{ marginTop: 12, gap: 12 }}>
                  <View>
                    <UIText variant="caption" style={{ marginBottom: 4 }}>Approved Qty</UIText>
                    <View style={styles.stepper}>
                      <Pressable onPress={() => updateItem(item.id, 'qty', Math.max(0, disp.qty - 1))} style={styles.stepperBtn}>
                        <Ionicons name="remove" size={16} />
                      </Pressable>
                      <UIText variant="body-sm" weight="bold" style={{ width: 24, textAlign: "center" }}>{disp.qty}</UIText>
                      <Pressable onPress={() => updateItem(item.id, 'qty', Math.min(item.requested_quantity, disp.qty + 1))} style={styles.stepperBtn}>
                        <Ionicons name="add" size={16} />
                      </Pressable>
                    </View>
                  </View>
                  
                  <View>
                    <UIText variant="caption" style={{ marginBottom: 4 }}>Disposition</UIText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {['PENDING_INSPECTION', 'RESTOCK', 'DAMAGED', 'EXPIRED'].map(d => (
                        <Pressable 
                          key={d} 
                          onPress={() => updateItem(item.id, 'disp', d)}
                          style={[
                            styles.chip, 
                            disp.disp === d && { backgroundColor: theme.colors.brand.primaryLight, borderColor: theme.colors.brand.primary }
                          ]}
                        >
                          <UIText variant="caption" style={{ color: disp.disp === d ? theme.colors.brand.primary : theme.colors.text.primary }}>
                            {d.replace('_', ' ')}
                          </UIText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: theme.colors.canvas.background, borderTopColor: theme.colors.border.subtle }]}>
        <Button 
          label="Complete Inspection & Approve Refund"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          full
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centerScreen: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: 'row',
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  stepperBtn: { padding: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
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
