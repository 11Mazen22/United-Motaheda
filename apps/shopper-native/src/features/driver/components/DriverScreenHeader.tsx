import React from "react";
import { useRouter } from "expo-router";
import { ScreenHeader, useTheme } from "@pharmacy/ui-native";

interface Props {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}

/**
 * Driver's chrome — a thin wrapper around the canonical ScreenHeader, kept
 * so every existing call site (driver screens pass {title, subtitle,
 * trailing}) needs no changes. Uses the "floating" back-button treatment
 * (a raised circular chip) and start-aligned title, matching the driver
 * persona's slightly more tactile operational feel.
 */
export function DriverScreenHeader({ title, subtitle, trailing }: Props): React.ReactElement {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <ScreenHeader
      title={title}
      subtitle={subtitle}
      trailing={trailing}
      onBack={() => router.back()}
      align="start"
      backStyle="floating"
      transparent
      style={{ height: undefined, paddingHorizontal: theme.spacing.screenH, paddingTop: 12, paddingBottom: 16 }}
    />
  );
}
