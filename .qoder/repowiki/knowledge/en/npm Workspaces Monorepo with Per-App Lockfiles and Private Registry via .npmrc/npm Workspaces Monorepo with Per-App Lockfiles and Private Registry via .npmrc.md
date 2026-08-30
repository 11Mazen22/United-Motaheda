---
kind: dependency_management
name: npm Workspaces Monorepo with Per-App Lockfiles and Private Registry via .npmrc
category: dependency_management
scope:
    - '**'
source_files:
    - package.json
    - .npmrc
    - apps/shopper-web/package.json
    - apps/shopper-native/package.json
    - apps/api/package.json
    - packages/ui-native/package.json
    - packages/design-tokens/package.json
    - packages/api-client/package.json
    - packages/domain-core/package.json
    - apps/courier-mobile/package.json
---

## What system/approach is used

The repository is a **Node.js monorepo managed by npm workspaces**. The root `package.json` declares the workspace layout under `apps/*` and `packages/*`, pins the package manager to `npm@11.6.0` (via the `packageManager` field), and enforces Node `>=22.22.2 <23`. Each app (`shopper-web`, `shopper-native`, `api`, plus smaller apps like `admin`, `cashier-mobile`, `courier-mobile`, `customer-mobile`, `ops-dashboard`) and each shared package under `packages/` has its own `package.json`. There is no top-level lockfile; instead, each workspace directory ships its own `package-lock.json` (e.g. `apps/shopper-web/package-lock.json`, `apps/api/package-lock.json`, `apps/shopper-native/package-lock.json`), so dependency resolution is isolated per target.

A global `.npmrc` at the repo root sets `legacy-peer-deps=true`, which relaxes peer-dependency resolution across the whole monorepo — this is the single configuration point that affects how npm resolves peer deps between apps and packages.

There is no vendoring of third-party code: all dependencies are resolved from the public npm registry (no `vendor/` directories, no private registry URL in `.npmrc`).

## Key files and packages

- `package.json` (root) — defines workspaces, pinned `packageManager`, root scripts that delegate to `--workspace @pharmacy/shopper-web`, and a large set of shared frontend dependencies (MUI, Radix UI, Tailwind, React Query, Zustand, etc.) plus a `pnpm.overrides` block for `vite` (present but unused since npm is the package manager).
- `.npmrc` — global `legacy-peer-deps=true`.
- `apps/*/package.json` — per-app dependency declarations:
  - `apps/shopper-web` — Vite + React + Tailwind v4 + contracts via `file:` link.
  - `apps/shopper-native` — Expo ~55 / React Native 0.83 + native modules (camera, maps, reanimated, MMKV, etc.) + TanStack Query persisters.
  - `apps/api` — NestJS ^11 + Prisma ^6 + Supabase JS + Firebase Admin + Zod + Socket.IO.
  - Smaller apps (`admin`, `cashier-mobile`, `courier-mobile`, `customer-mobile`, `ops-dashboard`) follow the same pattern.
- `packages/*/package.json` — internal workspace packages, all scoped under `@pharmacy/`:
  - `contracts`, `design-tokens`, `ui-web`, `ui-native`, `api-client`, and domain packages (`domain-core`, `domain-account`, `domain-cart`, `domain-catalog`, `domain-checkout`, `domain-courier`, `domain-location`, `domain-ops`, `domain-orders`, `domain-prescriptions`, `domain-search`, `fuzzy-search`, `types`).
  - Most are `private: true` with no runtime dependencies; they act as shared type/token/UI sources.
- `apps/shopper-native/package-lock.json`, `apps/api/package-lock.json`, `apps/shopper-web/package-lock.json` — per-workspace lockfiles that pin exact versions installed in each target.
- `apps/courier-mobile/package.json` and `apps/shopper-native/package.json` — reference other workspace packages via relative `file:../../packages/...` paths rather than npm workspace protocol.

## Architecture and conventions

- **Workspace scoping**: All internal packages use the `@pharmacy/` scope (`@pharmacy/shopper-web`, `@pharmacy/api`, `@pharmacy/contracts`, `@pharmacy/ui-native`, etc.), keeping them distinct from public npm packages.
- **Internal package linking strategy**: Mixed usage of two approaches:
  - `file:` relative paths (e.g. `"@pharmacy/contracts": "file:../../packages/contracts"`, `"@pharmacy/design-tokens": "file:../../packages/design-tokens"`, `"@pharmacy/ui-native": "file:../../packages/ui-native"`).
  - A bare `"*"` specifier in `packages/api-client/package.json` referencing `@pharmacy/contracts`.
  This means the monorepo does not rely on npm's built-in workspace auto-linking for cross-package references; instead it uses explicit file links (and one wildcard). Adding a new workspace package requires manually updating every consumer's `package.json` to add the matching `file:` or `*` entry.
- **Package exposure**: Shared packages declare `main`, `module`, `types`, and an `exports` map pointing at their TypeScript source files directly (e.g. `./src/index.ts`), so consumers import TS sources without a build step. `ui-native` additionally declares a `react-native` export condition.
- **Peer dependencies**: `ui-native` declares peer deps for `react`, `react-native`, `react-native-reanimated`, `expo-haptics`, `@expo/vector-icons`, `react-native-safe-area-context` — pushing those version constraints onto consuming apps rather than bundling them.
- **Version pinning style**: Third-party dependencies use a mix of caret (`^`) ranges (e.g. `zod ^4.3.6`, `axios ^1.15.0`, `@supabase/supabase-js ^2.103.0`) and exact pins (e.g. `react 18.3.1`, `date-fns 3.6.0`, `clsx 2.1.1`, `sonner 2.0.3`). No central version alignment tool (like `overrides` in the root) is enforced except the unused `pnpm.overrides` block.
- **No private registry**: `.npmrc` contains only `legacy-peer-deps=true`; there is no `registry=`, `//npm.pkg.github.com/:_authToken=`, or `@pharmacy:registry=` entries, so all packages resolve from the default public npm registry.
- **Per-target lockfiles**: Each app directory carries its own `package-lock.json`, so builds for `shopper-web`, `shopper-native`, and `api` can be reproducible independently.

## Conventions and constraints

- **Node engine constraint**: Root `engines.node >=22.22.2 <23` and `packageManager npm@11.6.0` enforce a specific Node/npm pair across the monorepo.
- **Peer dep relaxation**: `legacy-peer-deps=true` in `.npmrc` applies globally, allowing mixed peer dependency versions between apps and packages without failing installs.
- **Workspace boundary rule**: Internal packages are marked `private: true` and are not published; they are consumed only through `file:` links within the monorepo.
- **Source-first packages**: Shared packages expose `.ts` files via `main`/`module`/`exports`, meaning consumers compile TypeScript against the raw source rather than prebuilt artifacts.
- **No centralized version management**: There is no `pnpm` workspace protocol (`workspace:*`), no `overrides` in the root `package.json` (only a stale `pnpm.overrides`), and no tool like `npm-check-updates` or Renovate configured in the visible repo to automate upgrades. Version updates must be edited manually in each `package.json`.