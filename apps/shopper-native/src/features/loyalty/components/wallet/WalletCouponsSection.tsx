import React, { memo, useCallback, useState } from "react";
import { Platform, Pressable, Share, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Text } from "@/shared/ui";
import { theme } from "@/shared/theme";
import type { Coupon } from "../../types";
import { FORWARD_CHEVRON, FORWARD_ARROW } from "@/utils/layout";
import {
  cardStyles as cs,
  sectionHeaderStyles as sh,
  feedbackStyles as fs,
  skeletonStyles as sk,
} from "./wallet.styles";

interface WalletCouponsSectionProps {
  isLoading: boolean;
  isError:   boolean;
  coupons:   Coupon[];
  onRetry:   () => void;
  onBrowse?: () => void;
}

export const WalletCouponsSection = memo(function WalletCouponsSection({
  isLoading,
  isError,
  coupons,
  onRetry,
  onBrowse,
}: WalletCouponsSectionProps) {
  const { t } = useTranslation();

  if (isLoading) return <CouponsSkeleton />;
  if (isError)   return <ErrorRow onRetry={onRetry} />;

  const active = coupons.filter((c) => c.state === "issued");

  if (coupons.length === 0) {
    return (
      <EmptyCard
        icon="pricetag-outline"
        title={t("loyalty.walletNoCoupons")}
        body={t("loyalty.walletNoCouponsBody")}
        ctaLabel={t("loyalty.walletBrowseCoupons")}
        onCta={onBrowse}
      />
    );
  }

  if (active.length === 0) {
    return (
      <View style={fs.emptyRow}>
        <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.brand[600]} />
        <Text style={fs.emptyText}>{t("loyalty.walletCouponsAllUsed")}</Text>
      </View>
    );
  }

  return (
    <View style={cs.list}>
      {active.slice(0, 3).map((c) => <CouponCard key={c.id} coupon={c} />)}
      {active.length > 3 && onBrowse && (
        <Pressable onPress={onBrowse} style={cs.showMoreBtn} accessibilityRole="button">
          <Text style={cs.showMoreText}>
            {t("loyalty.walletMoreCoupons", { n: active.length - 3 })}
          </Text>
          <Ionicons name={FORWARD_CHEVRON} size={14} color={theme.colors.brand[600]} />
        </Pressable>
      )}
    </View>
  );
});

// ─── CouponCard ───────────────────────────────────────────────────────────────

const CouponCard = memo(function CouponCard({ coupon }: { coupon: Coupon }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const expiry = coupon.expires_at
    ? new Date(coupon.expires_at).toLocaleDateString("ar-EG", {
        day: "numeric",
        month: "short",
      })
    : null;

  const handleCopy = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await Share.share({ message: coupon.code, title: t("loyalty.couponShareTitle") });
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* user cancelled */
    }
  }, [coupon.code, t]);

  return (
    <View
      style={cs.couponCard}
      accessibilityRole="text"
      accessibilityLabel={t("loyalty.couponA11y", {
        code:   coupon.code,
        expiry: expiry ? t("loyalty.couponExpiryA11y", { date: expiry }) : "",
      })}>
      <View style={cs.couponAccent} />
      <View style={{ flex: 1 }}>
        <Text style={cs.couponCode} maxFontSizeMultiplier={1.2}>
          {coupon.code}
        </Text>
        {expiry && (
          <Text style={cs.couponExpiry} maxFontSizeMultiplier={1.3}>
            {t("loyalty.validUntil", { date: expiry })}
          </Text>
        )}
      </View>
      <View style={cs.activeBadge}>
        <Ionicons name="checkmark-circle" size={10} color="#fff" />
        <Text style={cs.activeBadgeText}>{t("loyalty.couponAvailable")}</Text>
      </View>
      <Pressable
        onPress={handleCopy}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          copied ? t("loyalty.couponCopiedA11y") : t("loyalty.couponCopyA11y")
        }
        style={[cs.copyBtn, copied && cs.copyBtnDone]}>
        <Ionicons
          name={copied ? "checkmark" : "copy-outline"}
          size={15}
          color={copied ? "#fff" : theme.colors.brand[700]}
        />
      </Pressable>
    </View>
  );
});

// ─── Shared feedback atoms ────────────────────────────────────────────────────

export const SectionHeader = memo(function SectionHeader({
  title,
  icon,
  onSeeAll,
}: {
  title:     string;
  icon:      React.ComponentProps<typeof Ionicons>["name"];
  onSeeAll?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={sh.row}>
      <View style={sh.titleWrap}>
        <Ionicons name={icon} size={16} color={theme.colors.brand[600]} />
        <Text style={sh.title} accessibilityRole="header">{title}</Text>
      </View>
      {onSeeAll && (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("loyalty.walletSeeAllA11y", { title })}>
          <Text style={sh.seeAll}>{t("loyalty.walletSeeAll")}</Text>
        </Pressable>
      )}
    </View>
  );
});

export const EmptyCard = memo(function EmptyCard({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  icon:       React.ComponentProps<typeof Ionicons>["name"];
  title:      string;
  body:       string;
  ctaLabel?:  string;
  onCta?:     () => void;
}) {
  return (
    <View style={fs.emptyCard}>
      <View style={fs.emptyCardIcon}>
        <Ionicons name={icon} size={26} color={theme.colors.brand[400]} />
      </View>
      <Text style={fs.emptyCardTitle}>{title}</Text>
      <Text style={fs.emptyCardBody}>{body}</Text>
      {ctaLabel && onCta && (
        <Pressable
          onPress={onCta}
          style={fs.emptyCardCta}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}>
          <Text style={fs.emptyCardCtaText}>{ctaLabel}</Text>
          <Ionicons name={FORWARD_ARROW} size={13} color={theme.colors.brand[700]} />
        </Pressable>
      )}
    </View>
  );
});

export const ErrorRow = memo(function ErrorRow({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={fs.errorRow}>
      <Text style={fs.errorRowText}>{t("loyalty.recentLoadError")}</Text>
      <Pressable
        onPress={onRetry}
        style={fs.retryBtn}
        accessibilityRole="button"
        accessibilityLabel={t("common.retry")}>
        <Ionicons name="refresh" size={13} color={theme.colors.brand[700]} />
        <Text style={fs.retryText}>{t("common.retry")}</Text>
      </Pressable>
    </View>
  );
});

export const ListSkeleton = memo(function ListSkeleton({ rows }: { rows: number }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8, paddingHorizontal: 16, marginBottom: 4 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={sk.row} accessibilityLabel={t("common.loading")} />
      ))}
    </View>
  );
});

const CouponsSkeleton = () => <ListSkeleton rows={2} />;
