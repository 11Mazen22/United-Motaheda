/**
 * Lightweight dev-only instrumentation.
 *
 * Wraps async work to log durations + fallback activation. The whole module
 * is no-op in production: `__DEV__` gates every call; the bundler dead-code-
 * eliminates the wrapped paths when stripping dev-only branches.
 *
 * Usage:
 *   const { data } = await timed("rpc:get_category_counts", () =>
 *     supabase.rpc("get_category_counts")
 *   );
 *
 *   timedMark("fallback", "fetchCategories → CATEGORY_SEEDS (RPC timeout)");
 *
 *   useMountTiming("HomeScreen");
 *
 * To remove for production cleanup later: delete this file + grep for
 * `timed(` / `timedMark(` / `useMountTiming(` and unwrap call sites.
 */

import { useEffect } from "react";

/** Wrap an async operation; log "label: Nms" in dev, no-op in prod.
 *
 * Accepts any thenable (including Supabase's PostgrestFilterBuilder, which
 * is PromiseLike but not a strict Promise instance). */
export async function timed<T>(label: string, fn: () => PromiseLike<T>): Promise<T> {
  if (!__DEV__) return Promise.resolve(fn());
  const t0 = Date.now();
  try {
    const result = await fn();
    const dt = Date.now() - t0;
     
    console.log(`[timed] ${label}: ${dt}ms`);
    return result;
  } catch (e) {
    const dt = Date.now() - t0;
     
    console.log(`[timed] ${label}: FAILED after ${dt}ms`);
    throw e;
  }
}

/** Emit a labelled event (e.g., fallback activation). No-op in prod. */
export function timedMark(category: string, message: string): void {
  if (!__DEV__) return;
   
  console.log(`[mark/${category}] ${message}`);
}

/**
 * Measure component mount → first frame in dev. Useful for diagnosing
 * "the screen feels slow" without external tools.
 *
 *   function HomeScreen() {
 *     useMountTiming("HomeScreen");
 *     ...
 *   }
 */
export function useMountTiming(label: string): void {
  useEffect(() => {
    if (!__DEV__) return;
    const t0 = Date.now();
    const raf = requestAnimationFrame(() => {
      const dt = Date.now() - t0;
       
      console.log(`[mount] ${label}: ${dt}ms`);
    });
    return () => cancelAnimationFrame(raf);
    // intentionally empty deps — measure first mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
