/**
 * Supabase request helpers — timeout, abort, and typed error classification.
 *
 *  - withTimeout()      : wraps any Supabase builder in an AbortController so
 *                         a stuck request fails cleanly instead of hanging
 *                         until the OS gives up (~60 s on iOS).
 *  - classifyError()    : "transient" vs "terminal" so callers (and React
 *                         Query's retry fn) make the same retry decision.
 *
 * Usage:
 *
 *   const { data, error } = await withTimeout((signal) =>
 *     supabase
 *       .from("products")
 *       .select("id,name,price,thumbnail_url,stock_status")
 *       .range(0, 23)
 *       .abortSignal(signal),
 *   );
 */

import type { PostgrestError } from "@supabase/supabase-js";

const DEFAULT_TIMEOUT_MS = 12_000;

/** Subset of PostgrestBuilder we need — promise-shaped, with throwOnError. */
type ThenableLike<T> = PromiseLike<{ data: T | null; error: PostgrestError | null }>;

export class RequestTimeoutError extends Error {
  readonly code = "TIMEOUT";
  constructor(ms: number) {
    super(`Supabase request timed out after ${ms}ms`);
    this.name = "RequestTimeoutError";
  }
}

export class RequestAbortedError extends Error {
  readonly code = "ABORTED";
  constructor() {
    super("Supabase request was aborted");
    this.name = "RequestAbortedError";
  }
}

export interface WithTimeoutOptions {
  timeoutMs?: number;
  /** External signal — if it aborts, we abort too. Lets callers chain cancellations. */
  signal?: AbortSignal;
}

/**
 * Race a Supabase builder against a hard deadline.
 *
 * Uses Promise.race() rather than relying solely on AbortSignal because
 * React Native's Hermes fetch implementation does not reliably cancel an
 * in-flight request when the signal fires — leaving `await build()` pending
 * indefinitely and React Query stuck on `isLoading: true` forever.
 * Promise.race() guarantees the timeout rejects regardless of fetch behaviour.
 */
export async function withTimeout<T>(
  build: (signal: AbortSignal) => ThenableLike<T>,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal }: WithTimeoutOptions = {},
): Promise<T> {
  const controller = new AbortController();

  if (signal?.aborted) throw new RequestAbortedError();

  const abortListener = () => controller.abort();
  if (signal) signal.addEventListener("abort", abortListener, { once: true });

  let timer!: ReturnType<typeof setTimeout>;

  const request = new Promise<T>((resolve, reject) => {
    Promise.resolve(build(controller.signal)).then(
      (result) => {
        if (result.error) { reject(result.error); return; }
        // PostgREST returns `data: null` only when .single() finds nothing.
        if (result.data === null) { reject(new Error("No data returned from Supabase")); return; }
        resolve(result.data);
      },
      reject,
    );
  });

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(signal?.aborted ? new RequestAbortedError() : new RequestTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, deadline]);
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abortListener);
  }
}

// ── Error classification ─────────────────────────────────────────────────────

export type ErrorKind = "transient" | "terminal" | "timeout" | "aborted" | "offline";

export function classifyError(error: unknown): ErrorKind {
  if (!error || typeof error !== "object") return "transient";

  if (error instanceof RequestTimeoutError) return "timeout";
  if (error instanceof RequestAbortedError) return "aborted";

  const e = error as { status?: number; code?: string; message?: string };

  if (typeof e.message === "string" && /network request failed|fetch failed/i.test(e.message)) {
    return "offline";
  }

  if (typeof e.status === "number") {
    if (e.status >= 500) return "transient";
    if (e.status >= 400) return "terminal";
  }

  // PostgREST codes that are caller errors, not service errors.
  if (e.code === "PGRST116" || e.code === "23505" || e.code === "42501") {
    return "terminal";
  }

  return "transient";
}

export function isRetryable(error: unknown): boolean {
  const k = classifyError(error);
  return k === "transient" || k === "timeout" || k === "offline";
}
