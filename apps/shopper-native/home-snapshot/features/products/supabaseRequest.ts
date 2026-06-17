/**
 * Supabase request helpers — timeout, abort, and retry classification.
 */

import type { PostgrestError } from "@supabase/supabase-js";

const DEFAULT_TIMEOUT_MS = 12_000;

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
  signal?: AbortSignal;
}

export async function withTimeout<T>(
  build: (signal: AbortSignal) => ThenableLike<T>,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal }: WithTimeoutOptions = {},
): Promise<T> {
  const controller = new AbortController();

  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      throw new RequestAbortedError();
    }
    signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await build(controller.signal);

    if (controller.signal.aborted) {
      throw signal?.aborted ? new RequestAbortedError() : new RequestTimeoutError(timeoutMs);
    }

    if (result.error) {
      throw result.error;
    }

    if (result.data === null) {
      throw new Error("No data returned from Supabase");
    }

    return result.data;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onExternalAbort);
  }
}

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

  if (e.code === "PGRST116" || e.code === "23505" || e.code === "42501") {
    return "terminal";
  }

  return "transient";
}

export function isRetryable(error: unknown): boolean {
  const kind = classifyError(error);
  return kind === "transient" || kind === "timeout" || kind === "offline";
}
