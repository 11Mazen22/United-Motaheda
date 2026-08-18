import { useDarkColors } from "@/hooks/useDarkColors";
/**
 * Pharmacy transfer flow — Day-9 placeholder.
 *
 * // HANDOFF: deviated — real transfer form (source pharmacy lookup + Rx
 * // number + authorization) lands on Day 9 per HANDOFF §7.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ComingSoonScreen } from "@/shared/components";

export default function Page(): React.ReactElement {
  
  
  const { c } = useDarkColors();
const { t } = useTranslation();
  return (
    <ComingSoonScreen
      title={t("prescriptions.transferTitle")}
      subtitle={t("prescriptions.transferSubtitle")}
      icon="swap-horizontal-outline"
    />
  );
}
