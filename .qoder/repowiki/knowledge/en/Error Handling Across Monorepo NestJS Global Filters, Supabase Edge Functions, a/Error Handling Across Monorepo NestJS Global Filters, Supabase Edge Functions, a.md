---
kind: error_handling
name: 'Error Handling Across Monorepo: NestJS Global Filters, Supabase Edge Functions, and Client-Side Retry/Reporting'
category: error_handling
scope:
    - '**'
source_files:
    - apps/api/src/common/http-exception.filter.ts
    - apps/api/src/common/api-response.interceptor.ts
    - apps/api/src/main.ts
    - supabase/functions/track-order/index.ts
    - apps/shopper-web/src/lib/supabaseClient.ts
    - apps/shopper-web/src/services/logisticsApi.ts
    - apps/shopper-native/src/lib/supabaseRequest.ts
    - apps/shopper-native/src/lib/crashReporter.ts
    - apps/shopper-native/src/lib/offlineQueue.ts
---

## Overview

The United Pharmacy monorepo uses a layered error-handling strategy that differs by boundary:

- **NestJS API** (`apps/api`): global `HttpExceptionFilter` + `ApiResponseInterceptor` produce a uniform `{ success, data, error }` JSON envelope for every HTTP response.
- **Supabase Edge Functions** (`supabase/functions/*`): return typed `Response` objects with explicit `{ error: string }` payloads and numeric HTTP status codes — no framework-level filter exists.
- **Shopper Web** (`apps/shopper-web`): throws plain `Error`s from service-layer functions; configuration errors are surfaced via a dedicated `getSupabaseConfigError()` getter rather than throwing at import time.
- **Shopper Native** (`apps/shopper-native`): defines custom `RequestTimeoutError` / `RequestAbortedError` classes plus a `classifyError()` helper that categorizes errors as `transient | terminal | timeout | aborted | offline`, driving React Query retry decisions. A provider-agnostic `crashReporter.ts` shim forwards errors to Sentry/Bugsnag/etc. in production.
- **Offline mutation queue** (`offlineQueue.ts`): persists failed operations with exponential backoff (base 1s, cap 5 min, max 10 attempts) and stores the last error message for user inspection.

## Key Files and Packages

| Area | File | Role |
|---|---|---|
| API global error handling | `apps/api/src/common/http-exception.filter.ts` | Catches all exceptions, maps `HttpException` → its status, otherwise `INTERNAL_SERVER_ERROR`; wraps payload in `{ success:false, error:{ code, message, details:{ path, method } } }` |
| API success envelope | `apps/api/src/common/api-response.interceptor.ts` | Wraps successful handler returns into `{ success:true, data, error:null }` |
| API bootstrap | `apps/api/src/main.ts` | Registers the interceptor and filter globally via `useGlobalInterceptors` / `useGlobalFilters` |
| Supabase edge function | `supabase/functions/track-order/index.ts` | Returns `json({ error: "..." }, 4xx/5xx)` on validation / DB failures; logs non-fatal DB errors and continues |
| Web Supabase client | `apps/shopper-web/src/lib/supabaseClient.ts` | Throws `Error` if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing; exposes `getSupabaseConfigError()` so callers can render a config banner instead of crashing |
| Web logistics service | `apps/shopper-web/src/services/logisticsApi.ts` | Converts Supabase `{ error }` tuples into thrown `Error`s; catches optional sub-queries (e.g. `order_items`) so partial data still renders |
| Native request wrapper | `apps/shopper-native/src/lib/supabaseRequest.ts` | `withTimeout()` enforces hard deadlines; `classifyError()` / `isRetryable()` drive retry policy |
| Native crash reporting | `apps/shopper-native/src/lib/crashReporter.ts` | Pluggable `CrashAdapter` interface; default is no-op + dev console; attaches `app_version` context |
| Offline queue | `apps/shopper-native/src/lib/offlineQueue.ts` | Serial FIFO queue persisted in MMKV; `markFailure()` applies exponential backoff with jitter; failed ops stay visible for manual retry/drop |

## Architecture and Conventions

### NestJS API
- Controllers and services throw either `HttpException` subclasses or plain `Error`s. The global `HttpExceptionFilter` normalizes them into a consistent JSON shape with an `error.code` derived from the HTTP status (e.g. `HTTP_404`, `UNEXPECTED_ERROR`).
- Successful responses are always wrapped by `ApiResponseInterceptor` into `{ success: true, data, error: null }`, so callers never need to inspect a boolean flag themselves.
- Startup failure is handled in `main.ts`'s `.catch()` which logs and exits with code 1.

### Supabase Edge Functions
- Each function implements its own `json(body, status)` helper returning `Response` with CORS headers. Validation failures return 400 with `{ error: "..." }`. DB lookup failures return 500; missing resources return 404. Non-fatal downstream errors (e.g. driver location lookup) are logged and the function proceeds without them.
- No shared error class — errors are represented as plain strings inside the `{ error }` field.

### Shopper Web Services
- Service functions consistently check the `{ data, error }` tuple returned by Supabase PostgREST and `throw new Error(error.message)` when present. Optional secondary queries (e.g. fetching `order_items`) are wrapped in `try/catch` so a missing table does not break the whole page.
- Configuration errors are surfaced via `getSupabaseConfigError()` so UI components can show a banner instead of throwing during module load.

### Shopper Native
- Custom error types extend `Error` and carry a stable `code` property (`TIMEOUT`, `ABORTED`), enabling callers to branch on error kind without fragile string matching.
- `classifyError()` centralizes retry logic: network fetch failures, timeouts, and 5xx statuses are treated as transient (retryable); 4xx and specific PostgREST codes (`PGRST116`, `23505`, `42501`) are terminal.
- Crash reporter is intentionally decoupled behind a `CrashAdapter` interface so production builds can swap in Sentry/Bugsnag while development stays silent except for `__DEV__` console warnings.

### Offline Queue
- Failed mutations are retried with exponential backoff capped at 5 minutes after up to 10 attempts. After exhaustion the op's status becomes `failed` and it remains in MMKV for manual inspection/retry.
- Errors are serialized via `stringifyError()`, truncating to 240 characters to avoid filling storage.

## Conventions and Constraints Observed

1. **API responses are always enveloped**: Every NestJS endpoint returns through `ApiResponseInterceptor`, producing `{ success, data, error }`. Consumers should never treat a truthy/falsy response as success.
2. **Errors propagate as thrown `Error`s in client services**: Web and native service layers convert Supabase error tuples into thrown `Error`s so callers use try/catch or React Query's built-in error handling.
3. **Edge functions use explicit status codes**: There is no global error filter in Deno Edge Functions; each function must explicitly return `json({ error: ... }, status)` for every failure path.
4. **Non-fatal downstream failures degrade gracefully**: Missing `order_items` tables, stale driver locations, and RLS-denied writes are logged but do not abort the entire operation — the caller receives partial data or a clear error message.
5. **Native retries are policy-driven**: `classifyError()` and `isRetryable()` are the single source of truth for whether a request should be retried; callers delegate to this helper rather than re-implementing retry heuristics.
6. **Crash reporting is swappable**: The `CrashAdapter` interface and `setCrashAdapter()` bootstrap hook enforce that crash telemetry is configured once at startup and never scattered across modules.
7. **Offline mutations are idempotent**: Every queued operation carries a ≥16-character `idempotencyKey` enforced at enqueue time, protecting against double-processing after restart.