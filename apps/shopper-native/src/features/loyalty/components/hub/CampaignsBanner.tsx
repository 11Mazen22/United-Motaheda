/**
 * CampaignsBanner — horizontal FlashList of active campaigns.
 *
 * Replaces the ScrollView + .map() pattern with FlashList for proper
 * recycling and eliminating layout churn on the JS thread.
 */

import React, { useCallback } from "react";
import { View } from "react-native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Text } from "@/shared/ui";
import { theme } from "@/shared/theme";

import type { RewardCampaign } from "../../types";
import { SectionHeader } from "./SectionHeader";
import { sectionStyles, campaignStyles as cs } from "./hub.styles";

interface CampaignsBannerProps {
  campaigns: RewardCampaign[];
  isLoading: boolean;
  onSeeAll?: () => void;
}

export const CampaignsBanner = React.memo(function CampaignsBanner({
  campaigns, isLoading, onSeeAll,
}: CampaignsBannerProps) {
  const { t } = useTranslation();

  const renderItem = useCallback<ListRenderItem<RewardCampaign>>(
    ({ item }) => <CampaignCard campaign={item} />,
    [],
  );

  const keyExtractor = useCallback((item: RewardCampaign) => item.id, []);

  return (
    <View style={sectionStyles.wrap}>
      <SectionHeader
        icon="flame-outline"
        title={t("loyalty.campaignsSectionTitle")}
        ctaLabel={t("loyalty.campaignsSectionAll")}
        onCta={onSeeAll}
        accentColor={theme.colors.amber[500]}
      />

      {isLoading ? (
        // Skeleton row — three placeholder cards
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={cs.skeletonCard} />
          ))}
        </View>
      ) : (
        <FlashList
          data={campaigns}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={Separator}
        />
      )}
    </View>
  );
});

const Separator = () => <View style={{ width: 10 }} />;

// ─── CampaignCard ─────────────────────────────────────────────────────────────

const CampaignCard = React.memo(function CampaignCard({
  campaign,
}: { campaign: RewardCampaign }) {
  const { t } = useTranslation();

  const daysLeft = campaign.ends_at
    ? Math.max(0, Math.ceil(
        (new Date(campaign.ends_at).getTime() - Date.now()) / 86_400_000,
      ))
    : null;

  const isUrgent = daysLeft !== null && daysLeft <= 3;

  const gradColors: [string, string] =
    campaign.multiplier >= 3 ? ["#7C3AED", "#9333EA"]
    : campaign.multiplier >= 2 ? [theme.colors.brand[600], theme.colors.teal[500]]
    : ["#1A5276", "#2471A3"];

  return (
    <View style={[cs.card, { backgroundColor: gradColors[0] }]}>
      <View style={cs.multiplierRow}>
        <Text style={cs.multiplierNum}>×{campaign.multiplier.toFixed(1)}</Text>
        <Text style={cs.multiplierUnit}>{t("loyalty.pointsUnit")}</Text>
      </View>

      <Text style={cs.name} numberOfLines={2}>{campaign.name}</Text>

      {campaign.description ? (
        <Text style={cs.desc} numberOfLines={2}>{campaign.description}</Text>
      ) : null}

      {campaign.min_purchase_cents ? (
        <View style={cs.minSpendRow}>
          <Ionicons name="cart-outline" size={10} color="rgba(255,255,255,0.70)" />
          <Text style={cs.minSpendText}>
            {t("loyalty.minSpend", { amount: (campaign.min_purchase_cents / 100).toFixed(0) })}
          </Text>
        </View>
      ) : null}

      {daysLeft !== null && (
        <View style={cs.expiryRow}>
          <Ionicons
            name="time-outline"
            size={10}
            color={isUrgent ? theme.colors.amber[100] : "rgba(255,255,255,0.60)"}
          />
          <Text style={[cs.expiryText, isUrgent && cs.expiryTextUrgent]}>
            {daysLeft === 0
              ? t("loyalty.campaignLastDay")
              : t("loyalty.campaignDaysLeft", { n: daysLeft })}
          </Text>
        </View>
      )}
    </View>
  );
});
