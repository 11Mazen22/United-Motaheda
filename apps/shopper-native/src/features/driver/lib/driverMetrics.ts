import type { DriverEarningRecord } from "../api";
import type { ManifestOrder } from "../api";
import type { DeliveryAssignment } from "../api";
import type { DeliveryStage } from "./deliveryStage";

/** One day's aggregated earnings, used in weekly breakdowns. */
export interface DailyEarning {
  date: string;
  total: number;
}

/** Sum of earnings recorded today (UTC date boundary). */
export function computeTodayEarnings(earnings: DriverEarningRecord[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return earnings
    .filter((e) => e.earnedAt.startsWith(today))
    .reduce((sum, e) => sum + e.totalAmount, 0);
}

/** Count of orders whose backend status indicates delivery is complete today. */
export function computeCompletedToday(orders: ManifestOrder[]): number {
  return orders.filter((o) => o.status === "delivered" || o.status === "archived").length;
}

/** Array of 7 days ending today, each with the total earned on that day. */
export function computeWeeklyEarnings(earnings: DriverEarningRecord[]): DailyEarning[] {
  const days: DailyEarning[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const total = earnings
      .filter((e) => e.earnedAt.startsWith(dateStr))
      .reduce((sum, e) => sum + e.totalAmount, 0);
    days.push({ date: dateStr, total });
  }
  return days;
}

/** Acceptance rate across all responded assignments; null when no history exists. */
export function computeAcceptanceRate(assignments: DeliveryAssignment[]): number | null {
  const relevant = assignments.filter(
    (a) => a.responseStatus === "accepted" || a.responseStatus === "declined"
  );
  if (relevant.length === 0) return null;
  const accepted = relevant.filter((a) => a.responseStatus === "accepted").length;
  return Math.round((accepted / relevant.length) * 100);
}

/** Consecutive calendar days ending today that contain at least one delivery earning. */
export function computeStreakDays(earnings: DriverEarningRecord[]): number {
  if (earnings.length === 0) return 0;
  const days = new Set(earnings.map((e) => e.earnedAt.slice(0, 10)));
  const today = new Date();
  let streak = 0;
  let d = new Date(today);
  while (true) {
    const dateStr = d.toISOString().slice(0, 10);
    if (days.has(dateStr)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Human-readable duration from a minute count (e.g. 125 -> "2h 5m"). */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Numeric priority for sorting orders by urgency (lower = more urgent). */
export function getStagePriority(stage: DeliveryStage): number {
  const priority: Record<DeliveryStage, number> = {
    to_pharmacy: 0,
    at_pharmacy: 1,
    to_customer: 2,
    at_customer: 3,
    delivered: 4,
    unknown: 5,
  };
  return priority[stage] ?? 5;
}
