/**
 * CancelOrderSheet — bottom-sheet cancellation flow for the customer order
 * detail screen. Replaces a bare native Alert.alert() confirm/success pair
 * with a proper reason-picker: get_order_actions() already returns the
 * server's own list of valid cancel reason codes for this order
 * (cancel.reasons — see supabase/migrations/20260902160000_fix_
 * cancellation_completely_broken.sql), this just surfaces them instead of
 * silently discarding them like the screen used to.
 *
 * Success/failure feedback goes through the app-wide showSuccessSheet /
 * showErrorSheet (shared/store/appSheetStore) rather than a bespoke inline
 * state here — same pattern pharmacist's OrderDetailScreen already uses for
 * its own cancel flow, kept consistent rather than reinvented.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, Button, Input, useTheme, sheetMotion, type NativeTheme } from "@pharmacy/ui-native";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl } from "@/utils/layout";
import { cancelOrder } from "@/features/orders/api";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

const IS_RTL = isRtl();

const DEFAULT_REASON_CODES = [
  "CHANGED_MIND", "ORDERED_BY_MISTAKE", "WRONG_ADDRESS", "DUPLICATE_ORDER",
  "PAYMENT_PROBLEM", "DELIVERY_DELAY", "FOUND_ELSEWHERE", "OTHER",
] as const;

export interface CancelOrderSheetProps {
  visible: boolean;
  orderId: string;
  /** From get_order_actions()'s cancel.reasons — falls back to the standard customer list if absent. */
  reasonCodes?: string[];
  onDismiss: () => void;
  /** Fired once the order is actually cancelled server-side. */
  onCancelled: () => void;
}

export function CancelOrderSheet({
  visible, orderId, reasonCodes, onDismiss, onCancelled,
}: CancelOrderSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [otherDetail, setOtherDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reasons = reasonCodes && reasonCodes.length > 0 ? reasonCodes : DEFAULT_REASON_CODES;

  // One idempotency key per cancel *attempt sequence*, not per submit()
  // call. Previously generated inline as `cancel-mobile-${orderId}-
  // ${Date.now()}`, which meant a retry (including the automatic one from
  // showErrorSheet's onRetry, below) always minted a brand-new key — so the
  // server's idempotency short-circuit could never actually recognize a
  // retry as the same attempt. A lost-response-but-actually-succeeded retry
  // would then hit "Order cannot be cancelled: already cancelled" instead
  // of cleanly replaying the original success. Regenerated whenever the
  // sheet opens fresh (same place the selection itself resets below), so a
  // genuinely new cancellation attempt still gets its own key.
  const idempotencyKeyRef = React.useRef(`cancel-mobile-${orderId}-${Date.now()}`);

  // Reset to a clean slate each time the sheet is (re)opened for a
  // (possibly different) order, rather than carrying over a stale
  // selection from the last time it was shown.
  const wasVisible = React.useRef(visible);
  if (visible && !wasVisible.current) {
    setSelectedCode(null);
    setOtherDetail("");
    idempotencyKeyRef.current = `cancel-mobile-${orderId}-${Date.now()}`;
  }
  wasVisible.current = visible;

  const submit = useCallback(async () => {
    if (!selectedCode || submitting) return;
    const reason = selectedCode === "OTHER" && otherDetail.trim()
      ? `OTHER: ${otherDetail.trim()}`
      : selectedCode;
    setSubmitting(true);
    try {
      await cancelOrder(orderId, reason, idempotencyKeyRef.current);
      onCancelled();
      onDismiss();
      showSuccessSheet(t("orders.cancelSuccessTitle", "Order Cancelled"), t("orders.cancelSuccessBody", "Your order has been cancelled. Any payment made will be refunded within 3–5 business days."));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showErrorSheet(t("orders.cancelErrorTitle", "Couldn't Cancel Order"), message, { onRetry: () => void submit() });
    } finally {
      setSubmitting(false);
    }
    // submit is intentionally re-created each render (closes over the
    // current selectedCode/otherDetail) — showErrorSheet's onRetry captures
    // whichever instance was current at submit time, which is correct. The
    // idempotency key itself lives in a ref specifically so it survives
    // that re-creation unchanged across retries.
  }, [selectedCode, otherDetail, submitting, orderId, onCancelled, onDismiss, t]);

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onDismiss}>
      <Animated.View entering={sheetMotion.backdropEnter} exiting={sheetMotion.backdropExit} style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onDismiss} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
          style={styles.kbContainer}
        >
          <Animated.View entering={sheetMotion.enter} exiting={sheetMotion.exit} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={[styles.iconTile, { backgroundColor: `${theme.colors.status.error}18`, borderColor: `${theme.colors.status.error}33` }]}>
                <Ionicons name="close-circle-outline" size={28} color={theme.colors.status.error} />
              </View>
              <Text variant="sheet-title">{t("orders.cancelSheetTitle", "Cancel Order")}</Text>
              <Text variant="body-sm" color="secondary" align="center">
                {t("orders.cancelSheetSubtitle", "Tell us why to help us improve our service")}
              </Text>
            </View>

            <Text variant="label" color="secondary" style={styles.reasonsLabel}>
              {t("orders.cancelReasonsLabel", "Reason for cancellation")}
            </Text>

            <ScrollView style={styles.reasonScroll} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {reasons.map((code) => {
                  const selected = selectedCode === code;
                  return (
                    <Pressable
                      key={code}
                      onPress={() => setSelectedCode(code)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[
                        styles.reasonRow,
                        {
                          borderColor: selected ? theme.colors.brand.primary : theme.colors.border.default,
                          backgroundColor: selected ? theme.colors.brand.primaryLight : theme.colors.canvas.surface,
                          flexDirection: flexRow(IS_RTL),
                        },
                      ]}
                    >
                      <View style={[styles.radioOuter, { borderColor: selected ? theme.colors.brand.primary : theme.colors.border.strong }]}>
                        {selected ? <View style={[styles.radioInner, { backgroundColor: theme.colors.brand.primary }]} /> : null}
                      </View>
                      <Text variant="body-sm" weight={selected ? "bold" : "regular"} style={{ flex: 1 }}>
                        {t(`orders.cancelReasons.${code}`, code)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {selectedCode === "OTHER" ? (
                <Animated.View entering={sheetMotion.backdropEnter} style={{ marginTop: 12 }}>
                  <Input
                    label={t("orders.cancelOtherLabel", "Add details (optional)")}
                    placeholder={t("orders.cancelOtherPlaceholder", "Tell us more...")}
                    value={otherDetail}
                    onChangeText={setOtherDetail}
                    multiline
                    style={{ minHeight: 44, textAlignVertical: "top" }}
                  />
                </Animated.View>
              ) : null}
            </ScrollView>

            {!selectedCode ? (
              <Text variant="caption" color="muted" style={{ marginTop: 8, textAlign: IS_RTL ? "right" : "left" }}>
                {t("orders.cancelReasonRequired", "Please select a reason to continue")}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Button
                variant="danger"
                full
                loading={submitting}
                disabled={!selectedCode}
                label={t("orders.cancelConfirmButton", "Confirm Cancellation")}
                onPress={() => void submit()}
              />
              <Button
                variant="ghost"
                full
                disabled={submitting}
                label={t("orders.cancelKeepOrder", "No, keep my order")}
                onPress={onDismiss}
              />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

function getStyles(theme: NativeTheme) {
  return StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: theme.colors.canvas.overlay,
      justifyContent: "flex-end",
    },
    kbContainer: {
      width: "100%",
    },
    sheet: {
      backgroundColor: theme.colors.canvas.surface,
      borderTopStartRadius: legacyTheme.layout.bottomSheetRadius,
      borderTopEndRadius: legacyTheme.layout.bottomSheetRadius,
      paddingHorizontal: legacyTheme.layout.pagePaddingH,
      paddingTop: theme.spacing[1],
      maxHeight: "86%",
      gap: theme.spacing[2],
      ...theme.shadows[4],
    },
    handle: {
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border.strong,
      alignSelf: "center",
      marginBottom: 6,
    },
    header: {
      alignItems: "center",
      gap: 4,
    },
    iconTile: {
      width: 56,
      height: 56,
      borderRadius: theme.radii["2xl"],
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.spacing[1],
      borderWidth: 1,
    },
    reasonsLabel: {
      marginTop: 4,
    },
    reasonScroll: {
      flexGrow: 0,
    },
    reasonRow: {
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    actions: {
      gap: 10,
      marginTop: 14,
    },
  });
}
