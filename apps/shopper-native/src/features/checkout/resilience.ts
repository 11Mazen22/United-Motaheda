/**
 * Checkout resilience utilities.
 *
 * Problems solved:
 *   1. Retry with exponential backoff for transient network/timeout errors.
 *   2. Request deduplication — a second identical call while the first is
 *      in-flight returns the same promise instead of firing twice.
 *   3. Draft persistence — partial checkout state is written to AsyncStorage
 *      so the user can recover after a crash or backgrounded-then-killed session.
 *   4. Stale-draft detection — drafts older than MAX_DRAFT_AGE_MS are discarded.
 *
 * Architecture:
 *   Everything here is pure logic — no React, no Zustand, no UI.
 *   The hook layer (useCheckoutFlow) calls these utilities.
 *   The server-side idempotency key is the final guard against duplicates;
 *   this module reduces unnecessary network traffic, not correctness.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { CheckoutRequestError } from "./errors";

// ─── Retry ────────────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum attempts including the first call (default: 3). */
  maxAttempts?:   number;
  /** Base delay in ms for exponential backoff (default: 800). */
  baseDelayMs?:   number;
  /** Maximum backoff delay in ms (default: 8_000). */
  maxDelayMs?:    number;
  /** Jitter factor 0–1 applied to each delay (default: 0.3). */
  jitter?:        number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, opts: Required<RetryOptions>): number {
  const base  = opts.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(base, opts.maxDelayMs);
  const jitter = capped * opts.jitter * Math.random();
  return Math.floor(capped + jitter);
}

/**
 * withRetry — wrap any async function with configurable exponential-backoff
 * retry logic. Only retries when the error is flagged `retryable: true`
 * (CheckoutRequestError) or is a plain network/timeout error.
 *
 * Non-retryable errors (validation, auth, conflict) are re-thrown immediately.
 */
export async function withRetry<T>(
  fn:      () => Promise<T>,
  opts?:   RetryOptions,
): Promise<T> {
  const resolved: Required<RetryOptions> = {
    maxAttempts: opts?.maxAttempts ?? 3,
    baseDelayMs: opts?.baseDelayMs ?? 800,
    maxDelayMs:  opts?.maxDelayMs  ?? 8_000,
    jitter:      opts?.jitter      ?? 0.3,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < resolved.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isRetryable =
        err instanceof CheckoutRequestError
          ? err.retryable
          : err instanceof Error &&
            (err.name === "AbortError" ||
              err.message === "Failed to fetch" ||
              err.message === "Network request failed" ||
              err.message === "Load failed");

      if (!isRetryable || attempt === resolved.maxAttempts - 1) {
        throw err;
      }

      await sleep(computeDelay(attempt, resolved));
    }
  }

  // TypeScript exhaustion: the loop always throws or returns before here.
  throw lastError;
}

// ─── In-flight deduplication ─────────────────────────────────────────────────

type AnyPromise = Promise<unknown>;
const inflight = new Map<string, AnyPromise>();

/**
 * withDeduplication — if a call with `key` is already in-flight, return the
 * same promise. New callers wait on the existing promise instead of firing
 * a duplicate request.
 *
 * The key should include the idempotencyKey from the checkout command so
 * that retries with a refreshed key are never collapsed with the original.
 */
export function withDeduplication<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

// ─── Draft persistence ────────────────────────────────────────────────────────

const DRAFT_KEY         = "checkout_draft_v2";
const MAX_DRAFT_AGE_MS  = 30 * 60_000; // 30 minutes

export interface CheckoutDraft {
  /** ISO timestamp when the draft was last written. */
  savedAt:         string;
  /** Idempotency key at time of save. Used to detect if draft is for a
   *  still-in-flight submission (same key) or a fresh session (new key). */
  idempotencyKey:  string;
  /** Partial form values to restore. Only serialisable fields. */
  form: {
    fullName?:        string;
    phone?:           string;
    streetName?:      string;
    buildingNumber?:  string;
    floor?:           string;
    apartmentNumber?: string;
    note?:            string;
    promoCode?:       string;
  };
  paymentMethod?:  string;
}

/**
 * Save a checkout draft to AsyncStorage.
 * Called before every submission attempt so recovery is always possible.
 */
export async function saveCheckoutDraft(draft: Omit<CheckoutDraft, "savedAt">): Promise<void> {
  try {
    const full: CheckoutDraft = { ...draft, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(full));
  } catch {
    // Non-fatal — draft persistence is best-effort
  }
}

/**
 * Load a checkout draft from AsyncStorage.
 * Returns null if no draft exists, the draft is stale, or JSON is corrupt.
 */
export async function loadCheckoutDraft(): Promise<CheckoutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as CheckoutDraft;
    if (!draft.savedAt) return null;

    const age = Date.now() - Date.parse(draft.savedAt);
    if (!Number.isFinite(age) || age > MAX_DRAFT_AGE_MS) {
      await clearCheckoutDraft();
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

/**
 * Clear the draft once an order is successfully placed or the user
 * explicitly discards the recovery prompt.
 */
export async function clearCheckoutDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // Non-fatal
  }
}
