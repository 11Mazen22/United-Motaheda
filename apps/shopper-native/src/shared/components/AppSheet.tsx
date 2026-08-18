/**
 * AppSheet — Global action / error / confirmation bottom sheet.
 *
 * Mount once at the root layout: <AppSheet />
 * Trigger from anywhere: showErrorSheet(...), showAuthSheet(), etc.
 *
 * Design: premium glass card with spring physics, typed icon glow, drag-to-dismiss.
 */

import React, { useEffect } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  useAppSheetStore,
  type AppSheetAction,
  type AppSheetType,
} from "@/shared/store/appSheetStore";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";

const { height: SCREEN_H } = Dimensions.get("window");
const DISMISS_THRESHOLD     = 90;
const DISMISS_VELOCITY      = 700;

// ─── Per-type visual config ───────────────────────────────────────────────────

type TypeCfg = {
  icon:     React.ComponentProps<typeof Ionicons>["name"];
  grad:     [string, string];
  glow:     string;
  badge:    string;
  badgeBg:  string;
};

const TYPE_CFG: Record<AppSheetType, TypeCfg> = {
  error: {
    icon:    "close-circle",
    grad:    ["#FF7676", kit.color.danger],
    glow:    "rgba(239,68,68,0.28)",
    badge:   "sheet.badge.error",
    badgeBg: "rgba(239,68,68,0.12)",
  },
  warning: {
    icon:    "warning",
    grad:    [kit.color.warn, kit.color.warn],
    glow:    "rgba(245,158,11,0.28)",
    badge:   "sheet.badge.warning",
    badgeBg: "rgba(245,158,11,0.12)",
  },
  success: {
    icon:    "checkmark-circle",
    grad:    ["#34D399", "#059669"],
    glow:    "rgba(5,150,105,0.28)",
    badge:   "sheet.badge.success",
    badgeBg: "rgba(5,150,105,0.12)",
  },
  info: {
    icon:    "information-circle",
    grad:    ["#60A5FA", "#2563EB"],
    glow:    "rgba(37,99,235,0.28)",
    badge:   "sheet.badge.info",
    badgeBg: "rgba(37,99,235,0.12)",
  },
  auth: {
    icon:    "person-circle",
    grad:    ["#A78BFA", "#6D28D9"],
    glow:    "rgba(109,40,217,0.28)",
    badge:   "sheet.badge.auth",
    badgeBg: "rgba(109,40,217,0.12)",
  },
  "out-of-zone": {
    icon:    "location",
    grad:    ["#FB923C", "#EA580C"],
    glow:    "rgba(234,88,12,0.28)",
    badge:   "sheet.badge.outOfZone",
    badgeBg: "rgba(234,88,12,0.12)",
  },
  confirm: {
    icon:    "alert-circle",
    grad:    [kit.color.warn[400], kit.color.warn[600]],
    glow:    "rgba(217,119,6,0.28)",
    badge:   "sheet.badge.confirm",
    badgeBg: "rgba(217,119,6,0.12)",
  },
  network: {
    icon:    "wifi-outline",
    grad:    ["#818CF8", "#4F46E5"],
    glow:    "rgba(79,70,229,0.28)",
    badge:   "sheet.badge.network",
    badgeBg: "rgba(79,70,229,0.12)",
  },
};

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({ action, cfg }: { action: AppSheetAction; cfg: TypeCfg }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onIn  = () => { scale.value = withSpring(0.96, { damping: 14, stiffness: 500 }); };
  const onOut = () => { scale.value = withSpring(1.0,  { damping: 12, stiffness: 400 }); };

  const isP = action.variant === "primary" || !action.variant;
  const isD = action.variant === "danger";
  const isG = action.variant === "ghost";

  return (
    <Pressable
      onPressIn={onIn}
      onPressOut={onOut}
      onPress={action.onPress}
      accessibilityRole="button">
      <Animated.View style={anim}>
        {isP || isD ? (
          <LinearGradient
            colors={isD ? ["#FF7676", kit.color.danger[500]] : cfg.grad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.btnPrimary}>
            <UIText style={s.btnPrimaryTxt}>{action.label}</UIText>
          </LinearGradient>
        ) : (
          <View style={[s.btnSecondary, isG && s.btnGhost]}>
            <UIText style={[s.btnSecTxt, isG && s.btnGhostTxt]}>{action.label}</UIText>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export function AppSheet() {
  const { t }               = useTranslation();
  const insets              = useSafeAreaInsets();
  const { visible, config, hide } = useAppSheetStore();

  const translateY  = useSharedValue(SCREEN_H);
  const overlayOp   = useSharedValue(0);
  const iconScale   = useSharedValue(0.4);
  const iconOp      = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      overlayOp.value  = withTiming(1,   { duration: 220 });
      translateY.value = withSpring(0,    { damping: 24, stiffness: 300, mass: 0.9 });
      iconScale.value  = withSpring(1,    { damping: 14, stiffness: 280, mass: 0.7 });
      iconOp.value     = withTiming(1,    { duration: 200 });
    } else {
      overlayOp.value  = withTiming(0,    { duration: 180 });
      translateY.value = withSpring(SCREEN_H, { damping: 26, stiffness: 350 });
      iconScale.value  = withTiming(0.4,  { duration: 150 });
      iconOp.value     = withTiming(0,    { duration: 150 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity:        overlayOp.value,
    pointerEvents:  (overlayOp.value > 0.01 ? "auto" : "none") as any,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity:   iconOp.value,
  }));

  // Drag-to-dismiss
  const panStart = useSharedValue(0);
  const gesture = Gesture.Pan()
    .onStart(() => { panStart.value = translateY.value; })
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(hide)();
      } else {
        translateY.value = withSpring(0, { damping: 24, stiffness: 300 });
      }
    });

  if (!config) return null;

  const cfg     = TYPE_CFG[config.type];
  const actions = config.actions ?? [];
  const pb      = Math.max(insets.bottom + 8, 28);

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, s.overlay, overlayStyle]}
        pointerEvents={visible ? "auto" : "none"}>
        <Pressable
          style={StyleSheet.absoluteFillObject}
          onPress={config.dismissible !== false ? hide : undefined}
        />
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[s.sheet, sheetStyle, { paddingBottom: pb }]}>
          {/* Drag handle */}
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* Type badge */}
          <View style={s.badgeRow}>
            <View style={[s.typeBadge, { backgroundColor: cfg.badgeBg }]}>
              <UIText style={[s.typeBadgeTxt, { color: cfg.grad[1] }]}>
                {t(cfg.badge)}
              </UIText>
            </View>
          </View>

          {/* Icon */}
          <View style={s.iconRow}>
            <Animated.View style={[s.iconGlowWrap, { shadowColor: cfg.glow }, iconStyle]}>
              <LinearGradient
                colors={cfg.grad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.iconCircle}>
                <Ionicons name={cfg.icon} size={34} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </View>

          {/* Text */}
          <View style={s.textBlock}>
            <UIText style={s.title}>{config.title}</UIText>
            <UIText style={s.message}>{config.message}</UIText>
          </View>

          {/* Divider */}
          {actions.length > 0 && <View style={s.divider} />}

          {/* Actions */}
          {actions.length > 0 && (
            <View style={s.actions}>
              {actions.map((action, i) => (
                <ActionBtn key={i} action={action} cfg={cfg} />
              ))}
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(4, 12, 28, 0.62)",
  },
  sheet: {
    position:        "absolute",
    bottom:          0,
    start: 0,
    end: 0,
    backgroundColor: "#FFFFFF",
    borderTopStartRadius:  32,
    borderTopEndRadius: 32,
    shadowColor:     "#0A1628",
    shadowOffset:    { width: 0, height: -6 },
    shadowOpacity:   0.16,
    shadowRadius:    24,
    elevation:       32,
    boxShadow:       "0px -6px 24px rgba(10,22,40,0.16)",
    zIndex:          9999,
    overflow:        "hidden",
  },
  handleRow: {
    alignItems:  "center",
    paddingTop:  14,
    paddingBottom: 4,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    2,
    backgroundColor: "rgba(15,23,42,0.14)",
  },
  badgeRow: {
    alignItems:    "center",
    paddingTop:    12,
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical:   5,
    borderRadius:      20,
  },
  typeBadgeTxt: {
    fontSize:    11,
    fontFamily:  "Cairo_700Bold",
    letterSpacing: 0.4,
  },
  iconRow: {
    alignItems:    "center",
    paddingTop:    20,
    paddingBottom: 4,
  },
  iconGlowWrap: {
    width:         72,
    height:        72,
    borderRadius:  36,
    overflow:      "hidden",
  },
  iconCircle: {
    width:          72,
    height:         72,
    borderRadius:   36,
    alignItems:     "center",
    justifyContent: "center",
  },
  textBlock: {
    paddingHorizontal: 32,
    paddingTop:        20,
    paddingBottom:     8,
    alignItems:        "center",
    gap:               10,
  },
  title: {
    fontSize:    22,
    fontFamily:  "Cairo_800ExtraBold",
    color:       "#0A1628",
    textAlign:   "center",
    lineHeight:  30,
  },
  message: {
    fontSize:    14,
    fontFamily:  "Cairo_400Regular",
    color:       "#4A5568",
    textAlign:   "center",
    lineHeight:  22,
  },
  divider: {
    height:           StyleSheet.hairlineWidth,
    backgroundColor:  "rgba(15,23,42,0.08)",
    marginHorizontal: 0,
    marginTop:        20,
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop:        16,
    gap:               10,
  },

  // Buttons
  btnPrimary: {
    height:         52,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
  },
  btnPrimaryTxt: {
    fontSize:   15,
    fontFamily: "Cairo_800ExtraBold",
    color:      "#FFFFFF",
    letterSpacing: 0.2,
  },
  btnSecondary: {
    height:         52,
    borderRadius:   16,
    alignItems:     "center",
    justifyContent: "center",
    borderWidth:    1.5,
    borderColor:    "rgba(15,23,42,0.14)",
    backgroundColor: "rgba(15,23,42,0.03)",
  },
  btnGhost: {
    borderWidth:     0,
    backgroundColor: "transparent",
  },
  btnSecTxt: {
    fontSize:   14,
    fontFamily: "Cairo_700Bold",
    color:      kit.color.inkSoft,
  },
  btnGhostTxt: {
    color: kit.color.inkSoft,
  },
});
