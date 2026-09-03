/**
 * CancelOrderSheet — bottom-sheet cancellation flow for the customer order
 * detail screen. Replaces a bare native Alert.alert() confirm/success pair
 * with a proper reason-picker: get_order_actions() already returns the
 * server's own list of valid cancel reason codes for this order
 * (cancel.reasons — see supabase/migrations/20260902160000_fix_
 * cancellation_completely_broken.sql), this just surfaces them instead of
 * silently discarding them like the screen used to.
 *
 * Owns its own submit/error/success state (mirrors PhoneVerifyModal's
 * self-contained pattern) so the parent screen only needs to pass the order
 * id, the reason codes, visibility, and what to do once the order is
 * actually cancelled.
 *
 * Mode flow: "select" (reason list) → "success" (confirmation), with the
 * error state rendered inline in "select" mode rather than an interrupting
 * native alert.
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
  /** Fired once the order is actually cancelled server-side, before the success view is shown. */
  onCancelled: () => void;
}

type Mode = "select" | "success";

export function CancelOrderSheet({
  visible, orderId, reasonCodes, onDismiss, onCancelled,
}: CancelOrderSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [mode, setMode] = useState<Mode>("select");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [otherDetail, setOtherDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasons = reasonCodes && reasonCodes.length > 0 ? reasonCodes : DEFAULT_REASON_CODES;

  // Reset to a clean slate each time the sheet is (re)opened for a
  // (possibly different) order, rather than carrying over a stale
  // selection/error/success state from the last time it was shown.
  const wasVisible = React.useRef(visible);
  if (visible && !wasVisible.current) {
    setMode("select");
    setSelectedCode(null);
    setOtherDetail("");
    setError(null);
  }
  wasVisible.current = visible;

  const handleConfirm = useCallback(async () => {
    if (!selectedCode || submitting) return;
    const reason = selectedCode === "OTHER" && otherDetail.trim()
      ? `OTHER: ${otherDetail.trim()}`
      : selectedCode;
    setSubmitting(true);
    setError(null);
    try {
      await cancelOrder(orderId, reason, `cancel-mobile-${orderId}-${Date.now()}`);
      onCancelled();
      setMode("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [selectedCode, otherDetail, submitting, orderId, onCancelled]);

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

            {mode === "select" ? (
              <>
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

                {error ? (
                  <View style={[styles.errorBanner, { backgroundColor: `${theme.colors.status.error}14`, borderColor: `${theme.colors.status.error}33` }]}>
                    <Ionicons name="alert-circle-outline" size={16} color={theme.colors.status.error} />
                    <Text variant="caption" style={{ color: theme.colors.status.error, flex: 1 }}>{error}</Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Button
                    variant="danger"
                    full
                    loading={submitting}
                    disabled={!selectedCode}
                    label={t("orders.cancelConfirmButton", "Confirm Cancellation")}
                    onPress={() => void handleConfirm()}
                  />
                  <Button
                    variant="ghost"
                    full
                    disabled={submitting}
                    label={t("orders.cancelKeepOrder", "No, keep my order")}
                    onPress={onDismiss}
                  />
                </View>
              </>
            ) : (
              <View style={styles.successWrap}>
                <View style={[styles.iconTile, styles.successIconTile, { backgroundColor: `${theme.colors.status.success}18`, borderColor: `${theme.colors.status.success}33` }]}>
                  <Ionicons name="checkmark-circle-outline" size={32} color={theme.colors.status.success} />
                </View>
                <Text variant="sheet-title" align="center">{t("orders.cancelSuccessTitle", "Order Cancelled")}</Text>
                <Text variant="body-sm" color="secondary" align="center" style={{ marginBottom: 8 }}>
                  {t("orders.cancelSuccessBody", "Your order has been cancelled. Any payment made will be refunded within 3–5 business days.")}
                </Text>
                <Button variant="primary" full label={t("orders.cancelDone", "Done")} onPress={onDismiss} />
              </View>
            )}
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
    successIconTile: {
      width: 64,
      height: 64,
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
    errorBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      padding: 10,
      marginTop: 10,
    },
    actions: {
      gap: 10,
      marginTop: 14,
    },
    successWrap: {
      alignItems: "center",
      paddingVertical: 8,
      paddingBottom: 4,
      gap: 6,
    },
  });
}
