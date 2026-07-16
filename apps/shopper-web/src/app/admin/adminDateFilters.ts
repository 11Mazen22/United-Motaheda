/**
 * adminDateFilters.ts
 * Shared date formatting + date-range filtering helpers used by the admin
 * orders and special-orders managers. Extracted verbatim (behavior-preserving)
 * from OrdersManager.tsx / SpecialOrdersManager.tsx to avoid duplication.
 */

export type Language = "ar" | "en";
export type DatePreset = "all" | "today" | "last7" | "last30" | "custom";

export function formatDate(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDateOnly(value: string, lang: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
    dateStyle: "medium",
  }).format(date);
}

export function getPresetRange(preset: Exclude<DatePreset, "custom" | "all">): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (preset === "last7") {
    start.setDate(start.getDate() - 6);
  } else if (preset === "last30") {
    start.setDate(start.getDate() - 29);
  }

  return { start, end };
}

export function isWithinSelectedDateRange(
  orderDate: string,
  preset: DatePreset,
  dateFrom: string,
  dateTo: string,
): boolean {
  const value = new Date(orderDate);
  if (Number.isNaN(value.getTime())) return false;

  if (preset === "all") return true;

  if (preset === "today" || preset === "last7" || preset === "last30") {
    const { start, end } = getPresetRange(preset);
    return value >= start && value <= end;
  }

  if (preset === "custom") {
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      if (value < start) return false;
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (value > end) return false;
    }
  }

  return true;
}
