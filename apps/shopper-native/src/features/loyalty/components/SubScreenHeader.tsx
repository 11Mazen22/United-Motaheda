/**
 * SubScreenHeader — shared header used by every loyalty sub-screen.
 *
 * Layout (RTL):
 *   [ title + optional subtitle ]  |  [ optional right action ]  |  [ ← back ]
 *   rightmost ────────────────────────────────────────────────── leftmost
 *
 * The back button calls router.back() internally so callers never have to
 * wire a prop for it. Pass `rightElement` for screen-specific actions
 * (e.g. the tour button on the wallet screen).
 */

import React from "react";
import {
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { theme } from "@/shared/theme";
import { kit } from "@/shared/kit";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";

interface SubScreenHeaderProps {
  title:         string;
  subtitle?:     string;
  /** Optional action rendered on the visual-right side (after the title). */
  rightElement?: React.ReactNode;
}

export function SubScreenHeader({
  title,
  subtitle,
  rightElement,
}: SubScreenHeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {/* ── Title block — grows, text pinned right (RTL start) ── */}
      <View style={styles.titleBlock}>
        <UIText style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </UIText>
        {subtitle ? (
          <UIText style={styles.subtitle} numberOfLines={1}>{subtitle}</UIText>
        ) : null}
      </View>

      {/* ── Optional right-side action ── */}
      {rightElement ? (
        <View style={styles.rightSlot}>{rightElement}</View>
      ) : (
        /* Invisible spacer keeps title centred when there is no right element */
        <View style={styles.sideSlotSpacer} />
      )}

      {/* ── Back button — visual left (RTL end) ── */}
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
        style={({ pressed }) => [
          styles.backBtn,
          pressed && styles.backBtnPressed,
        ]}
      >
        <Ionicons name={BACK_CHEVRON} size={22} color={kit.color.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection:     flexRow(isRtl()),
    alignItems:        "center",
    paddingHorizontal: 12,
    paddingVertical:   10,
    gap:               4,
  },

  titleBlock: {
    flex:       1,
    alignItems: "flex-end",   // text stays flush-right in RTL
    gap:        1,
  },
  title: {
    fontFamily:    theme.fonts.black,
    fontSize:      20,
    color:         kit.color.ink,
    textAlign:     textAlignStart(isRtl()),
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: theme.fonts.regular,
    fontSize:   11,
    color:      kit.color.inkFaint,
    textAlign:  textAlignStart(isRtl()),
  },

  rightSlot: {
    alignItems:     "center",
    justifyContent: "center",
  },
  /** matches backBtn width so title stays visually centred */
  sideSlotSpacer: {
    width: 40,
  },

  backBtn: {
    width:           40,
    height:          40,
    borderRadius:    12,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
  },
  backBtnPressed: {
    backgroundColor: kit.color.line,
  },
});

export default SubScreenHeader;
