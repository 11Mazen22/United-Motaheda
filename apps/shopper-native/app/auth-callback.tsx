/**
 * /auth-callback — the landing route for Supabase Auth email-confirmation
 * links.
 *
 * Why this file exists:
 *   `Linking.createURL("auth-callback")` resolves to
 *     - `shopper://auth-callback?code=...`         in a standalone build
 *     - `exp://192.168.x.x:8081/--/auth-callback`  in Expo Go
 *     - `http://localhost:8081/auth-callback`      when developing on web
 *
 *   The first two are caught by `Linking.addEventListener("url", ...)` in
 *   AuthProvider. The third does NOT fire that listener because the OS
 *   doesn't treat a localhost URL as a deep link — Expo just navigates
 *   expo-router to the path. So we need a real screen at /auth-callback
 *   that performs the same `exchangeCodeForSession(code)` handshake.
 *
 *   On native this screen ALSO works as a redundant safety net: if the OS
 *   prefers to route the URL through expo-router instead of the
 *   `Linking` event (which can happen with universal links or certain
 *   custom-scheme configurations), this screen still finishes the job.
 *
 * UX:
 *   - Shows a spinner while the exchange is in flight (~150ms typical).
 *   - On success → replace with /(tabs). AuthProvider's onAuthStateChange
 *     will have already populated `user` by then.
 *   - On failure → show an Arabic error + a "back to login" CTA so the user
 *     isn't stranded on a black screen.
 */

import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { PHONE_VERIFICATION_ENABLED } from "@/features/auth";
import { Text } from "@/shared/ui";
import { Button } from "@/shared/kit";
import { kit } from "@/shared/kit";
import { flexRow, isRtl } from "@/utils/layout";

export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      // Provider returned an error in the query string — surface it.
      if (params.error_description) {
        setError(decodeURIComponent(String(params.error_description)));
        return;
      }
      const code = typeof params.code === "string" ? params.code : undefined;
      if (!code) {
        setError(t("authCallback.invalidLink"));
        return;
      }
      const { data, error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) {
        if (__DEV__) console.warn("[auth-callback] exchangeCodeForSession:", exErr.message);
        setError(t("authCallback.confirmFailed"));
        return;
      }
      // If phone verification is enabled AND the user gave us a phone at
      // signup that isn't yet confirmed, kick off the OTP flow. With the
      // flag OFF, skip straight to the app — we'll collect/verify the phone
      // later (e.g. at checkout) once Twilio is provisioned for production.
      if (PHONE_VERIFICATION_ENABLED) {
        const meta = data.session?.user?.user_metadata as { phone?: string } | undefined;
        const phoneConfirmed = !!data.session?.user?.phone_confirmed_at;
        const metaPhone = meta?.phone?.trim();
        if (metaPhone && !phoneConfirmed) {
          const e164 = metaPhone.startsWith("+")
            ? metaPhone
            : metaPhone.startsWith("0") && metaPhone.length === 11
              ? `+20${metaPhone.slice(1)}`
              : `+${metaPhone}`;
          router.replace({ pathname: "/(auth)/verify-phone", params: { phone: e164 } });
          return;
        }
      }
      router.replace("/(tabs)");
    };
    void run();
  }, [params.code, params.error_description, router]);

  if (error) {
    return (
      <View style={styles.center}>
        <Animated.View
          entering={FadeInUp.duration(420).springify().damping(18)}
          style={styles.errorTile}>
          <Ionicons name="alert-circle-outline" size={30} color={kit.color.danger} />
        </Animated.View>
        <Animated.View entering={FadeInUp.duration(420).delay(80)} style={styles.textStack}>
          <Text variant="sheet-title" align="center" style={styles.title}>{t("authCallback.errorTitle")}</Text>
          <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
            {error}
          </Text>
        </Animated.View>
        <Animated.View
          entering={FadeIn.duration(360).delay(220)}
          style={styles.ctaWrap}>
          <Button variant="primary" full label={t("authCallback.backToLogin")} onPress={() => router.replace("/(auth)/login")} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <Animated.View
        entering={FadeInUp.duration(420).springify().damping(18)}
        style={styles.successTile}>
        <Ionicons name="mail-open-outline" size={30} color={kit.color.accent} />
      </Animated.View>
      <Animated.View entering={FadeInUp.duration(420).delay(80)} style={styles.textStack}>
        <Text variant="sheet-title" align="center" style={styles.title}>
          {t("authCallback.confirming")}
        </Text>
        <Text variant="body" color="secondary" align="center" style={styles.subtitle}>
          {t("authCallback.confirmingBody")}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeIn.duration(300).delay(220)} style={{ marginTop: 28 }}>
        <ActivityIndicator size="large" color={kit.color.accent} />
      </Animated.View>

      {/* Trust footnote — quiet reassurance during a security-sensitive step */}
      <View style={styles.trustFootnote}>
        <Ionicons name="shield-checkmark" size={12} color={kit.color.inkFaint} />
        <Text variant="eyebrow" color="tertiary">{t("authCallback.trustNote")}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems:     "center",
    justifyContent: "center",
    backgroundColor: kit.color.canvas,
    paddingHorizontal: 32,
  },
  successTile: {
    width:           76,
    height:          76,
    borderRadius:    22,
    backgroundColor: kit.color.accentTint,
    borderWidth:     1,
    borderColor:     "rgba(14,126,116,0.25)",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    24,
    ...kit.shadow.brandGlow,
  },
  errorTile: {
    width:           76,
    height:          76,
    borderRadius:    22,
    backgroundColor: kit.color.dangerTint,
    borderWidth:     1,
    borderColor:     "rgba(239,68,68,0.25)",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    24,
  },
  textStack: {
    alignItems: "center",
    gap:        8,
    maxWidth:   340,
  },
  title: {
    letterSpacing: -0.4,
  },
  subtitle: {
    lineHeight: 22,
  },
  ctaWrap: {
    marginTop: 28,
    width:     240,
  },
  trustFootnote: {
    position:      "absolute",
    bottom:        56,
    left:          0,
    right:         0,
    flexDirection: flexRow(isRtl()),
    alignItems:    "center",
    justifyContent:"center",
    gap:           6,
  },
});
