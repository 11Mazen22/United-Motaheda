/**
 * Attach breadcrumb + metrics context to every captureError call.
 *
 * Wraps the global crashReporter adapter so each captured error carries:
 *  - the last ~32 breadcrumbs
 *  - the current metrics snapshot (counters + duration percentiles)
 *
 * Call installCrashEnrichment() exactly once at root.
 */

import { setCrashAdapter, type CrashAdapter, type CrashContext } from "@/lib/crashReporter";
import { formatBreadcrumbsForCrash } from "./breadcrumbs";
import { snapshotMetrics } from "./metrics";

let installed = false;

export function installCrashEnrichment(): void {
  if (installed) return;
  installed = true;

  const enriching: CrashAdapter = {
    capture(error, context) {
      const enriched: CrashContext = {
        ...(context ?? {}),
        breadcrumbs: formatBreadcrumbsForCrash() || null,
      };
      // Metrics snapshot is too big for CrashContext (which only accepts
      // primitives). Stringify it into a compact field.
      try {
        enriched.metrics = JSON.stringify(snapshotMetrics()).slice(0, 1500);
      } catch {
        enriched.metrics = "[unserialisable]";
      }
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn("[crash:enriched]", error instanceof Error ? error.message : String(error), enriched);
      }
    },
    setUser:    () => {},
    setContext: () => {},
  };

  setCrashAdapter(enriching);
}
