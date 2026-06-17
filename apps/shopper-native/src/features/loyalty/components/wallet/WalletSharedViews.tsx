import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { kit } from "@/shared/kit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "@/shared/ui";
import { theme } from "@/shared/theme";
import {
  fullPanelStyles as fp,
  skeletonStyles as sk,
} from "./wallet.styles";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

// ─── ScreenHeader ─────────────────────────────────────────────────────────────

interface ScreenHeaderProps {
  title:         string;
  onTourPress?:  () => void;
}

export const ScreenHeader = memo(function ScreenHeader({
  title,
  onTourPress,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { t }  = useTranslation();

  return (
    <View style={headerStyles.row}>
      <Text style={headerStyles.title} accessibilityRole="header">{title}</Text>

      {onTourPress && (
        <Pressable
          onPress={onTourPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("loyalty.walletTourA11y")}
          style={headerStyles.tourBtn}>
          <Ionicons name="help-circle-outline" size={22} color={theme.colors.text.secondary} />
        </Pressable>
      )}

      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        style={({ pressed }) => [
          headerStyles.backBtn,
          pressed && headerStyles.backBtnPressed,
        ]}>
        <Ionicons name={BACK_CHEVRON} size={22} color={theme.colors.text.primary} />
      </Pressable>
    </View>
  );
});

const headerStyles = StyleSheet.create({
  row: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical:   theme.spacing.md,
  },
  title: {
    flex:          1,
    fontFamily:    theme.fonts.black,
    fontSize:      22,
    color:         theme.colors.text.primary,
    textAlign:     textAlignStart(isRtl()),
    letterSpacing: -0.4,
  },
  tourBtn: {
    width:           36,
    height:          36,
    borderRadius:    12,
    backgroundColor: theme.colors.subtle,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: theme.colors.subtle,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: {
    backgroundColor: theme.colors.border.default,
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
        style={fp.btn}
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
