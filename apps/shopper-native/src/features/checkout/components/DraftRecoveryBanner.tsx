/**
 * DraftRecoveryBanner — shown at the top of the checkout screen when a
 * previous interrupted checkout session is detected.
 *
 * Shows: elapsed time since the draft was saved, the user's name from
 * the draft, and two CTAs: "Continue" (restore) and "Start fresh" (discard).
 *
 * Design: non-intrusive teal banner that slides in from the top.
 * Does not block the form — user can ignore it and keep typing.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { Ionicons }       from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text as UIText } from "@pharmacy/ui-native";
import { kit }            from "@pharmacy/ui-native";
import { theme }          from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import type { CheckoutDraft }             from "../resilience";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface Props {
  draft:    CheckoutDraft;
  onRestore: () => void;
  onDiscard: () => void;
}

function elapsedLabel(savedAt: string): string {
  const ms   = Date.now() - Date.parse(savedAt);
  const mins = Math.floor(ms / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function DraftRecoveryBanner({ draft, onRestore, onDiscard }: Props) {
  const { t } = useTranslation();
  const name  = draft.form.fullName?.split(" ")[0] ?? "";
  const ago   = elapsedLabel(draft.savedAt);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(200)}
      exiting={FadeOutUp.duration(200)}
      style={s.root}
    >
      <View style={[s.row, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={s.iconWell}>
          <Ionicons name="time-outline" size={16} color={kit.color.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <UIText
            variant="body-sm"
            weight="bold"
            style={{ textAlign: TEXT_START, color: kit.color.ink }}
          >
            {t("checkout.draftRecoveryTitle", "استكمال الطلب السابق")}
          </UIText>
          <UIText
            variant="caption"
            color="secondary"
            style={{ textAlign: TEXT_START }}
          >
            {name
              ? t("checkout.draftRecoveryBodyNamed", { name, ago })
              : t("checkout.draftRecoveryBody", { ago })}
          </UIText>
        </View>
      </View>

      <View style={[s.actions, { flexDirection: flexRow(IS_RTL) }]}>
        <Pressable
          onPress={onRestore}
          style={({ pressed }) => [s.restoreBtn, pressed && s.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.draftRestore", "استكمال")}
        >
          <Ionicons name="arrow-forward-circle" size={14} color={kit.color.onAccent} />
          <UIText style={s.restoreText}>
            {t("checkout.draftRestore", "استكمال")}
          </UIText>
        </Pressable>

        <Pressable
          onPress={onDiscard}
          style={({ pressed }) => [s.discardBtn, pressed && s.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.draftDiscard", "بدء من جديد")}
        >
          <UIText style={s.discardText}>
            {t("checkout.draftDiscard", "بدء من جديد")}
          </UIText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    marginHorizontal: kit.inset.screen,
    marginTop:        12,
    marginBottom:     4,
    backgroundColor:  kit.color.accentTint,
    borderRadius:     kit.radius.xl,
    borderWidth:      1.5,
    borderColor:      kit.color.accent,
    padding:          14,
    gap:              12,
    ...kit.shadow.card,
  },
  row: {
    alignItems: "flex-start",
    gap:        12,
  },
  iconWell: {
    width:           34,
    height:          34,
    borderRadius:    10,
    backgroundColor: "#fff",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    borderWidth:     1,
    borderColor:     kit.color.line,
  },
  actions: {
    gap: 8,
  },
  restoreBtn: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               6,
    paddingHorizontal: 16,
    paddingVertical:   9,
    borderRadius:      kit.radius.lg,
    backgroundColor:   kit.color.accent,
    ...kit.shadow.brandGlow,
  },
  discardBtn: {
    paddingHorizontal: 16,
    paddingVertical:   9,
    borderRadius:      kit.radius.lg,
    backgroundColor:   "#fff",
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  btnPressed: {
    opacity:   0.82,
    transform: [{ scale: 0.97 }],
  },
  restoreText: {
    fontSize:   12,
    fontFamily: theme.fonts.black,
    color:      "#fff",
  },
  discardText: {
    fontSize:   12,
    fontFamily: theme.fonts.bold,
    color:      kit.color.inkSoft,
  },
});
