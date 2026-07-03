/**
 * Manual payment UI — Vodafone Cash / InstaPay transfer verification.
 */

import React, { memo } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { Input } from "@/components/ui/Input";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { MANUAL_PAYMENT_WALLET_NUMBER } from "../constants";

export interface ManualPaymentPanelProps {
  transferNumber: string;
  onTransferNumberChange: (value: string) => void;
  receiptUri: string | null;
  onPickReceipt: () => void;
  uploading?: boolean;
  error?: string | null;
}

export const ManualPaymentPanel = memo(function ManualPaymentPanel({
  transferNumber,
  onTransferNumberChange,
  receiptUri,
  onPickReceipt,
  uploading,
  error,
}: ManualPaymentPanelProps) {
  const { t } = useTranslation();

  const copyNumber = async () => {
    try {
      await Clipboard.setStringAsync(MANUAL_PAYMENT_WALLET_NUMBER);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      showSuccessSheet(t("payment.copySuccess"), t("payment.copySuccessMsg"));
    } catch {
      showErrorSheet(t("payment.copyFailed"), t("payment.copyFailedMsg"));
    }
  };

  return (
    <View style={styles.wrap}>
      <UIText style={styles.hint}>{t("payment.walletHint")}</UIText>

      <View style={styles.numberBlock}>
        <UIText style={styles.walletNumber}>{MANUAL_PAYMENT_WALLET_NUMBER}</UIText>
        <Pressable
          onPress={copyNumber}
          accessibilityRole="button"
          accessibilityLabel={t("payment.copyWalletA11y")}
          style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="copy-outline" size={18} color="#fff" />
          <UIText style={styles.copyBtnText}>{t("payment.copyNumber")}</UIText>
        </Pressable>
      </View>

      <Input
        label={t("payment.senderReference")}
        value={transferNumber}
        onChangeText={onTransferNumberChange}
        placeholder="01XXXXXXXXX أو InstaPay handle"
        keyboardType="default"
        autoCapitalize="none"
        error={error && !transferNumber.trim() ? error : undefined}
      />

      <UIText style={styles.uploadLabel}>{t("payment.uploadReceipt")}</UIText>
      <Pressable
        onPress={onPickReceipt}
        disabled={uploading}
        style={({ pressed }) => [
          styles.uploadBox,
          receiptUri && styles.uploadBoxFilled,
          pressed && { opacity: 0.9 },
          uploading && { opacity: 0.6 },
        ]}>
        {receiptUri ? (
          <Image source={{ uri: receiptUri }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Ionicons name="image-outline" size={32} color={theme.colors.slate[400]} />
            <UIText style={styles.uploadPlaceholderText}>{t("payment.pickReceipt")}</UIText>
          </View>
        )}
      </Pressable>

      {error ? <UIText style={styles.errorText}>{error}</UIText> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  hint: {
    fontSize: 12,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[600],
    textAlign: textAlignStart(isRtl()),
    lineHeight: 18,
  },
  numberBlock: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: kit.color.accentTint,
    borderWidth: 1,
    borderColor: theme.colors.border.brandSoft,
  },
  walletNumber: {
    fontSize: 32,
    fontFamily: theme.fonts.black,
    color: kit.color.accentDeep,
    letterSpacing: 1,
    textAlign: "center",
  },
  copyBtn: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: kit.color.accentDeep,
  },
  copyBtnText: {
    fontSize: 13,
    fontFamily: theme.fonts.bold,
    color: "#fff",
  },
  uploadLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text.secondary,
    textAlign: textAlignStart(isRtl()),
  },
  uploadBox: {
    minHeight: 160,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border.default,
    borderStyle: "dashed",
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceSunken,
  },
  uploadBoxFilled: {
    borderStyle: "solid",
  },
  uploadPlaceholder: {
    flex: 1,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 20,
  },
  uploadPlaceholderText: {
    fontSize: 12,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[500],
    textAlign: "center",
  },
  preview: {
    width: "100%",
    height: 200,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.error.strong,
    textAlign: textAlignStart(isRtl()),
  },
});
