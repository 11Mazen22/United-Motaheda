import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { kit } from "@/shared/kit";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text } from "@/shared/ui";
import { theme } from "@/shared/theme";
import {
  fullPanelStyles as fp,
  skeletonStyles as sk,
} from "./wallet.styles";
import { SubScreenHeader } from "../SubScreenHeader";

// ─── ScreenHeader ─────────────────────────────────────────────────────────────
//
// Wallet-family wrapper around the canonical SubScreenHeader. Wallet screens
// kept the old "title + optional tour button + back" signature; we forward to
// SubScreenHeader's `rightElement` slot to retain a single header model across
// the loyalty ecosystem without churning every wallet caller's import path.

interface ScreenHeaderProps {
  title:         string;
  onTourPress?:  () => void;
}

export const ScreenHeader = memo(function ScreenHeader({
  title,
  onTourPress,
}: ScreenHeaderProps) {
  const { t } = useTranslation();
  return (
    <SubScreenHeader
      title={title}
      rightElement={
        onTourPress ? (
          <Pressable
            onPress={onTourPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("loyalty.walletTourA11y")}
            style={({ pressed }) => [
              tourStyles.tourBtn,
              pressed && { opacity: 0.78, transform: [{ scale: 0.94 }] },
            ]}>
            <Ionicons name="help-circle-outline" size={22} color={theme.colors.text.secondary} />
          </Pressable>
        ) : undefined
      }
    />
  );
});

const tourStyles = StyleSheet.create({
  tourBtn: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    marginEnd:       4,
  },
});

// ─── WalletSkeleton ───────────────────────────────────────────────────────────

export const WalletSkeleton = memo(function WalletSkeleton() {
  return (
    <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: 12, gap: 12 }}>
      <View style={sk.hero} />
      <View style={sk.actions}>
        {[0, 1, 2, 3].map((i) => <View key={i} style={sk.tile} />)}
      </View>
      <View style={sk.row} />
      <View style={sk.row} />
    </View>
  );
});

// ─── ErrorPanel ───────────────────────────────────────────────────────────────

export const ErrorPanel = memo(function ErrorPanel({
  onRetry,
}: {
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={fp.panel}>
      <Ionicons name="cloud-offline-outline" size={40} color={theme.colors.slate[400]} />
      <Text style={fp.title}>{t("loyalty.walletErrorTitle")}</Text>
      <Text style={fp.body}>{t("loyalty.walletErrorBody")}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [fp.btn, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}
        accessibilityRole="button"
        accessibilityLabel={t("common.retry")}>
        <View style={[fp.btnGrad, { backgroundColor: kit.color.accent }]}>
          <Ionicons name="refresh" size={14} color={kit.color.onInk} />
          <Text style={fp.btnText}>{t("common.retry")}</Text>
        </View>
      </Pressable>
    </View>
  );
});

// ─── UnauthPanel ──────────────────────────────────────────────────────────────

export const UnauthPanel = memo(function UnauthPanel() {
  const { t } = useTranslation();
  return (
    <View style={fp.panel} accessibilityRole="text">
      <Ionicons name="lock-closed-outline" size={40} color={theme.colors.slate[400]} />
      <Text style={fp.title}>{t("loyalty.walletUnauthTitle")}</Text>
      <Text style={fp.body}>{t("loyalty.walletUnauthBody")}</Text>
    </View>
  );
});
