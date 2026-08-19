import React, { useEffect } from "react";

import { Modal, Pressable, StyleSheet, View } from "react-native";

import { Text as UIText } from "@pharmacy/ui-native";

import Animated, {

  cancelAnimation,

  FadeInDown, FadeInUp,

  useAnimatedStyle, useSharedValue,

  withRepeat, withSequence, withSpring, withTiming,

useReducedMotion } from "react-native-reanimated";

import { Ionicons } from "@expo/vector-icons";

import { useTranslation } from "react-i18next";

import { theme } from "@pharmacy/design-tokens";

import { kit } from "@pharmacy/ui-native";

import { flexRow, isRtl } from "@/utils/layout";



interface AuthGateModalProps {

  visible:   boolean;

  onSignIn:  () => void;

  onDismiss: () => void;

}



export const AuthGateModal = React.memo(function AuthGateModal({

  visible,

  onSignIn,

  onDismiss,

}: AuthGateModalProps) {

  const { t } = useTranslation();



  // Pulsing ring

  const ring1    = useSharedValue(1);

  const ring1Op  = useSharedValue(0.4);



  useEffect(() => {

    if (!visible) {

      cancelAnimation(ring1);

      cancelAnimation(ring1Op);

      return;

    }

    ring1.value = withRepeat(

      withSequence(withTiming(1.30, { duration: 1600 }), withTiming(1, { duration: 1200 })),

      -1, false,

    );

    ring1Op.value = withRepeat(

      withSequence(withTiming(0, { duration: 1600 }), withTiming(0.4, { duration: 1200 })),

      -1, false,

    );

  }, [visible, ring1, ring1Op]);



  const ring1Style = useAnimatedStyle(() => ({

    transform: [{ scale: ring1.value }],

    opacity:   ring1Op.value,

  }));



  // Card entrance

  const cardScale = useSharedValue(0.88);

  const cardOp    = useSharedValue(0);



  useEffect(() => {

    if (visible) {

      cardScale.value = withSpring(1, { damping: 18, stiffness: 280 });

      cardOp.value    = withTiming(1, { duration: 240 });

    } else {

      cardScale.value = 0.88;

      cardOp.value    = 0;

    }

  }, [visible, cardScale, cardOp]);



  const cardStyle = useAnimatedStyle(() => ({

    transform: [{ scale: cardScale.value }],

    opacity:   cardOp.value,

  }));



  return (

    <Modal

      visible={visible}

      transparent

      animationType="fade"

      statusBarTranslucent

      onRequestClose={onDismiss}

      accessibilityViewIsModal>

      <Pressable style={s.backdrop} onPress={onDismiss}>

        <Animated.View

          style={[s.card, cardStyle]}

          onStartShouldSetResponder={() => true}>



          {/* Orb area — accent-tint tile with pulsing ring */}

          <View style={s.orbArea}>

            <Animated.View style={[s.ring, ring1Style]} />

            <View style={s.orb}>

              <Ionicons name="person-circle" size={42} color={kit.color.accentDeep} />

            </View>

          </View>



          <Animated.View entering={FadeInDown.delay(120).duration(280)} style={s.copy}>

            <UIText style={s.title}>{t("checkout.authGateTitle")}</UIText>

            <UIText style={s.body}>{t("checkout.authGateBody")}</UIText>

          </Animated.View>



          <Animated.View entering={FadeInDown.delay(200).duration(280)} style={s.pillsRow}>

            {(["flash-outline", "shield-checkmark-outline", "location-outline"] as const).map(

              (icon, i) => (

                <View key={i} style={s.pill}>

                  <Ionicons name={icon} size={11} color={kit.color.accentDeep} />

                </View>

              ),

            )}

          </Animated.View>



          <Animated.View entering={FadeInUp.delay(260).duration(280)} style={s.actions}>

            <Pressable

              onPress={onSignIn}

              style={({ pressed }) => [s.signInBtn, pressed && { opacity: 0.88 }]}>

              <View style={s.signInInner}>

                <Ionicons name="log-in-outline" size={18} color={kit.color.onInk} />

                <UIText style={s.signInText}>{t("checkout.authGateSignIn")}</UIText>

              </View>

            </Pressable>

            <Pressable onPress={onDismiss} hitSlop={8} style={s.dismissBtn}>

              <UIText style={s.dismissText}>{t("checkout.authGateDismiss")}</UIText>

            </Pressable>

          </Animated.View>

        </Animated.View>

      </Pressable>

    </Modal>

  );

});



const s = StyleSheet.create({

  backdrop: {

    flex:            1,

    backgroundColor: "rgba(2, 10, 22, 0.72)",

    alignItems:      "center",

    justifyContent:  "center",

    padding:         28,

  },

  card: {

    width:             "100%",

    maxWidth:          360,

    backgroundColor:   kit.color.surface,

    borderRadius:      kit.radius.sheet,

    paddingBottom:     28,

    paddingHorizontal: 24,

    alignItems:        "center",

    overflow:          "hidden",

    ...kit.shadow.floating,

  },

  orbArea: {

    marginTop:      36,

    marginBottom:   8,

    width:          110,

    height:         110,

    alignItems:     "center",

    justifyContent: "center",

  },

  ring: {

    position:        "absolute",

    width:           110,

    height:          110,

    borderRadius:    55,

    borderWidth:     1.5,

    borderColor:     kit.color.accent,

  },

  orb: {

    width:           76,

    height:          76,

    borderRadius:    38,

    backgroundColor: kit.color.accentTint,

    alignItems:      "center",

    justifyContent:  "center",

  },

  copy: {

    alignItems:   "center",

    gap:          10,

    marginTop:    16,

    marginBottom: 4,

  },

  title: {

    fontFamily:    theme.fonts.black,

    fontSize:      20,

    color:         kit.color.ink,

    textAlign:     "center",

    letterSpacing: -0.5,

    lineHeight:    26,

  },

  body: {

    fontFamily: theme.fonts.regular,

    fontSize:   13.5,

    color:      kit.color.inkSoft,

    textAlign:  "center",

    lineHeight: 20,

    maxWidth:   280,

  },

  pillsRow: {

    flexDirection: flexRow(isRtl()),

    gap:           8,

    marginTop:     16,

    marginBottom:  4,

  },

  pill: {

    width:           32,

    height:          32,

    borderRadius:    10,

    backgroundColor: kit.color.accentTint,

    alignItems:      "center",

    justifyContent:  "center",

    borderWidth:     1,

    borderColor:     kit.color.line,

  },

  actions:   { width: "100%", gap: 10, marginTop: 20 },

  signInBtn: { borderRadius: kit.radius.control, overflow: "hidden" },

  signInInner: {

    flexDirection:   flexRow(isRtl()),

    alignItems:      "center",

    justifyContent:  "center",

    gap:             10,

    paddingVertical: 16,

    borderRadius:    kit.radius.control,

    backgroundColor: kit.color.ink,

  },

  signInText: {

    fontFamily:    theme.fonts.black,

    fontSize:      15,

    color:         kit.color.onInk,

    letterSpacing: -0.3,

  },

  dismissBtn: { alignItems: "center", paddingVertical: 10 },

  dismissText: {

    fontFamily: theme.fonts.semibold,

    fontSize:   13,

    color:      kit.color.inkFaint,

  },

});

