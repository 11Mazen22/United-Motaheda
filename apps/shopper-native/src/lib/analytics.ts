/**
 * Analytics — provider-agnostic shim.
 *
 * Default adapter is a no-op so the rest of the app can call `track(...)` /
 * `identify(...)` from day one without choosing a provider. When you wire
 * PostHog / Amplitude / Mixpanel / etc., call `setAnalyticsAdapter()` once
 * during app bootstrap; everything else is unchanged.
 *
 * PII discipline: `scrubProps` drops known sensitive fields before any
 * adapter sees them. Phone numbers, emails, full names, addresses, and any
 * `*_token` field get stripped. If you need to pass user-identifying data,
 * use `identify(userId, traits)` so the provider's user-pipeline handles it
 * (e.g., PostHog $set), not the event payload.
 *
 * Event name set is closed (typed union) so misspellings / drift surface at
 * compile time. Add new events explicitly when you need them.
 */

import Constants from "expo-constants";

// ── Event vocabulary ──────────────────────────────────────────────────────

export type AnalyticsEvent =
  // Auth funnel
  | "signup_attempted"
  | "signup_completed"
  | "signup_failed"
  | "login_attempted"
  | "login_completed"
  | "login_failed"
  | "logout"
  | "forgot_password_submitted"
  | "forgot_password_email_sent"
  | "reset_password_link_opened"
  | "reset_password_submitted"
  | "reset_password_completed"
  // Shopping funnel
  | "product_viewed"
  | "category_opened"
  | "search_submitted"
  | "product_added_to_cart"
  | "product_removed_from_cart"
  | "cart_opened"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed"
  // Pharmacy module
  | "prescription_added"
  | "refill_requested"
  // App lifecycle
  | "app_opened"
  | "app_backgrounded";

export type EventProps = Record<string, string | number | boolean | null>;

// ── Adapter contract ──────────────────────────────────────────────────────

export interface AnalyticsAdapter {
  identify(userId: string | null, traits?: EventProps): void;
  track(event: AnalyticsEvent, props?: EventProps): void;
  reset(): void;
}

const noopAdapter: AnalyticsAdapter = {
  identify: () => {},
  track:    () => {},
  reset:    () => {},
};

let adapter: AnalyticsAdapter = noopAdapter;

/** Swap in a real adapter once during app bootstrap. */
export function setAnalyticsAdapter(a: AnalyticsAdapter): void {
  adapter = a;
}

// ── PII scrubbing ─────────────────────────────────────────────────────────

const PII_FIELDS = new Set([
  "email", "phone", "phoneNumber", "phone_number",
  "name", "fullName", "full_name", "firstName", "lastName",
  "address", "street", "city",
  "password", "token", "accessToken", "refreshToken",
  "rxNumber", "rx_number",
]);

function scrubProps(props: EventProps | undefined): EventProps | undefined {
  if (!props) return props;
  const out: EventProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (PII_FIELDS.has(k) || k.endsWith("_token") || k.endsWith("Token")) continue;
    out[k] = v;
  }
  return out;
}

// ── Build / version context ──────────────────────────────────────────────

interface DeviceContext {
  appVersion: string | null;
  /** Hermes / JSC / V8 — useful for crash triage. */
  jsEngine:   string | null;
}

const DEVICE_CTX: DeviceContext = (() => {
  const cfg = Constants.expoConfig;
  return {
    appVersion: cfg?.version ?? null,
    jsEngine:   (cfg?.jsEngine as string | undefined) ?? null,
  };
})();

export function getAnalyticsContext(): Readonly<DeviceContext> {
  return DEVICE_CTX;
}

// ── Public API ────────────────────────────────────────────────────────────

export function identify(userId: string | null, traits?: EventProps): void {
  adapter.identify(userId, scrubProps(traits));
}

export function track(event: AnalyticsEvent, props?: EventProps): void {
  // Auto-attach app version so every event carries a build identifier.
  const finalProps: EventProps = {
    ...(scrubProps(props) ?? {}),
    app_version: DEVICE_CTX.appVersion ?? "unknown",
  };
  adapter.track(event, finalProps);
}

export function resetAnalytics(): void {
  adapter.reset();
}
