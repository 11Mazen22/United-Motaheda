import type { Promotion, PromotionDiscountType, PromotionStatus } from "../services/promotionsApi";

export type { PromotionStatus };

/** Status is a server-owned workflow value. Date-window statuses are reconciled
 * at read time so a scheduled promotion becomes active without a cron job. */
export function getPromotionStatus(promotion: Promotion): PromotionStatus {
  if (promotion.status === "draft" || promotion.status === "paused" || promotion.status === "archived") return promotion.status;
  const now = Date.now();
  const starts = Date.parse(promotion.startsAt);
  const ends = Date.parse(promotion.endsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= now) return "expired";
  return starts > now ? "scheduled" : "active";
}

export function isExpiringSoon(promotion: Promotion, days = 3): boolean {
  if (getPromotionStatus(promotion) !== "active") return false;
  const ends = Date.parse(promotion.endsAt);
  return ends > Date.now() && ends <= Date.now() + days * 86400000;
}

export function formatDiscount(discountType: PromotionDiscountType, discountValue: number): string {
  return `${discountValue}${discountType === "percentage" ? "%" : " EGP"}`;
}

/** Mirrors the database's promotion_effective_price function for previews. */
export function getDiscountedPrice(
  basePrice: number,
  discountType: PromotionDiscountType,
  discountValue: number,
): number {
  if (!Number.isFinite(basePrice) || !Number.isFinite(discountValue)) return 0;
  const discounted = discountType === "percentage"
    ? basePrice * (1 - discountValue / 100)
    : basePrice - discountValue;
  return Math.max(0, Math.round(discounted * 100) / 100);
}

export function discountPreview(promotion: Promotion): string { return formatDiscount(promotion.discountType, promotion.discountValue); }
export function getPromotionTimeProgress(promotion: Promotion): number {
  const now = Date.now(), starts = Date.parse(promotion.startsAt), ends = Date.parse(promotion.endsAt);
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || ends <= starts) return 0;
  return Math.max(0, Math.min(100, ((now - starts) / (ends - starts)) * 100));
}
export function getDaysRemaining(promotion: Promotion): number {
  const ends = Date.parse(promotion.endsAt);
  return Number.isFinite(ends) ? Math.max(0, Math.ceil((ends - Date.now()) / 86400000)) : 0;
}
export type SortField = "name" | "discount" | "startsAt" | "endsAt";
export type SortDir = "asc" | "desc";
export function comparePromotions(a: Promotion, b: Promotion, field: SortField, dir: SortDir): number {
  const values: Record<SortField, [string | number, string | number]> = {
    name: [a.name.localeCompare(b.name), 0], discount: [a.discountValue, b.discountValue],
    startsAt: [Date.parse(a.startsAt), Date.parse(b.startsAt)], endsAt: [Date.parse(a.endsAt), Date.parse(b.endsAt)],
  };
  const [aValue, bValue] = values[field];
  const comparison = field === "name" ? Number(aValue) : aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
  return dir === "asc" ? comparison : -comparison;
}
