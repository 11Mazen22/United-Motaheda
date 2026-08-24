/**

 * InteractionBanner — drug-interaction safety surface.

 *

 * Spec: HANDOFF.md §3.3 + SPEC §9.2.

 *

 * Two variants:

 *   - "card" — inline. Severity strip + drug-pair visual + summary/detail/watch list.

 *   - "full" — adds the action footer (Ask pharmacist + Cancel + Add anyway).

 *

 * Severity tones map to SPEC §10.3 — mild=neutral/warn, moderate=warn,

 * severe=danger. All copy Arabic.

 */




import React from "react";

import { View } from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useTranslation } from "react-i18next";

import { theme as legacyTheme } from "@pharmacy/design-tokens";
import { defaultTheme as theme } from "@pharmacy/ui-native";

import { Card, Text } from "@pharmacy/ui-native";

import { Button } from "@pharmacy/ui-native";

import { Badge } from "@/components/ui/Badge";

import { flexRow, isRtl } from "@/utils/layout";



export type InteractionSeverity = "mild" | "moderate" | "severe";



export interface DrugRef {

  name:    string;

  dose?:   string;

  status?: "current" | "new";

}



export interface InteractionBannerProps {

  severity:       InteractionSeverity;

  drugA:          DrugRef;

  drugB:          DrugRef;

  summary:        string;

  detail?:        string;

  watchFor?:      string[];

  onAskPharmacist?: () => void;

  onProceed?:     () => void;

  onCancel?:      () => void;

  variant?:       "card" | "full";

}



const SEVERITY_CONFIG: Record<InteractionSeverity, {

  bannerBg: string;

  bannerFg: string;

  pinBg:    string;

  badge:    "neutral" | "warning" | "error";

  labelKey: string;

  accent:   string;

}> = {

  mild: {

    bannerBg: `${theme.colors.status.warning}1A`,

    bannerFg: theme.colors.status.warning,

    pinBg:    theme.colors.status.warning,

    badge:    "neutral",

    labelKey: "interaction.severity.mild",

    accent:   theme.colors.status.warning,

  },

  moderate: {

    bannerBg: `${theme.colors.status.warning}1A`,

    bannerFg: theme.colors.status.warning,

    pinBg:    theme.colors.status.warning,

    badge:    "warning",

    labelKey: "interaction.severity.moderate",

    accent:   theme.colors.status.warning,

  },

  severe: {

    bannerBg: `${theme.colors.status.error}1A`,

    bannerFg: theme.colors.status.error,

    pinBg:    theme.colors.status.error,

    badge:    "error",

    labelKey: "interaction.severity.severe",

    accent:   theme.colors.status.error,

  },

};



function DrugPip({ drug }: { drug: DrugRef }): React.ReactElement {

  const { t } = useTranslation();

  return (

    <View style={{ flex: 1, alignItems: "center" }}>

      <View style={{

        width: 48, height: 48, borderRadius: legacyTheme.radius.lg,

        backgroundColor: theme.colors.brand.primaryLight,

        alignItems: "center", justifyContent: "center",

        marginBottom: theme.spacing[1],

      }}>

        <Ionicons name="medkit" size={22} color={theme.colors.brand.primary} />

      </View>

      <Text variant="caption" weight="extrabold" align="center">{drug.name}</Text>

      {drug.dose && <Text variant="eyebrow" color="tertiary" align="center">{drug.dose}</Text>}

      {drug.status && (

        <Text variant="eyebrow" color="tertiary" align="center" style={{ marginTop: 2 }}>

          {drug.status === "current" ? t("interaction.drugCurrent") : t("interaction.drugNew")}

        </Text>

      )}

    </View>

  );

}



export function InteractionBanner({

  severity,

  drugA,

  drugB,

  summary,

  detail,

  watchFor,

  onAskPharmacist,

  onProceed,

  onCancel,

  variant = "card",

}: InteractionBannerProps): React.ReactElement {

  const { t } = useTranslation();

  const cfg = SEVERITY_CONFIG[severity];



  return (

    <Card padding={0} radius={legacyTheme.layout.cardRadius} style={{ overflow: "hidden" }}>

      {/* Banner strip */}

      <View style={{

        flexDirection: flexRow(isRtl()),

        alignItems:        "center",

        gap:               theme.spacing[1],

        paddingHorizontal: theme.spacing[2],

        paddingVertical:   6,

        backgroundColor:   cfg.bannerBg,

      }}>

        <View style={{

          width: 36, height: 36, borderRadius: legacyTheme.radius.md,

          backgroundColor: cfg.pinBg,

          alignItems: "center", justifyContent: "center",

        }}>

          <Ionicons name="warning" size={18} color="#fff" />

        </View>

        <View style={{ flex: 1 }}>

          <Text variant="caption" weight="extrabold" align="right" style={{ color: cfg.bannerFg }}>

            {t("interaction.detected")}

          </Text>

          <Text variant="eyebrow" color="secondary" align="right" style={{ marginTop: 1 }}>

            {t("interaction.checkMeds")}

          </Text>

        </View>

        <Badge variant={cfg.badge} size="md">{t(cfg.labelKey)}</Badge>

      </View>



      <View style={{ padding: theme.spacing[2] }}>

        {/* Drug-pair visual */}

        <View style={{

          flexDirection: flexRow(isRtl()),

          alignItems:     "center",

          gap:            6,

          marginBottom:   theme.spacing[2],

        }}>

          <DrugPip drug={drugA} />

          <Ionicons name="close" size={20} color={cfg.accent} />

          <DrugPip drug={drugB} />

        </View>



        <Text variant="body" weight="bold" align="right">{summary}</Text>

        {detail && (

          <Text variant="body-sm" color="secondary" align="right" style={{ marginTop: theme.spacing[1] }}>

            {detail}

          </Text>

        )}



        {watchFor && watchFor.length > 0 && (

          <View style={{ marginTop: 6, gap: theme.spacing[1] }}>

            <Text variant="eyebrow" color="tertiary" align="right">

              {t("interaction.watchFor")}

            </Text>

            {watchFor.map((w) => (

              <View key={w} style={{ flexDirection: flexRow(isRtl()), alignItems: "center", gap: theme.spacing[1] }}>

                <Ionicons name="ellipse" size={6} color={cfg.accent} />

                <Text variant="body-sm" align="right" style={{ flex: 1 }}>{w}</Text>

              </View>

            ))}

          </View>

        )}



        {variant === "full" && (

          <View style={{ marginTop: theme.spacing[2], gap: theme.spacing[1] }}>

            {onAskPharmacist && (

              <Button

                variant="primary"

                full

                icon="chatbox"

                label={t("interaction.askPharmacist")}

                onPress={onAskPharmacist}

              />

            )}

            <View style={{ flexDirection: flexRow(isRtl()), gap: theme.spacing[1] }}>

              {onCancel && (

                <View style={{ flex: 1 }}>

                  <Button variant="secondary" full label={t("interaction.cancel")} onPress={onCancel} />

                </View>

              )}

              {onProceed && (

                <View style={{ flex: 1 }}>

                  <Button variant="ghost" full label={t("interaction.addAnyway")} onPress={onProceed} />

                </View>

              )}

            </View>

          </View>

        )}

      </View>

    </Card>

  );

}

