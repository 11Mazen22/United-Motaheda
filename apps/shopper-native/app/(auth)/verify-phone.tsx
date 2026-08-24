import { defaultTheme as theme } from "@pharmacy/ui-native";
/**

 * /(auth)/verify-phone — full-screen phone-OTP step after email confirmation.

 *

 * Logic unchanged. Migrated from theme.* to kit.* tokens (Phase 2).

 */



import React, { useEffect, useState } from "react";

import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { useTranslation } from "react-i18next";

import { PhoneVerifyModal, sendPhoneOtp } from "@/features/auth";

import { Text } from "@pharmacy/ui-native";



import { flexRow, isRtl } from "@/utils/layout";



const IS_RTL = isRtl();



export default function VerifyPhoneScreen() {

  const { t } = useTranslation();

  const router = useRouter();

  const { phone } = useLocalSearchParams<{ phone?: string }>();

  const phoneStr = typeof phone === "string" ? phone : "";



  const [stage, setStage] = useState<"sending" | "modal" | "error">("sending");

  const [errorMsg, setErrorMsg] = useState<string>("");



  useEffect(() => {

    if (!phoneStr) {

      router.replace("/(customer)/(tabs)");

      return;

    }

    let cancelled = false;

    (async () => {

      try {

        await sendPhoneOtp(phoneStr);

        if (!cancelled) setStage("modal");

      } catch {

        if (cancelled) return;

        setErrorMsg(t("verifyPhone.errorDefault"));

        setStage("error");

        setTimeout(() => router.replace("/(customer)/(tabs)"), 2200);

      }

    })();

    return () => { cancelled = true; };
  }, [phoneStr, router, t]);



  if (stage === "sending" || stage === "error") {

    const isError = stage === "error";

    return (

      <View style={s.screen}>

        <Animated.View entering={FadeIn.duration(360)} style={s.centerStack}>



          {/* Layered ring icon */}

          <Animated.View

            entering={FadeInUp.duration(420).delay(80).springify().damping(18)}

            style={s.outerRing}>

            <View style={[s.innerTile, isError && s.innerTileError]}>

              <Ionicons

                name={isError ? "alert-circle-outline" : "chatbubble-ellipses-outline"}

                size={30}

                color={isError ? "#E53E3E" : theme.colors.brand.primary}

              />

            </View>

          </Animated.View>



          <Animated.View entering={FadeInUp.duration(420).delay(160)} style={s.textStack}>

            <Text variant="sheet-title" align="center" style={s.title}>

              {isError ? t("verifyPhone.errorTitle") : t("verifyPhone.sendingTitle")}

            </Text>

            <Text variant="body" color="secondary" align="center" style={s.subtitle}>

              {isError ? errorMsg : t("verifyPhone.sendingSubtitle")}

            </Text>

          </Animated.View>



          {!isError && (

            <Animated.View entering={FadeIn.duration(300).delay(280)} style={{ marginTop: 28 }}>

              <ActivityIndicator size="large" color={theme.colors.brand.primary} />

            </Animated.View>

          )}



          {/* Trust footnote */}

          <View style={[s.trustFootnote, { flexDirection: flexRow(IS_RTL) }]}>

            <Ionicons name="shield-checkmark" size={12} color={theme.colors.text.muted} />

            <Text variant="eyebrow" color="tertiary">

              {t("verifyPhone.trustNote")}

            </Text>

          </View>

        </Animated.View>

      </View>

    );

  }



  return (

    <View style={s.screen}>

      <PhoneVerifyModal

        visible

        initialPhone={phoneStr}

        onVerified={() => router.replace("/(customer)/(tabs)")}

        onCancel={() => router.replace("/(customer)/(tabs)")}

      />

    </View>

  );

}



const s = StyleSheet.create({

  screen: { flex: 1, backgroundColor: theme.colors.canvas.background },



  centerStack: {

    flex:              1,

    alignItems:        "center",

    justifyContent:    "center",

    paddingHorizontal: 32,

  },



  // Layered ring icon

  outerRing: {

    width:           100,

    height:          100,

    borderRadius:    50,

    backgroundColor: theme.colors.brand.primaryLight,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

    marginBottom:    28,

  },

  innerTile: {

    width:           68,

    height:          68,

    borderRadius:    22,

    backgroundColor: theme.colors.canvas.surface,

    borderWidth:     1,

    borderColor:     theme.colors.border.default,

    alignItems:      "center",

    justifyContent:  "center",

    ...theme.shadows[2],

  },

  innerTileError: {

    backgroundColor: "rgba(229,62,62,0.06)",

    borderColor:     "rgba(229,62,62,0.20)",

  },



  textStack: {

    alignItems: "center",

    gap:        8,

    maxWidth:   340,

  },

  title:    { letterSpacing: -0.4 },

  subtitle: { lineHeight: 22 },



  trustFootnote: {

    position:       "absolute",

    bottom:         56,

    start: 0,

    end: 0,

    alignItems:     "center",

    justifyContent: "center",

    gap:            6,

  },

});

