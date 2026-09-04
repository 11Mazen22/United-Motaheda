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

import React, { useCallback, useMemo } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, Button, Input, PressableScale, useTheme, sheetMotion, type NativeTheme } from "@pharmacy/ui-native";
import { gradients } from "@pharmacy/design-tokens";
import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";
import { useAppLanguage } from "@/i18n/LanguageProvider";
import { cancelOrder } from "@/features/orders/api";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

const IS_RTL = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

const DEFAULT_REASON_CODES = [
  "CHANGED_MIND", "ORDERED_BY_MISTAKE", "WRONG_ADDRESS", "DUPLICATE_ORDER",
  "PAYMENT_PROBLEM", "DELIVERY_DELAY", "FOUND_ELSEWHERE", "OTHER",
] as const;

/** Every code get_order_actions() can hand back gets a distinct glyph, so
 *  the list reads at a glance instead of as eight identical rows. Falls
 *  back to a generic dot for any server-added code this hasn't been
 *  updated for yet. */
const REASON_ICONS: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  CHANGED_MIND: "arrow-undo-circle-outline",
  ORDERED_BY_MISTAKE: "warning-outline",
  WRONG_ADDRESS: "location-outline",
  DUPLICATE_ORDER: "copy-outline",
  PAYMENT_PROBLEM: "card-outline",
  DELIVERY_DELAY: "time-outline",
  FOUND_ELSEWHERE: "storefront-outline",
  OTHER: "chatbox-ellipses-outline",
};
const FALLBACK_REASON_ICON: React.ComponentProps<typeof Ionicons>["name"] = "ellipse-outline";

export interface CancelOrderSheetProps {
  visible: boolean;
  orderId: string;
  /** From get_order_actions()'s cancel.reasons — falls back to the standard customer list if absent. */
  reasonCodes?: string[];
  /** Order context shown in the sheet so cancelling is never a decision made blind. */
  orderShortId: string;
  itemCount: number;
  total: number;
  onDismiss: () => void;
  /** Fired once the order is actually cancelled server-side. */
  onCancelled: () => void;
}

export function CancelOrderSheet({
  visible, orderId, reasonCodes, orderShortId, itemCount, total, onDismiss, onCancelled,
}: CancelOrderSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { language } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(theme), [theme]);

  const [selectedCode, setSelectedCode] = React.useState<string | null>(null);
  const [otherDetail, setOtherDetail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

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
            <LinearGradient
              pointerEvents="none"
              colors={[`${theme.colors.status.error}26`, `${theme.colors.status.error}00`]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.headerWash}
            />

            <View style={styles.handle} />

            <View style={styles.header}>
              <View style={styles.iconTileOuter}>
                <LinearGradient
                  colors={gradients.error as unknown as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconTile}
                >
                  <Ionicons name="close-circle" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text variant="sheet-title">{t("orders.cancelSheetTitle", "Cancel Order")}</Text>
              <Text variant="body-sm" color="secondary" align="center">
                {t("orders.cancelSheetSubtitle", "Tell us why to help us improve our service")}
              </Text>
            </View>

            {/* Order-context strip — cancelling should never be a decision made blind. */}
            <View style={[styles.orderStrip, { flexDirection: flexRow(IS_RTL) }]}>
              <View style={styles.orderStripIcon}>
                <Ionicons name="receipt-outline" size={16} color={theme.colors.text.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ textAlign: TEXT_START }}>#{orderShortId}</Text>
                <Text variant="caption" color="muted" style={{ textAlign: TEXT_START }}>
                  {t("orders.cancelItemCount", "{{count}} items", { count: itemCount })}
                </Text>
              </View>
              <Text variant="card-title" weight="extrabold">{formatPrice(total, language)}</Text>
            </View>

            <Text variant="label" color="secondary" style={styles.reasonsLabel}>
              {t("orders.cancelReasonsLabel", "Reason for cancellation")}
            </Text>

            <ScrollView style={styles.reasonScroll} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {reasons.map((code) => {
                  const selected = selectedCode === code;
                  return (
                    <PressableScale
                      key={code}
                      scaleTo={0.98}
                      onPress={() => setSelectedCode(code)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      style={[
                        styles.reasonRow,
                        {
                          borderColor: selected ? theme.colors.brand.primary : theme.colors.border.default,
                          borderStartWidth: selected ? 3 : 1,
                          backgroundColor: selected ? theme.colors.brand.primaryLight : theme.colors.canvas.surface,
                          flexDirection: flexRow(IS_RTL),
                        },
                        selected ? theme.shadows[2] : null,
                      ]}
                    >
                      <View
                        style={[
                          styles.reasonIconWell,
                          {
                            backgroundColor: selected ? theme.colors.brand.primary : theme.colors.canvas.surfaceMuted,
                          },
                        ]}
                      >
                        <Ionicons
                          name={REASON_ICONS[code] ?? FALLBACK_REASON_ICON}
                          size={17}
                          color={selected ? "#fff" : theme.colors.text.secondary}
                        />
                      </View>
                      <Text variant="body-sm" weight={selected ? "bold" : "regular"} style={{ flex: 1, textAlign: TEXT_START }}>
                        {t(`orders.cancelReasons.${code}`, code)}
                      </Text>
                      <Ionicons
                        name={selected ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={selected ? theme.colors.brand.primary : theme.colors.border.strong}
                      />
                    </PressableScale>
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

              {selectedCode ? (
                <Animated.View entering={FadeIn.duration(180)} style={[styles.refundNote, { flexDirection: flexRow(IS_RTL) }]}>
                  <Ionicons name="shield-checkmark-outline" size={15} color={theme.colors.status.info} />
                  <Text variant="caption" color="secondary" style={{ flex: 1, textAlign: TEXT_START }}>
                    {t("orders.cancelRefundNote", "Any amount already paid will be refunded within 3–5 business days, if applicable.")}
                  </Text>
                </Animated.View>
              ) : null}
            </ScrollView>

            {!selectedCode ? (
              <Text variant="caption" color="muted" style={{ marginTop: 8, textAlign: TEXT_START }}>
                {t("orders.cancelReasonRequired", "Please select a reason to continue")}
              </Text>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.actions}>
              <Button
                variant="danger"
                tone="gradient"
                glow
                full
                icon="close-circle-outline"
                loading={submitting}
                disabled={!selectedCode}
                label={t("orders.cancelConfirmButton", "Confirm Cancellation")}
                onPress={() => void submit()}
              />
              <Button
                variant="ghost"
                full
                icon="shield-checkmark-outline"
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
      maxHeight: "88%",
      gap: theme.spacing[2],
      ...theme.shadows[4],
    },
    headerWash: {
      position: "absolute",
      top: 0,
      start: 0,
      end: 0,
      height: 190,
      // Rounds its own top corners to match `sheet` instead of relying on
      // the parent clipping it -- `sheet` needs overflow:visible to keep
      // its own drop shadow (shadowOpacity + overflow:hidden don't render
      // together on iOS), so this can't lean on a clipping ancestor.
      borderTopStartRadius: legacyTheme.layout.bottomSheetRadius,
      borderTopEndRadius: legacyTheme.layout.bottomSheetRadius,
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
    iconTileOuter: {
      marginBottom: theme.spacing[1],
      borderRadius: 999,
      shadowColor: theme.colors.status.error,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 6,
    },
    iconTile: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    orderStrip: {
      alignItems: "center",
      gap: 10,
      borderRadius: theme.radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      backgroundColor: theme.colors.canvas.surfaceMuted,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    orderStripIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.canvas.surface,
    },
    reasonsLabel: {
      marginTop: 4,
    },
    reasonScroll: {
      flexGrow: 0,
    },
    reasonRow: {
      alignItems: "center",
      gap: 13,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      paddingVertical: 14,
      paddingHorizontal: 15,
    },
    reasonIconWell: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    refundNote: {
      alignItems: "flex-start",
      gap: 8,
      marginTop: 12,
      padding: 10,
      borderRadius: theme.radii.md,
      backgroundColor: `${theme.colors.status.info}10`,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border.default,
      marginTop: 4,
    },
    actions: {
      gap: 10,
      marginTop: 4,
    },
  });
}
