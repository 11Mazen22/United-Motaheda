/**
 * rtlPager — RTL‑aware horizontal pager math (2026 Creative Refresh).
 *
 * Confirmed on‑device behaviour (Fabric / New Architecture):
 *  • Android RTL inverts the horizontal scroll‑offset origin — raw offset 0
 *    equals the LAST logical page, increasing toward the first.
 *  • iOS keeps offset 0 = first page (identity mapping).
 *
 * This module provides invert‑aware conversions so you never need to branch
 * on platform inside your UI components.
 *
 * New for 2026:
 *  • `PagerLayout` class — create an instance once and call
 *    `layout.progress(rawOffset)` / `layout.offset(index)` without repeating
 *    pageWidth and lastIndex everywhere.
 *  • Worklet‑safe `progress` and `offset` functions (still exported directly).
 *  • `contentOffsetFromEvent` helper to extract offset from scroll events.
 *  • Full JSDoc with RTL-specific examples.
 */

import { I18nManager, Platform, type NativeScrollEvent } from "react-native";

const IS_RTL = I18nManager.isRTL;

/**
 * True where the native RTL horizontal scroll‑offset origin is inverted.
 * (currently only Android with `isRTL`)
 */
export const RTL_ANDROID: boolean = IS_RTL && Platform.OS === "android";

// ── Core worklet helpers (mirror original) ──────────────────────────────

/**
 * Convert a raw horizontal scroll offset to a logical page progress.
 *
 * @param offsetX  The raw `contentOffset.x` value.
 * @param pageWidth  Width of a single page in the pager.
 * @param lastIndex  The index of the last page (e.g. `slides.length - 1`).
 * @returns A value between 0 (first page) and `lastIndex` (last page).
 *
 * @example
 * // On Android RTL, offset 0 = last page → progress = lastIndex
 * pagerProgress(0, 375, 2) // → 2 (when RTL_ANDROID true, else 0)
 */
export function pagerProgress(
  offsetX: number,
  pageWidth: number,
  lastIndex: number,
): number {
  "worklet";
  const raw = offsetX / Math.max(pageWidth, 1);
  return RTL_ANDROID ? lastIndex - raw : raw;
}

/**
 * Convert a logical page index to the raw scroll offset needed to reach it.
 *
 * @param index  Logical page index (0‑based).
 * @param pageWidth  Width of a single page.
 * @param lastIndex  Index of the last page (needed for inversion math).
 * @returns The raw `contentOffset.x` to pass to `scrollToOffset`.
 *
 * @example
 * pagerOffset(0, 375, 2) // → 0 in LTR, 750 in Android RTL
 */
export function pagerOffset(
  index: number,
  pageWidth: number,
  lastIndex: number,
): number {
  "worklet"; // now also a worklet for UI‑thread usage
  return (RTL_ANDROID ? lastIndex - index : index) * pageWidth;
}

// ── Event extraction helpers ─────────────────────────────────────────────

/**
 * Extract the horizontal scroll offset from a native scroll event.
 * Works with FlatList `onScroll` events (event.nativeEvent.contentOffset.x).
 */
export function contentOffsetX(event: { nativeEvent: NativeScrollEvent }): number {
  "worklet";
  return event.nativeEvent.contentOffset.x;
}

/**
 * Convenience: given a scroll event, page width, and last index,
 * return the logical page progress directly.
 */
export function eventProgress(
  event: { nativeEvent: NativeScrollEvent },
  pageWidth: number,
  lastIndex: number,
): number {
  "worklet";
  return pagerProgress(contentOffsetX(event), pageWidth, lastIndex);
}

// ── PagerLayout class (optional, reusable configuration) ──────────────────

/**
 * A pre‑configured pager layout that remembers `pageWidth` and `lastIndex`,
 * making repeated usage less verbose and less error‑prone.
 */
export class PagerLayout {
  readonly pageWidth: number;
  readonly lastIndex: number;

  constructor(pageWidth: number, lastIndex: number) {
    if (pageWidth <= 0) {
      throw new Error("PagerLayout: pageWidth must be > 0");
    }
    if (lastIndex < 0) {
      throw new Error("PagerLayout: lastIndex must be >= 0");
    }
    this.pageWidth = pageWidth;
    this.lastIndex = lastIndex;
  }

  /** Logical progress (0‑lastIndex) from a raw offset. Worklet‑safe. */
  progress(offsetX: number): number {
    "worklet";
    return pagerProgress(offsetX, this.pageWidth, this.lastIndex);
  }

  /** Raw offset from a logical page index. Worklet‑safe. */
  offset(index: number): number {
    "worklet";
    return pagerOffset(index, this.pageWidth, this.lastIndex);
  }

  /** Logical progress directly from a scroll event. */
  progressFromEvent(event: { nativeEvent: NativeScrollEvent }): number {
    "worklet";
    return eventProgress(event, this.pageWidth, this.lastIndex);
  }
}