/**
 * /auth-callback — lands here after OAuth (Google) or email-confirmation
 * deep links. Exchanges the PKCE `code` param for a real session, then
 * routes onward. See src/features/auth/context.tsx and socialAuth.ts for
 * the deep-link handoff that gets the user here.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Text, Button, useTheme, type NativeTheme } from "@pharmacy/ui-native";
import { supabase } from "@/lib/supabase";
import { PHONE_VERIFICATION_ENABLED } from "@/features/auth/phoneOtp";
import { flexRow, isRtl } from "@/utils/layout";

const IS_RTL = isRtl();

type Stage = "exchanging" | "error";

export default function AuthCallbackScreen(): React.ReactElement {
  const { theme } = useTheme();
  const s = useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const codeStr = typeof code === "string" ? code : "";

  const [stage, setStage] = useState<Stage>("exchanging");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!codeStr) {
      setStage("error");
      return;
    }

    (async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(codeStr);
      if (error || !data?.session) {
        setStage("error");
        return;
      }

      const phone = data.session.user.phone;
      if (PHONE_VERIFICATION_ENABLED && !phone) {
        router.replace({ pathname: "/(auth)/verify-phone", params: {} });
        return;
      }
      router.replace("/(customer)/(tabs)");
    })();
  }, [codeStr, router]);

  const isError = stage === "error";

  return (
    <View style={s.screen}>
      <Animated.View entering={FadeIn.duration(360)} style={s.centerStack}>
        <Animated.View
          entering={FadeInUp.duration(420).delay(80).springify().damping(18)}
          style={s.outerRing}
        >
          <View style={[s.innerTile, isError && s.innerTileError]}>
            <Ionicons
              name={isError ? "alert-circle-outline" : "shield-checkmark-outline"}
              size={30}
              color={isError ? theme.colors.status.error : theme.colors.brand.primary}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(420).delay(160)} style={s.textStack}>
          <Text variant="sheet-title" align="center" style={s.title}>
            {isError ? t("auth.callback.errorTitle") : t("auth.callback.title")}
          </Text>
          <Text variant="body" color="secondary" align="center" style={s.subtitle}>
            {isError ? t("auth.callback.errorBody") : t("auth.callback.body")}
          </Text>
        </Animated.View>

        {!isError ? (
          <Animated.View entering={FadeIn.duration(300).delay(280)} style={{ marginTop: 28 }}>
            <ActivityIndicator size="large" color={theme.colors.brand.primary} />
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(300).delay(200)} style={{ marginTop: 28, alignSelf: "stretch" }}>
            <Button
              label={t("auth.callback.backToLogin")}
              onPress={() => router.replace("/(auth)/login")}
            />
          </Animated.View>
        )}

        <View style={[s.trustFootnote, { flexDirection: flexRow(IS_RTL) }]}>
          <Ionicons name="lock-closed-outline" size={12} color={theme.colors.text.muted} />
          <Text variant="eyebrow" color="tertiary">
            {t("auth.callback.trustNote")}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

function getStyles(theme: NativeTheme) {
return StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },
  centerStack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  outerRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.brand.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  innerTile: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: theme.colors.canvas.surface,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows[2],
  },
  innerTileError: {
    backgroundColor: `${theme.colors.status.error}0F`,
    borderColor: `${theme.colors.status.error}33`,
  },
  textStack: {
    alignItems: "center",
    gap: 8,
    maxWidth: 340,
  },
  title: { letterSpacing: -0.4 },
  subtitle: { lineHeight: 22 },
  trustFootnote: {
    position: "absolute",
    bottom: 56,
    start: 0,
    end: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
}
