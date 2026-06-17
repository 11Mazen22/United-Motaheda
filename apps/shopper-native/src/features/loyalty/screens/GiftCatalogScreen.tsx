/**
 * GiftCatalogScreen — VIP 2026 redesign on @/shared/kit.
 *
 * Design:
 *   • Header: 52px icon tile + 28px display title + balance pill (matches orders/products)
 *   • Stats band: tinted 32×32 icon wells (available / lowest cost)
 *   • Gift cards: kit.radius.lg, 4px top identity stripe (green=affordable, warn=partial, faint=soldout)
 *   • No staggered FadeInDown entry animations (V2 arch)
 *
 * Functional core preserved:
 *   • fmtN() wraps every number format (Hermes ICU variability).
 *   • safeUri() validates image URLs before <Image>.
 *   • gifts.data is Array.isArray-gated; inventory math is NaN-proof.
 *   • GiftAddressSheet mounts only while visible with an active gift.
 *   • Redemption: balance check → address → RPC / offline queue → success/error.
 */

import React, { useCallback, useState } from "react";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Text as UIText } from "@/shared/ui";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { theme } from "@/shared/theme";
import { flexRow, isRtl, textAlignStart, BACK_CHEVRON } from "@/utils/layout";
import { fmtN, safeUri } from "@/utils/format";
import { useScreenTrace } from "@/features/observability";
import { kit, Button, IconButton } from "@/shared/kit";
import { useGiftCatalog } from "../hooks/useGiftCatalog";
import { useLoyaltyBalance } from "../hooks/useLoyaltyBalance";
import { useQueuedRedeemGift } from "../hooks/useQueuedRedeemGift";
import { GiftAddressSheet } from "../components/GiftAddressSheet";
import type { GiftCatalogItem, GiftInventory, RedemptionAddress } from "../types";
import { showErrorSheet, showSuccessSheet } from "@/shared/store/appSheetStore";

type TFunc = ReturnType<typeof useTranslation>["t"];

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface CatalogEntry extends GiftCatalogItem {
  inventory?: GiftInventory;
}

const FTXT = IS_RTL
  ? { all: "الكل", affordable: "ضمن رصيدي", none: "لا توجد هدايا ضمن رصيدك الحالي" }
  : { all: "All", affordable: "Within my points", none: "No gifts within your current balance" };

function giftRemaining(gift: CatalogEntry): number | null {
  const inv = gift.inventory;
  if (!inv) return null;
  return (inv.total_stock ?? 0) - (inv.reserved ?? 0) - (inv.fulfilled ?? 0);
}
function giftInStock(gift: CatalogEntry): boolean {
  const r = giftRemaining(gift);
  return r === null || r > 0;
}
/** Discovery priority: in-stock + affordable first, then affordable, then in-stock. */
function giftPriority(gift: CatalogEntry, balance: number): number {
  return (balance >= Number(gift.points_cost) ? 2 : 0) + (giftInStock(gift) ? 1 : 0);
}

/** Stripe colour: green if affordable+inStock, warn if can't afford, faint if sold out. */
function stripeColor(canAfford: boolean, soldOut: boolean): string {
  if (soldOut)    return kit.color.inkFaint;
  if (!canAfford) return kit.color.warn;
  return kit.color.success;
}

export function GiftCatalogScreen() {
  useScreenTrace("loyalty-gifts");
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { t }   = useTranslation();
  const { width } = useWindowDimensions();

  const balance = useLoyaltyBalance();
  const gifts   = useGiftCatalog();
  const redeem  = useQueuedRedeemGift();

  const [redeemingGiftId, setRedeemingGiftId] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible]       = useState(false);
  const [activeGift, setActiveGift]           = useState<CatalogEntry | null>(null);
  const [affordableOnly, setAffordableOnly]   = useState(false);

  const refreshing =
    (balance.isFetching && !balance.isLoading) ||
    (gifts.isFetching && !gifts.isLoading);

  const HPAD     = kit.sp(5);            // 20px horizontal padding
  const cardWidth = Math.max(150, Math.floor((width - HPAD * 2 - 12) / 2));

  const onRefresh = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
    void balance.refetch();
    void gifts.refetch();
  }, [balance, gifts]);

  const handleRedeem = useCallback(
    (gift: CatalogEntry) => {
      const currentBalance = balance.data?.balance ?? 0;
      if (currentBalance < gift.points_cost) {
        showErrorSheet(
          t("loyalty.insufficientPointsTitle"),
          t("loyalty.giftInsufficientBody", {
            cost:    fmtN(gift.points_cost),
            name:    gift.name,
            balance: fmtN(currentBalance),
          }),
        );
        return;
      }
      setActiveGift(gift);
      setSheetVisible(true);
    },
    [balance.data, t],
  );

  // Clear in-flight flag + show result sheet on settle.
  React.useEffect(() => {
    if (!redeem.isPending && redeemingGiftId !== null) {
      setRedeemingGiftId(null);
      if (redeem.isError && redeem.error) {
        showErrorSheet(t("loyalty.redeemErrorTitle"), decodeRedeemError(redeem.error, t));
        redeem.reset();
      } else if (redeem.isSuccess && redeem.data) {
        showSuccessSheet(
          t("loyalty.giftRedeemSuccessTitle"),
          t("loyalty.giftRedeemSuccessBody", { balance: fmtN(redeem.data.balance) }),
        );
        redeem.reset();
        setSheetVisible(false);
        setActiveGift(null);
      }
    }
  }, [redeem.isPending, redeem.isError, redeem.error, redeem.isSuccess, redeem.data, redeemingGiftId, redeem.reset, t]);

  const closeSheet = useCallback(() => {
    if (redeem.isPending) return;
    setSheetVisible(false);
    setActiveGift(null);
  }, [redeem.isPending]);

  const handleConfirmAddress = useCallback((address: RedemptionAddress) => {
    if (!activeGift) return;
    setRedeemingGiftId(activeGift.id);
    const result = redeem.redeem({ giftId: activeGift.id, address });
    if (result.mode === "queued") {
      setRedeemingGiftId(null);
      setSheetVisible(false);
      setActiveGift(null);
      showSuccessSheet(t("loyalty.giftQueuedTitle"), t("loyalty.giftQueuedBody"));
    }
  }, [activeGift, redeem, t]);

  // ── VIP header (shared across all load states) ──────────────────────────────
  const header = (
    <View style={[s.header, { paddingTop: insets.top + 14 }]}>
      {/* Nav row: back + balance pill */}
      <View style={[s.navRow, { flexDirection: flexRow(IS_RTL) }]}>
        <IconButton
          icon={BACK_CHEVRON}
          onPress={() => router.back()}
          accessibilityLabel={t("common.back")}
        />
        {balance.data && (
          <View
            style={[s.balancePill, { flexDirection: flexRow(IS_RTL) }]}
            accessibilityRole="text"
            accessibilityLabel={t("loyalty.balanceA11y", { n: balance.data.balance })}>
            <Ionicons name="star" size={13} color={kit.color.accentDeep} />
            <UIText style={s.balanceValue}>{fmtN(balance.data.balance)}</UIText>
            <UIText style={s.balanceUnit}>نقطة</UIText>
          </View>
        )}
      </View>

      {/* Identity row: 52px icon tile + title block */}
      <View style={[s.identityRow, { flexDirection: flexRow(IS_RTL) }]}>
        <View style={s.iconTile}>
          <Ionicons name="gift-outline" size={22} color={kit.color.accentDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <UIText style={[s.eyebrow, { textAlign: TEXT_START }]}>
            {IS_RTL ? "برنامج الولاء" : "Loyalty Program"}
          </UIText>
          <UIText style={[s.title, { textAlign: TEXT_START }]} accessibilityRole="header">
            {t("loyalty.giftCatalogTitle")}
          </UIText>
        </View>
      </View>
    </View>
  );

  if (gifts.isLoading) {
    return (
      <View style={s.screen}>
        {header}
        <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
          <GridSkeleton cardWidth={cardWidth} />
        </ScrollView>
      </View>
    );
  }

  if (gifts.isError) {
    return (
      <View style={s.screen}>
        {header}
        <ErrorPanel onRetry={() => void gifts.refetch()} />
      </View>
    );
  }

  const list = Array.isArray(gifts.data) ? gifts.data : [];
  const availableCount = list.filter((gift) => {
    const inv = gift.inventory;
    if (!inv) return true;
    const remaining = (inv.total_stock ?? 0) - (inv.reserved ?? 0) - (inv.fulfilled ?? 0);
    return remaining > 0;
  }).length;
  const lowestCost = list.length
    ? Math.min(...list.map((gift) => Number(gift.points_cost) || Infinity))
    : null;
  const lowestCostValid = lowestCost !== null && Number.isFinite(lowestCost) ? lowestCost : null;

  const myBalance = balance.data?.balance ?? 0;
  const display   = list
    .filter((gift) => !affordableOnly || myBalance >= Number(gift.points_cost))
    .slice()
    .sort((a, b) => giftPriority(b, myBalance) - giftPriority(a, myBalance));

  return (
    <View style={s.screen}>
      {header}

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={kit.color.accent}
            accessibilityLabel={t("loyalty.giftCatalogRefreshA11y")}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Stats band ── */}
        <View style={[s.statsBand, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.statCell, s.statCellBorder]}>
            <View style={[s.statIconWell, { backgroundColor: kit.color.accentTint }]}>
              <Ionicons name="gift-outline" size={13} color={kit.color.accentDeep} />
            </View>
            <UIText style={s.statValue}>{fmtN(availableCount)}</UIText>
            <UIText style={s.statLabel}>{IS_RTL ? "هدايا متاحة" : "Available"}</UIText>
          </View>
          <View style={s.statCell}>
            <View style={[s.statIconWell, { backgroundColor: kit.color.warnTint }]}>
              <Ionicons name="star-outline" size={13} color={kit.color.warn} />
            </View>
            <UIText style={s.statValue}>
              {lowestCostValid !== null ? fmtN(lowestCostValid) : "—"}
            </UIText>
            <UIText style={s.statLabel}>{IS_RTL ? "أقل تكلفة" : "Lowest cost"}</UIText>
          </View>
        </View>

        {/* ── Discovery filter ── */}
        {list.length > 0 && (
          <View style={[s.filterRow, { flexDirection: flexRow(IS_RTL) }]}>
            <Pressable
              onPress={() => setAffordableOnly(false)}
              accessibilityRole="button"
              accessibilityState={{ selected: !affordableOnly }}
              style={[s.chip, !affordableOnly && s.chipActive]}>
              <UIText style={[s.chipText, !affordableOnly && s.chipTextActive]}>
                {FTXT.all}
              </UIText>
            </Pressable>
            <Pressable
              onPress={() => setAffordableOnly(true)}
              accessibilityRole="button"
              accessibilityState={{ selected: affordableOnly }}
              style={[s.chip, { flexDirection: flexRow(IS_RTL) }, affordableOnly && s.chipActive]}>
              <Ionicons
                name="star"
                size={12}
                color={affordableOnly ? kit.color.onInk : kit.color.accentDeep}
              />
              <UIText style={[s.chipText, affordableOnly && s.chipTextActive]}>
                {FTXT.affordable}
              </UIText>
            </Pressable>
          </View>
        )}

        {list.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <Ionicons name="gift-outline" size={30} color={kit.color.inkFaint} />
            </View>
            <UIText style={s.emptyText} maxFontSizeMultiplier={1.5}>
              {t("loyalty.giftCatalogEmpty")}
            </UIText>
          </View>
        ) : display.length === 0 ? (
          <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
              <Ionicons name="star-outline" size={30} color={kit.color.inkFaint} />
            </View>
            <UIText style={s.emptyText} maxFontSizeMultiplier={1.5}>{FTXT.none}</UIText>
          </View>
        ) : (
          <View style={[s.grid, { flexDirection: flexRow(IS_RTL) }]}>
            {display.map((gift) => (
              <GiftCard
                key={gift.id}
                gift={gift}
                width={cardWidth}
                currentBalance={myBalance}
                isRedeeming={redeemingGiftId === gift.id && redeem.isPending}
                onRedeem={() => handleRedeem(gift)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {sheetVisible && activeGift && (
        <GiftAddressSheet
          visible={sheetVisible}
          giftName={activeGift.name}
          pointsCost={activeGift.points_cost}
          submitting={redeem.isPending && redeemingGiftId === activeGift.id}
          onConfirm={handleConfirmAddress}
          onClose={closeSheet}
        />
      )}
    </View>
  );
}

// ─── Gift card ────────────────────────────────────────────────────────────────

interface GiftCardProps {
  gift:           CatalogEntry;
  width:          number;
  currentBalance: number;
  isRedeeming:    boolean;
  onRedeem:       () => void;
}

function GiftCard({ gift, width, currentBalance, isRedeeming, onRedeem }: GiftCardProps) {
  const { t } = useTranslation();

  const available = (() => {
    const inv = gift.inventory;
    if (!inv) return null;
    const r = (inv.total_stock ?? 0) - (inv.reserved ?? 0) - (inv.fulfilled ?? 0);
    return Math.max(Number.isFinite(r) ? r : 0, 0);
  })();
  const soldOut   = available !== null && available <= 0;
  const lowStock  = available !== null && available > 0 && available <= 3;
  const canAfford = currentBalance >= gift.points_cost;
  const disabled  = isRedeeming || soldOut;

  const statusColor = soldOut ? kit.color.inkFaint : lowStock ? kit.color.warn : kit.color.success;
  const statusLabel = soldOut
    ? t("loyalty.giftSoldOutPill")
    : lowStock
    ? t("loyalty.giftStockRemaining", { n: available })
    : IS_RTL ? "متاح الآن" : "In stock";

  const buttonLabel = isRedeeming
    ? t("loyalty.redeemLoading")
    : soldOut
    ? t("loyalty.giftRedeemSoldOut")
    : !canAfford
    ? t("loyalty.giftRedeemInsufficient")
    : t("loyalty.giftRedeem");

  const uri = safeUri(gift.image_url);

  return (
    <View
      style={[s.card, { width }]}
      accessibilityRole="text"
      accessibilityLabel={t("loyalty.giftA11y", { name: gift.name, points: fmtN(gift.points_cost) })}>

      {/* 4px identity stripe — green=affordable, warn=can't afford, faint=sold out */}
      <View style={[s.cardStripe, { backgroundColor: stripeColor(canAfford, soldOut) }]} />

      <View style={s.cardBody}>
        {/* Image stage */}
        <View style={s.cardStage}>
          {uri ? (
            <Image
              source={{ uri }}
              style={[s.cardImage, soldOut && s.cardImageMuted]}
              contentFit="contain"
              transition={150}
            />
          ) : (
            <Ionicons name="gift" size={32} color={kit.color.inkFaint} />
          )}
          {/* Points chip — ink pill, top-start corner */}
          <View style={[s.pointsChip, { flexDirection: flexRow(IS_RTL) }]}>
            <Ionicons name="star" size={9} color={kit.color.onInk} />
            <UIText style={s.pointsChipText} maxFontSizeMultiplier={1.2}>
              {fmtN(gift.points_cost)}
            </UIText>
          </View>
        </View>

        {/* Stock status */}
        <View style={[s.statusRow, { flexDirection: flexRow(IS_RTL) }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <UIText style={[s.statusText, { color: statusColor }]} maxFontSizeMultiplier={1.2}>
            {statusLabel}
          </UIText>
        </View>

        {/* Name */}
        <UIText style={s.cardName} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {gift.name}
        </UIText>

        {/* Redeem CTA */}
        <Button
          label={buttonLabel}
          onPress={onRedeem}
          variant={canAfford && !disabled ? "primary" : "secondary"}
          size="sm"
          full
          disabled={disabled || !canAfford}
          accessibilityLabel={t("loyalty.redeemBtnA11y", { name: gift.name, cost: fmtN(gift.points_cost) })}
        />
      </View>
    </View>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function GridSkeleton({ cardWidth }: { cardWidth: number }) {
  const { t } = useTranslation();
  return (
    <View style={[s.grid, { flexDirection: flexRow(IS_RTL) }]} accessibilityLabel={t("common.loading")}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={[s.card, { width: cardWidth }]}>
          <View style={[s.cardStripe, { backgroundColor: kit.color.well }]} />
          <View style={s.cardBody}>
            <View style={[s.cardStage, { backgroundColor: kit.color.well }]} />
            <View style={[s.skeletonLine, { width: "55%" }]} />
            <View style={[s.skeletonLine, { width: "80%" }]} />
            <View style={[s.skeletonLine, { height: 34, borderRadius: kit.radius.pill }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={s.errorPanel}>
      <View style={s.emptyIcon}>
        <Ionicons name="cloud-offline-outline" size={30} color={kit.color.inkFaint} />
      </View>
      <UIText style={s.errorTitle} maxFontSizeMultiplier={1.4}>
        {t("loyalty.giftCatalogErrorTitle")}
      </UIText>
      <UIText style={s.errorBody} maxFontSizeMultiplier={1.5}>
        {t("loyalty.giftCatalogErrorBody")}
      </UIText>
      <Button
        label={t("common.retry")}
        onPress={onRetry}
        variant="primary"
        size="md"
        icon="refresh"
        style={{ marginTop: kit.sp(2) }}
      />
    </View>
  );
}

function decodeRedeemError(error: Error, t: TFunc): string {
  const m = error.message ?? "";
  if (m.includes("insufficient_balance"))  return t("loyalty.redeemErrorInsufficientBalance");
  if (m.includes("out_of_stock"))          return t("loyalty.giftRedeemErrorOutOfStock");
  if (m.includes("gift_not_available"))    return t("loyalty.giftRedeemErrorNotAvailable");
  if (m.includes("account_frozen"))        return t("loyalty.redeemErrorAccountFrozen");
  if (m.includes("not_authenticated"))     return t("loyalty.redeemErrorNotAuthenticated");
  return t("loyalty.redeemErrorDefault");
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: kit.color.canvas,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: kit.sp(5),
    paddingBottom:     18,
    gap:               16,
    backgroundColor:   kit.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
    ...kit.shadow.raised,
  },
  navRow: {
    alignItems:     "center",
    justifyContent: "space-between",
  },
  balancePill: {
    alignItems:        "center",
    gap:               5,
    backgroundColor:   kit.color.accentTint,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 14,
    paddingVertical:   8,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  balanceValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           14,
    lineHeight:         20,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  balanceUnit: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    includeFontPadding: false,
  },
  identityRow: {
    alignItems: "center",
    gap:        14,
  },
  iconTile: {
    width:           52,
    height:          52,
    borderRadius:    16,
    backgroundColor: kit.color.accentTint,
    alignItems:      "center",
    justifyContent:  "center",
    borderWidth:     1,
    borderColor:     kit.color.line,
    flexShrink:      0,
  },
  eyebrow: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.accentDeep,
    letterSpacing:      0.5,
    includeFontPadding: false,
  },
  title: {
    fontFamily:         theme.fonts.black,
    fontSize:           28,
    lineHeight:         36,
    color:              kit.color.ink,
    letterSpacing:      -0.6,
    includeFontPadding: false,
  },

  // ── Scrollable content ───────────────────────────────────────────────────────
  content: {
    paddingHorizontal: kit.sp(5),
    paddingTop:        20,
    gap:               16,
  },

  // ── Stats band ───────────────────────────────────────────────────────────────
  statsBand: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  statCell: {
    flex:            1,
    alignItems:      "center",
    justifyContent:  "center",
    gap:             6,
    paddingVertical: 16,
  },
  statCellBorder: {
    borderEndWidth: StyleSheet.hairlineWidth,
    borderEndColor: kit.color.lineStrong,
  },
  statIconWell: {
    width:          32,
    height:         32,
    borderRadius:   10,
    alignItems:     "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily:         theme.fonts.black,
    fontSize:           20,
    lineHeight:         26,
    color:              kit.color.ink,
    letterSpacing:      -0.4,
    includeFontPadding: false,
  },
  statLabel: {
    fontFamily:         theme.fonts.bold,
    fontSize:           11,
    lineHeight:         16,
    color:              kit.color.inkFaint,
    includeFontPadding: false,
  },

  // ── Filter chips ─────────────────────────────────────────────────────────────
  filterRow: {
    gap: 8,
  },
  chip: {
    alignItems:        "center",
    gap:               5,
    paddingHorizontal: 14,
    height:            38,
    borderRadius:      kit.radius.pill,
    backgroundColor:   kit.color.surface,
    borderWidth:       1,
    borderColor:       kit.color.line,
  },
  chipActive: {
    backgroundColor: kit.color.ink,
    borderColor:     kit.color.ink,
  },
  chipText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           12,
    lineHeight:         17,
    color:              kit.color.inkSoft,
    includeFontPadding: false,
  },
  chipTextActive: {
    color: kit.color.onInk,
  },

  // ── Gift grid ─────────────────────────────────────────────────────────────────
  grid: {
    flexWrap:       "wrap",
    justifyContent: "space-between",
    rowGap:         12,
  },

  // ── Gift card ─────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: kit.color.surface,
    borderRadius:    kit.radius.lg,
    borderWidth:     1,
    borderColor:     kit.color.line,
    overflow:        "hidden",
    ...kit.shadow.raised,
  },
  cardStripe: {
    height: 4,
    width:  "100%",
  },
  cardBody: {
    padding: 10,
    gap:     8,
  },
  cardStage: {
    width:           "100%",
    aspectRatio:     1.05,
    borderRadius:    kit.radius.control,
    backgroundColor: kit.color.well,
    alignItems:      "center",
    justifyContent:  "center",
    overflow:        "hidden",
  },
  cardImage:      { width: "100%", height: "100%" },
  cardImageMuted: { opacity: 0.35 },
  pointsChip: {
    position:          "absolute",
    top:               8,
    start:             8,
    alignItems:        "center",
    gap:               4,
    backgroundColor:   kit.color.ink,
    borderRadius:      kit.radius.pill,
    paddingHorizontal: 9,
    paddingVertical:   4,
  },
  pointsChipText: {
    fontFamily:         theme.fonts.black,
    fontSize:           10,
    lineHeight:         14,
    color:              kit.color.onInk,
    includeFontPadding: false,
  },
  statusRow: {
    alignItems: "center",
    gap:        6,
  },
  statusDot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    flexShrink:   0,
  },
  statusText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           10,
    lineHeight:         15,
    includeFontPadding: false,
  },
  cardName: {
    fontFamily:         theme.fonts.black,
    fontSize:           13,
    lineHeight:         19,
    color:              kit.color.ink,
    textAlign:          TEXT_START,
    minHeight:          38,
    includeFontPadding: false,
  },

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonLine: {
    height:          12,
    borderRadius:    6,
    backgroundColor: kit.color.well,
  },

  // ── Empty / error ─────────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems:      "center",
    paddingVertical: kit.sp(14),
    gap:             kit.sp(3),
  },
  emptyIcon: {
    width:           68,
    height:          68,
    borderRadius:    24,
    alignItems:      "center",
    justifyContent:  "center",
    backgroundColor: kit.color.well,
  },
  emptyText: {
    fontFamily:         theme.fonts.bold,
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
  errorPanel: {
    flex:              1,
    alignItems:        "center",
    justifyContent:    "center",
    paddingHorizontal: kit.sp(8),
    gap:               kit.sp(2),
  },
  errorTitle: {
    fontFamily:         theme.fonts.black,
    fontSize:           16,
    lineHeight:         24,
    color:              kit.color.ink,
    textAlign:          "center",
    includeFontPadding: false,
  },
  errorBody: {
    fontFamily:         theme.fonts.regular,
    fontSize:           13,
    lineHeight:         20,
    color:              kit.color.inkSoft,
    textAlign:          "center",
    includeFontPadding: false,
  },
});

export default GiftCatalogScreen;
