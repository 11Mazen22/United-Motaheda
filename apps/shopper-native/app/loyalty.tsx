/**
 * Loyalty Hub — برنامج المكافآت.
 *
 * Main entry point for the loyalty programme. Shows the user's tier, live
 * balance, active campaigns, quick links to wallet / coupons / gifts / history,
 * recent ledger activity, and tips for earning more points.
 */

import React, { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text as UIText } from "@/shared/ui";
import { ErrorBoundary } from "@/shared/components";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl } from "@/utils/layout";
import { LoyaltyHubScreen } from "@/features/loyalty";

function LoyaltyFallback({ reset, error }: { reset: () => void; error: Error }) {
  const router = useRouter();
  const { t }  = useTranslation();
  const insets = useSafeAreaInsets();

  const stackLines = __DEV__
    ? (error.stack ?? "").split("\n").slice(0, 6).join("\n")
    : "";

  return (
    <View style={[f.screen, { paddingTop: insets.top + 16 }]}>
      <View style={f.center}>
        <View style={f.iconWell}>
          <Ionicons name="star-outline" size={34} color={kit.color.accentDeep} />
        </View>

        <UIText style={f.title} maxFontSizeMultiplier={1.3}>
          {t("loyalty.errorTitle")}
        </UIText>
        <UIText style={f.body} maxFontSizeMultiplier={1.4}>
          {t("loyalty.errorBody")}
        </UIText>

        {__DEV__ && (
          <View style={f.devBox}>
            <UIText style={f.devLabel}>DEV — render error</UIText>
            <ScrollView style={f.devScroll} nestedScrollEnabled>
              <UIText style={f.devMsg} selectable>
                {error.message || "(no message)"}
              </UIText>
              {stackLines.length > 0 && (
                <UIText style={f.devStack} selectable>{stackLines}</UIText>
              )}
            </ScrollView>
          </View>
        )}

        <Pressable
          onPress={reset}
          accessibilityRole="button"
          accessibilityLabel={t("common.retry")}
          style={({ pressed }) => [f.primaryBtn, { flexDirection: flexRow(isRtl()) }, pressed && { opacity: 0.9 }]}>
          <Ionicons name="refresh" size={15} color={kit.color.onInk} />
          <UIText style={f.primaryBtnText}>{t("common.retry")}</UIText>
        </Pressable>

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          hitSlop={8}
          style={f.ghostBtn}>
          <UIText style={f.ghostBtnText}>{t("common.back")}</UIText>
        </Pressable>
      </View>
    </View>
  );
}

export default function LoyaltyRoute() {
  const router = useRouter();

  const onGoToWallet    = useCallback(() => router.push("/wallet"),           [router]);
  const onGoToCoupons   = useCallback(() => router.push("/coupons"),          [router]);
  const onGoToGifts     = useCallback(() => router.push("/gifts"),            [router]);
  const onGoToHistory   = useCallback(() => router.push("/loyalty-history"),  [router]);
  const onGoToTiers     = useCallback(() => router.push("/tiers"),            [router]);
  const onGoToCampaigns = useCallback(() => router.push("/campaigns"),        [router]);
  const onGoToInvite    = useCallback(() => router.push("/invite"),           [router]);
  const onGoToShop      = useCallback(() => router.push("/(tabs)/products"),  [router]);

  return (
    <View style={{ flex: 1, backgroundColor: kit.color.canvas }}>
      <ErrorBoundary
        surface="loyalty"
        fallback={(reset, error) => <LoyaltyFallback reset={reset} error={error} />}>
        <LoyaltyHubScreen
          onGoToWallet={onGoToWallet}
          onGoToCoupons={onGoToCoupons}
          onGoToGifts={onGoToGifts}
          onGoToHistory={onGoToHistory}
          onGoToTiers={onGoToTiers}
          onGoToCampaigns={onGoToCampaigns}
          onGoToInvite={onGoToInvite}
          onGoToShop={onGoToShop}
        />
      </ErrorBoundary>
    </View>
  );
}

const f = StyleSheet.create({
  screen: { flex: 1, backgroundColor: kit.color.canvas },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 14 },
  iconWell: {
    width: 80, height: 80, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
    backgroundColor: kit.color.accentTint,
    borderWidth: 1, borderColor: kit.color.line,
    marginBottom: 6, ...kit.shadow.raised,
  },
  title: {
    fontFamily: theme.fonts.black, fontSize: 18, lineHeight: 26,
    color: kit.color.ink, textAlign: "center", includeFontPadding: false,
  },
  body: {
    fontFamily: theme.fonts.regular, fontSize: 13, lineHeight: 20,
    color: kit.color.inkSoft, textAlign: "center", maxWidth: 300, includeFontPadding: false,
  },
  devBox: {
    alignSelf: "stretch", marginTop: 8, padding: 12, borderRadius: 12,
    backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", maxHeight: 200,
  },
  devScroll: { maxHeight: 170 },
  devLabel: { fontSize: 10, fontFamily: theme.fonts.black, color: "#92400E", marginBottom: 4, letterSpacing: 0.6 },
  devMsg:   { fontSize: 12, fontFamily: theme.fonts.bold, color: "#7C2D12", marginBottom: 6 },
  devStack: { fontSize: 10, color: "#92400E", lineHeight: 14 },
  primaryBtn: {
    alignItems: "center", gap: 8, backgroundColor: kit.color.ink,
    borderRadius: kit.radius.lg, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8, ...kit.shadow.raised,
  },
  primaryBtnText: { fontFamily: theme.fonts.black, fontSize: 13, color: kit.color.onInk, includeFontPadding: false },
  ghostBtn: { paddingVertical: 10, paddingHorizontal: 16, marginTop: 2 },
  ghostBtnText: { fontFamily: theme.fonts.bold, fontSize: 13, color: kit.color.inkFaint, includeFontPadding: false },
});
