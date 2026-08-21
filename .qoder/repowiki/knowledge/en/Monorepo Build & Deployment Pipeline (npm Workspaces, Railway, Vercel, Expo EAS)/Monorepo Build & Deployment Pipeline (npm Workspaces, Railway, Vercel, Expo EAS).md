---
kind: build_system
name: Monorepo Build & Deployment Pipeline (npm Workspaces, Railway, Vercel, Expo EAS)
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - scripts/railway/build-api.sh
    - scripts/railway/build-shopper-web.sh
    - scripts/railway/build-shopper-native.sh
    - scripts/railway/start-api.sh
    - scripts/railway/start-shopper-web.sh
    - scripts/railway/start-shopper-native.sh
    - apps/api/Dockerfile
    - apps/api/package.json
    - apps/shopper-web/package.json
    - apps/shopper-native/railway-build.sh
    - eas.json
    - vercel.json
    - railway.toml
    - .github/workflows/sync-npm-lockfile.yml
    - .github/workflows/sync-root-lock.yml
---

## Overview

The United Pharmacy monorepo uses a **multi-tool build system** centered on npm workspaces, with per-target deployment pipelines for three distinct artifacts: a NestJS API backend, a Vite-based Next/React shopper web app, and an Expo shopper-native mobile app. There is no single Makefile; instead, each target has its own build script under `scripts/railway/` plus platform-specific tooling.

## Node / Workspace Orchestration

- Root `package.json` declares `workspaces: ["apps/shopper-web", "apps/shopper-native", "packages/*"]` and pins `packageManager: npm@11.6.0` with `engines.node >=22.22.2 <23`. All workspace scripts are invoked via `npm run ... --workspace @pharmacy/<target>` from the root.
- The root exposes top-level scripts that delegate to individual apps (`dev`, `build`, `preview`, `typecheck`, `lint`) and to Railway helpers (`railway:build:*`, `railway:start:*`).
- Shared packages live in `packages/` (e.g. `contracts`, `ui-native`, `design-tokens`, domain packages) and are consumed via `file:` or workspace references.

## API Build (NestJS + Prisma)

- **Build script**: `scripts/railway/build-api.sh` enforces Node ≥ 24 at build time, installs `packages/contracts` standalone, then runs `nest build` inside `apps/api`.
- **Runtime script**: `scripts/railway/start-api.sh` checks Node ≥ 22 and execs `node apps/api/dist/main.js`.
- **Docker image**: `apps/api/Dockerfile` is a two-stage Alpine build (Node 20 builder → Node 20 runtime). It copies only `packages/contracts` and `apps/api`, rewrites the `@pharmacy/contracts` dependency to a local file reference so the container never needs the full workspace, generates the Prisma client, builds with Nest/webpack, and ships only `dist/` and `node_modules`.
- **Prisma**: schema lives at `apps/api/prisma/schema.prisma`; migrations are versioned SQL files under `supabase/migrations/` and `database/*.sql`.

## Shopper Web Build (Vite)

- **Build script**: `scripts/railway/build-shopper-web.sh` runs `npm install` at the repo root then `npm run build --workspace=apps/shopper-web`, which invokes `vite build` and emits static assets to `apps/shopper-web/dist`.
- **Runtime**: `scripts/railway/start-shopper-web.sh` installs `serve` globally and serves `apps/shopper-web/dist` on `${PORT:-3000}`.
- **Vercel deploy**: `vercel.json` configures a SPA rewrite (`/.*) -> /index.html`) so client-side routing works on Vercel.

## Shopper Native Build (Expo)

- **Build script**: `scripts/railway/build-shopper-native.sh` delegates to `apps/shopper-native/railway-build.sh`, which:
  - Pins `EXPO_PROJECT_ROOT` and `EXPO_ROUTER_ABS_APP_ROOT` so Metro resolves the correct entry point when executed from the monorepo root.
  - Installs dependencies and symlinks `packages/ui-native` and `packages/design-tokens` into `apps/shopper-native/node_modules/@pharmacy/`.
  - Runs an inline Node script that walks the shared native package source and rewrites stale `react-native-web/dist/exports/...` imports to bare `react-native`.
  - Verifies React / react-dom / react-native-web resolution, writes a minimal `metro.config.js`, then runs `npx expo export --platform web --output-dir dist`.
- **Mobile artifact**: `eas.json` defines Expo Application Service profiles (`development`, `preview`, `preview-aab`, `production-apk`, `verify`, `production`) with explicit `node: 22.22.2`, Android build types, channels, and auto-increment. Submission to Google Play uses `google-service-account.json`.

## CI / GitHub Actions

Two workflows keep lockfiles in sync — there is no full test/build pipeline yet:

- `.github/workflows/sync-npm-lockfile.yml`: triggers on changes to root/package.json or `apps/shopper-native/package.json`, regenerates the root lockfile with Node 22.22.2, verifies `npm ci`, and commits/pushes if changed.
- `.github/workflows/sync-root-lock.yml`: broader trigger (including `packages/**` and `apps/shopper-web/package-lock.json`), uses Node 24, regenerates lockfiles, and pushes them.

Both use `actions/checkout@v4`, `actions/setup-node@v4`, and commit via the `github-actions[bot]` identity.

## Other Deploy Targets

- **Railway Ollama service**: `railway.toml` points to `Dockerfile.ollama` with healthcheck and environment variables (`OLLAMA_HOST`, `OLLAMA_MODELS`).
- **Supabase Edge Functions**: located under `supabase/functions/` (admin actions, driver location, notification worker, SMS campaign, order tracking, coupon validation); managed by the Supabase CLI, not npm scripts.
- **Database migrations**: versioned SQL files under `supabase/migrations/` and legacy files under `database/`.

## Conventions Observed

- Every build script uses `set -euo pipefail` and prints a prefixed log line (`==> [target] ...`) for traceability.
- Node versions are pinned explicitly: root `engines` (≥22.22.2 <23), API Dockerfile (Node 20), API runtime check (≥22), API build check (≥24), EAS profiles (22.22.2), CI sync workflow (22.22.2 and 24).
- Dependency installation flags consistently include `--no-audit --no-fund` and often `--ignore-scripts` or `--legacy-peer-deps` to speed up CI.
- Shared packages are consumed via `file:` paths in app `package.json` files rather than published registry versions.
- Each target has a dedicated `scripts/railway/{build|start}-<target>.sh` wrapper so Railway can invoke a single command per service.