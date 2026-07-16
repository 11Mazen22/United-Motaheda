/**
 * vitals.ts — M9 Observability
 *
 * Captures Core Web Vitals and TTFB using the native PerformanceObserver API.
 * No external package required — every metric is standardised in the
 * W3C Performance Timeline specification and available in all modern browsers.
 *
 * Metrics captured:
 *   LCP  — Largest Contentful Paint  (good < 2500 ms)
 *   INP  — Interaction to Next Paint (good < 200 ms)
 *   CLS  — Cumulative Layout Shift   (good < 0.1)
 *   TTFB — Time to First Byte        (good < 800 ms)
 *   FCP  — First Contentful Paint    (good < 1800 ms)
 *
 * In development: all metrics are printed to the console.
 * In production:  metrics are sent to the configured analytics endpoint via
 *                 `navigator.sendBeacon` so they don't block page unload.
 *                 Set `VITE_VITALS_ENDPOINT` to activate production reporting.
 *
 * Usage: call `reportWebVitals()` once in `main.tsx` after the React root
 * has been rendered.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

type VitalRating = "good" | "needs-improvement" | "poor";

interface VitalEntry {
  name: string;
  value: number;
  rating: VitalRating;
  navigationType?: string;
  url: string;
}

// ─── Rating thresholds (from https://web.dev/vitals/) ────────────────────────

function rateLCP(v: number): VitalRating {
  return v <= 2500 ? "good" : v <= 4000 ? "needs-improvement" : "poor";
}
function rateINP(v: number): VitalRating {
  return v <= 200 ? "good" : v <= 500 ? "needs-improvement" : "poor";
}
function rateCLS(v: number): VitalRating {
  return v <= 0.1 ? "good" : v <= 0.25 ? "needs-improvement" : "poor";
}
function rateTTFB(v: number): VitalRating {
  return v <= 800 ? "good" : v <= 1800 ? "needs-improvement" : "poor";
}
function rateFCP(v: number): VitalRating {
  return v <= 1800 ? "good" : v <= 3000 ? "needs-improvement" : "poor";
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function sendVital(entry: VitalEntry) {
  if (import.meta.env.DEV) {
    const emoji =
      entry.rating === "good" ? "✅" : entry.rating === "needs-improvement" ? "⚠️" : "❌";
    const unit = entry.name === "CLS" ? "" : "ms";
    console.log(
      `[Vitals] ${emoji} ${entry.name}: ${entry.value.toFixed(entry.name === "CLS" ? 4 : 1)}${unit} (${entry.rating})`,
    );
    return;
  }

  const endpoint = import.meta.env.VITE_VITALS_ENDPOINT as string | undefined;
  if (!endpoint) return;

  const body = JSON.stringify(entry);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, body);
  } else {
    // Fallback for browsers without sendBeacon
    void fetch(endpoint, { method: "POST", body, keepalive: true });
  }
}

// ─── Observer helpers ────────────────────────────────────────────────────────

function observe<T extends PerformanceEntry>(
  type: string,
  callback: (entries: T[]) => void,
  opts?: PerformanceObserverInit,
): PerformanceObserver | undefined {
  try {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    const po = new PerformanceObserver((list) =>
      callback(list.getEntries() as T[]),
    );
    po.observe(opts ?? { type, buffered: true });
    return po;
  } catch {
    // PerformanceObserver not supported in this environment
    return undefined;
  }
}

// ─── Individual metric collectors ────────────────────────────────────────────

function collectLCP() {
  let lastEntry: PerformanceEntry | null = null;

  const po = observe<PerformanceEntry>("largest-contentful-paint", (entries) => {
    lastEntry = entries[entries.length - 1] ?? null;
  });
  if (!po) return;

  // LCP is finalised on the first user interaction or page hide
  const finalize = () => {
    if (!lastEntry) return;
    const value = (lastEntry as PerformanceEntry & { startTime: number }).startTime;
    sendVital({ name: "LCP", value, rating: rateLCP(value), url: location.href });
    po.disconnect();
    removeEventListener("keydown", finalize, true);
    removeEventListener("click", finalize, true);
    removeEventListener("visibilitychange", finalize, true);
  };

  addEventListener("keydown", finalize, { once: true, capture: true });
  addEventListener("click", finalize, { once: true, capture: true });
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") finalize();
  }, { once: true });
}

function collectINP() {
  type Interaction = {
    duration: number;
    eventName: string;
    target: string;
    inputDelay: number;
    processingTime: number;
    presentationDelay: number;
  };

  const interactions = new Map<number, Interaction>();
  const ungroupedInteractions: Interaction[] = [];

  const describeTarget = (target: EventTarget | null): string => {
    if (!(target instanceof Element)) return "unknown";
    const id = target.id ? `#${target.id}` : "";
    const classes = Array.from(target.classList).slice(0, 2).map((name) => `.${name}`).join("");
    return `${target.tagName.toLowerCase()}${id}${classes}`;
  };

  observe<PerformanceEventTiming>("event", (entries) => {
    for (const entry of entries) {
      const duration = entry.duration || Math.max(0, entry.processingEnd - entry.startTime);
      const processingTime = Math.max(0, entry.processingEnd - entry.processingStart);
      const interaction: Interaction = {
        duration,
        eventName: entry.name,
        target: describeTarget(entry.target),
        inputDelay: Math.max(0, entry.processingStart - entry.startTime),
        processingTime,
        presentationDelay: Math.max(0, duration - Math.max(0, entry.processingEnd - entry.startTime)),
      };

      if (entry.interactionId > 0) {
        const existing = interactions.get(entry.interactionId);
        if (!existing || interaction.duration > existing.duration) {
          interactions.set(entry.interactionId, interaction);
        }
      } else {
        ungroupedInteractions.push(interaction);
      }
    }
  }, { type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);

  const finalize = () => {
    const candidates = [...interactions.values(), ...ungroupedInteractions]
      .sort((a, b) => b.duration - a.duration);
    if (candidates.length === 0) return;

    // The INP outlier rule ignores one worst interaction per 50 interactions.
    const outlierIndex = Math.floor(candidates.length / 50);
    const interaction = candidates[Math.min(outlierIndex, candidates.length - 1)];
    if (!interaction) return;
    const rating = rateINP(interaction.duration);
    sendVital({ name: "INP", value: interaction.duration, rating, url: location.href });

    if (import.meta.env.DEV && rating !== "good") {
      console.warn("[Vitals] INP attribution", {
        event: interaction.eventName,
        target: interaction.target,
        inputDelay: Math.round(interaction.inputDelay),
        processingTime: Math.round(interaction.processingTime),
        presentationDelay: Math.round(interaction.presentationDelay),
      });
    }
  };

  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") finalize();
  });
  addEventListener("pagehide", finalize);
}

function collectCLS() {
  let sessionValue = 0;
  let sessionEntries: PerformanceEntry[] = [];

  observe<PerformanceEntry>("layout-shift", (entries) => {
    for (const entry of entries) {
      const ls = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
      if (ls.hadRecentInput) continue;
      sessionValue += ls.value;
      sessionEntries.push(entry);
    }
  });

  addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    sendVital({
      name: "CLS",
      value: sessionValue,
      rating: rateCLS(sessionValue),
      url: location.href,
    });
    sessionEntries = [];
  });
}

function collectTTFB() {
  const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  const nav = entries[0];
  if (!nav) return;
  const value = nav.responseStart - nav.requestStart;
  sendVital({ name: "TTFB", value, rating: rateTTFB(value), url: location.href });
}

function collectFCP() {
  observe<PerformanceEntry>("paint", (entries) => {
    const fcp = entries.find((e) => e.name === "first-contentful-paint");
    if (!fcp) return;
    sendVital({
      name: "FCP",
      value: fcp.startTime,
      rating: rateFCP(fcp.startTime),
      url: location.href,
    });
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call once after the React root is mounted.
 * Safe to call in all environments — non-supporting browsers are silently skipped.
 */
export function reportWebVitals() {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;

  try {
    collectTTFB();
    collectFCP();
    collectLCP();
    collectCLS();
    collectINP();
  } catch {
    // Never crash the app for observability errors
  }
}
