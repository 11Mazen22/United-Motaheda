import React from "react";
import { useRouter } from "expo-router";
import { ScreenHeader, useTheme } from "@pharmacy/ui-native";

interface PharmacistScreenHeaderProps {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onBack?: () => void;
  hideBack?: boolean;
}

/**
 * Pharmacist's chrome — a thin wrapper around the canonical ScreenHeader,
 * kept so every existing call site needs no changes. Flat back-button
 * treatment and start-aligned title, on a bordered surface — the "calm
 * efficiency" persona expression stays operational/dense rather than
 * adopting driver's floating-chip back button.
 */
export function PharmacistScreenHeader({
  title,
  subtitle,
  trailing,
  onBack,
  hideBack = false,
}: PharmacistScreenHeaderProps): React.ReactElement {
  const router = useRouter();
  const { theme } = useTheme();
  return (
    <ScreenHeader
      title={title}
      subtitle={subtitle}
      trailing={trailing}
      onBack={hideBack ? undefined : (onBack ?? (() => router.back()))}
      align="start"
      backStyle="flat"
      style={{ height: undefined, paddingHorizontal: theme.spacing.screenH, paddingVertical: 16 }}
    />
  );
}
