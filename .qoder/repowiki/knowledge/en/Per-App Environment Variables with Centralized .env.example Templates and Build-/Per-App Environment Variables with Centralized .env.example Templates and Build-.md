---
kind: configuration_system
name: Per-App Environment Variables with Centralized .env.example Templates and Build-Time Injection
category: configuration_system
scope:
    - '**'
source_files:
    - apps/shopper-web/.env.example
    - apps/shopper-web/src/app/env.ts
    - apps/shopper-web/vite.config.ts
    - apps/admin/.env.example
    - apps/admin/src/lib/supabase.ts
    - apps/api/.env.example
    - apps/api/src/main.ts
    - apps/api/prisma/schema.prisma
    - apps/shopper-native/.env.example
    - apps/shopper-native/src/lib/supabase.ts
    - apps/shopper-native/app.json
    - apps/shopper-native/eas.json
    - railway.toml
---

## Overview

The monorepo uses a **per-application environment variable** strategy. Each app (shopper-web, admin, api, shopper-native) declares its own `.env` / `.env.example` files and reads configuration through the platform's native env mechanism — no shared config library or centralized loader is used across apps.

## How each app loads configuration

### Shopper Web (Vite / React)
- Vite exposes variables prefixed `VITE_` at build time via `import.meta.env`. A small helper in `apps/shopper-web/src/app/env.ts` wraps access with `readStringEnv` / `readNumberEnv`, trims values, and provides typed defaults.
- The module exports a `publicEnv` object (`apiBase`, `supabaseUrl`, `supabaseAnonKey`, `deliveryMinMinutes`, `deliveryMaxMinutes`, `shippingMatrixJson`, `searchApiBase`, `web3formsAccessKey`) consumed by services and SEO helpers.
- Validation: `getPublicEnvValidationErrors()` checks URL validity, delivery-window ordering, JSON parsing of `VITE_SHIPPING_MATRIX_JSON`, and requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to be set together. Errors are surfaced as an array rather than throwing at startup.
- Defaults: when env vars are missing the web app falls back to production URLs (`https://pharmacyapi-production-e30d.up.railway.app`, Supabase project `gntpxffonjvnvadjclpl`).
- `.env.example` documents required keys: `VITE_API_BASE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`.

### Admin App (Vite / React)
- Reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` directly from `import.meta.env` in `apps/admin/src/lib/supabase.ts` and **throws** if either is missing, enforcing presence at import time.
- Uses the anon key only; actual auth is supplied per-request via an admin JWT injected into the Supabase client headers.
- `.env.example` defines `VITE_API_URL` for the backend base.

### API (NestJS / Node)
- Runtime env vars are read directly via `process.env` throughout the codebase (e.g. `PORT` in `src/main.ts`). There is no dedicated config module — each service reads what it needs.
- Prisma schema (`apps/api/prisma/schema.prisma`) binds the database connection to `env("DATABASE_URL")` and `env("DIRECT_URL")`, so those must be present for migrations and runtime.
- `.env.example` documents all required keys: `PORT`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and Firebase credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) for push notifications.
- CORS origins are hard-coded in `main.ts` (production domains plus localhost patterns), not loaded from env.

### Shopper Native (Expo)
- Credentials are read from Expo public env vars `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` via `process.env[...]` in `apps/shopper-native/src/lib/supabase.ts`, then fall back to `Constants.expoConfig.extra` keys (`supabaseUrl`, `supabaseAnonKey`), then to hardcoded development defaults.
- `.env.example` documents the two required Expo public keys.
- `app.json` embeds static build-time configuration (bundle IDs, permissions, splash, plugins, EAS project ID) — this is separate from runtime env and is committed to source control.
- `eas.json` defines per-channel build profiles (`development`, `preview`, `production-apk`, `production`) and can inject env vars per channel via the `env` block.

### Shared / Infrastructure Config
- `railway.toml` declares Railway-specific variables (`OLLAMA_HOST`, `OLLAMA_MODELS`) under `[variables]` for the Ollama service.
- Root-level `.env.local` exists but is gitignored; per-app `.env` files hold local overrides.
- No cross-app shared configuration package exists — each app owns its own env surface.

## Conventions observed

1. **Environment-variable prefix per framework**: `VITE_*` for Vite-based apps (shopper-web, admin), `EXPO_PUBLIC_*` for Expo, plain `process.env.*` for Node/NestJS.
2. **`.env.example` per app**: every app ships a template documenting required keys; actual `.env` files are not committed.
3. **Fail-fast vs graceful fallback**: admin throws on missing Supabase keys; shopper-web and shopper-native provide sensible defaults so dev builds still run against a shared test project.
4. **Supabase keys are treated as public client secrets**: comments explicitly state the anon key is safe to commit because RLS enforces access, while service-role keys must never reach clients.
5. **Build-time vs runtime separation**: Vite strips `VITE_*` at build time (not shipped to browser at runtime); Expo public vars are baked into the bundle; NestJS reads `process.env` at process start.
6. **No feature-flag system**: business logic like branch data, delivery pricing, and operating hours live in `apps/shopper-web/src/config/businessConfig.ts` as TypeScript constants with React hooks (`useBranches`, `useDeliveryPricing`) that fetch from the API when wired up — currently falling back to `DEFAULT_BRANCHES` / `DEFAULT_DELIVERY_PRICING`.