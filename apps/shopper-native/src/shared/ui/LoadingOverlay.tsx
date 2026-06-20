/**
 * LoadingOverlay — covers its parent with a semi-transparent scrim and
 * a centered spinner. Use during full-screen async actions.
 */

import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Text as UIText } from "./Text";
import { theme } from "@/shared/theme";

interface LoadingOverlayProps {
  message?: string;
  /** Color of the scrim. Defaults to a subtle dark scrim. */
  scrim?: string;
}

export function LoadingOverlay({ message, scrim = "rgba(2,29,46,0.55)" }: LoadingOverlayProps) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: scrim }]}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={theme.colors.brand[500]} />
        {message && <UIText style={styles.text}>{message}</UIText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  card: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    gap: 12,
    minWidth: 140,
    ...theme.shadow.lg,
  },
  text: {
    fontSize: 12,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.slate[600],
  },
});
