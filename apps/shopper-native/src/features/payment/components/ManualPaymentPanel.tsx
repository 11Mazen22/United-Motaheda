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

import { Text as UIText } from "@pharmacy/ui-native";

import { showSuccessSheet, showErrorSheet } from "@/shared/store/appSheetStore";

import * as Clipboard from "expo-clipboard";

import * as Haptics from "expo-haptics";

import { Ionicons } from "@expo/vector-icons";

import { useTranslation } from "react-i18next";

import { flexRow, isRtl, textAlignStart } from "@/utils/layout";

import { Input } from "@/components/ui/Input";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";



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

          style={styles.copyBtnTouchable}>

          {({ pressed }) => (

            <View style={[styles.copyBtn, pressed && styles.copyBtnPressed]}>

              <Ionicons name="copy-outline" size={18} color="#fff" />

              <UIText style={styles.copyBtnText}>{t("payment.copyNumber")}</UIText>

            </View>

          )}

        </Pressable>

      </View>



      <Input

        label={t("payment.senderReference")}

        value={transferNumber}

        onChangeText={onTransferNumberChange}

        placeholder={t("payment.senderReferencePlaceholder")}

        keyboardType="default"

        autoCapitalize="none"

        error={error && !transferNumber.trim() ? error : undefined}

      />



      <UIText style={styles.uploadLabel}>{t("payment.uploadReceipt")}</UIText>

      <Pressable

        onPress={onPickReceipt}

        disabled={uploading}

        accessibilityRole="button"

        accessibilityLabel={t("payment.pickReceipt")}

        style={styles.uploadBoxTouchable}>

        {({ pressed }) => (

          <View

            style={[

              styles.uploadBox,

              receiptUri && styles.uploadBoxFilled,

              pressed && styles.uploadBoxPressed,

              uploading && styles.uploadBoxDisabled,

            ]}>

            {receiptUri ? (

              <Image source={{ uri: receiptUri }} style={styles.preview} resizeMode="cover" />

            ) : (

              <View style={styles.uploadPlaceholder}>

                <Ionicons name="image-outline" size={32} color={theme.colors.text.secondary[400]} />

                <UIText style={styles.uploadPlaceholderText}>{t("payment.pickReceipt")}</UIText>

              </View>

            )}

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

    fontFamily: legacyTheme.fonts.semibold,

    color: theme.colors.text.secondary[600],

    textAlign: textAlignStart(isRtl()),

    lineHeight: 18,

  },

  numberBlock: {

    alignItems: "center",

    gap: 12,

    paddingVertical: 16,

    paddingHorizontal: 12,

    borderRadius: 16,

    backgroundColor: theme.colors.brand.primaryLight,

    borderWidth: 1,

    borderColor: theme.colors.brand.primary,

  },

  walletNumber: {

    fontSize: 32,

    fontFamily: legacyTheme.fonts.black,

    color: theme.colors.brand.primary,

    letterSpacing: 1,

    textAlign: "center",

  },

  copyBtnTouchable: {

    borderRadius: 12,

  },

  copyBtn: {

    flexDirection: flexRow(isRtl()),

    alignItems: "center",

    gap: 6,

    paddingHorizontal: 16,

    paddingVertical: 10,

    borderRadius: 12,

    backgroundColor: theme.colors.brand.primary,

  },

  copyBtnPressed: {

    opacity: 0.85,

  },

  copyBtnText: {

    fontSize: 13,

    fontFamily: legacyTheme.fonts.bold,

    color: "#fff",

  },

  uploadLabel: {

    fontSize: 12,

    fontFamily: legacyTheme.fonts.bold,

    color: theme.colors.text.secondary,

    textAlign: textAlignStart(isRtl()),

  },

  uploadBoxTouchable: {

    borderRadius: 14,

  },

  uploadBox: {

    minHeight: 160,

    borderRadius: 14,

    borderWidth: 1.5,

    borderColor: theme.colors.border.default,

    borderStyle: "dashed",

    overflow: "hidden",

    backgroundColor: theme.colors.canvas.background,

  },

  uploadBoxFilled: {

    borderStyle: "solid",

  },

  uploadBoxPressed: {

    opacity: 0.9,

  },

  uploadBoxDisabled: {

    opacity: 0.6,

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

    fontFamily: legacyTheme.fonts.semibold,

    color: theme.colors.text.secondary[500],

    textAlign: "center",

  },

  preview: {

    width: "100%",

    height: 200,

  },

  errorText: {

    fontSize: 12,

    fontFamily: legacyTheme.fonts.semibold,

    color: theme.colors.status.error,

    textAlign: textAlignStart(isRtl()),

  },

});

