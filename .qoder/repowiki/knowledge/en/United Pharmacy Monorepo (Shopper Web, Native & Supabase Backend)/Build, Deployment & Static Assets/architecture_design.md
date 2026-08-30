The module is split into two sibling scopes with no internal dependencies between them.

- `scripts/` contains standalone Node.js and Bash utilities:
  - `check-no-console.mjs` walks `apps/shopper-web/src/**/*.ts|tsx` and fails the build if any `console.log/warn/error` call is found — used as a pre-commit or CI lint step.
  - `ingest-products.mjs` is an idempotent CLI that reads a raw CSV (e.g. B-Connect export), normalizes column names via a flexible `pick()` helper, deduplicates rows by SKU/international code/name, and emits JSON (with `--dry-run` support).
  - `railway/*.sh` are Railway service entrypoints: each pair (`build-*` / `start-*`) targets one workspace target (`api`, `shopper-web`, `shopper-native`). Build scripts install deps, generate Prisma client, and run framework-specific builds; start scripts enforce minimum Node versions and `exec` the production binary or serve command.

- `assets/` is a flat collection of static resources referenced by the frontend:
  - `brand/` — PNG logos and icons for marketing/about pages.
  - `categories/` — SVG category icons consumed by the shopper UI.
  - `web/` — PWA assets (favicon variants, Apple touch icon, Android Chrome icons) plus `site.webmanifest` declaring theme colors and display mode.

Dependency direction is outward only: scripts import from `node:*` and relative workspace paths (`apps/*`, `packages/*`); assets are pure read-only data consumed by other packages.