/**
 * Crash reporter — provider-agnostic shim.
 *
 * Default adapter is no-op + dev-console. Wire @sentry/react-native (or
 * Bugsnag/Datadog/etc.) by implementing `CrashAdapter` and calling
 * `setCrashAdapter()` once during bootstrap.
 *
 * Use:
 *   try { … } catch (e) { captureError(e, { surface: "checkout" }); }
 *   setCrashUser(user?.id ?? null);
 *
 * Build context (app version, JS engine) is auto-attached.
 */

import Constants from "expo-constants";

export type CrashContext = Record<string, string | number | boolean | null | undefined>;

export interface CrashAdapter {
  capture(error: Error, context?: CrashContext): void;
  setUser(userId: string | null): void;
  setContext(key: string, value: CrashContext): void;
}

const noopAdapter: CrashAdapter = {
  capture: (error, context) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("[crash]", error.message, context ?? "");
    }
  },
  setUser:    () => {},
  setContext: () => {},
};

let adapter: CrashAdapter = noopAdapter;

export function setCrashAdapter(a: CrashAdapter): void {
  adapter = a;
}

// ── Build / device context ────────────────────────────────────────────────

const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

// ── Public API ────────────────────────────────────────────────────────────

export function captureError(error: unknown, context?: CrashContext): void {
  const err = error instanceof Error
    ? error
    : new Error(typeof error === "string" ? error : JSON.stringify(error));
  adapter.capture(err, { ...context, app_version: APP_VERSION });
}

export function setCrashUser(userId: string | null): void {
  adapter.setUser(userId);
}

export function setCrashContext(key: string, value: CrashContext): void {
  adapter.setContext(key, value);
}
