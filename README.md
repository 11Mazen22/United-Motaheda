# Pharmacy Motahheda Monorepo

This repository now uses an `npm workspaces` monorepo layout for the pharmacy commerce ecosystem.

## Workspace layout

- `apps/shopper-web`: active Vite/React customer web application
- `apps/ops-dashboard`: operations dashboard shell
- `apps/customer-mobile`: customer mobile shell
- `apps/cashier-mobile`: cashier/POS shell
- `packages/api-client`: the shared backend access layer
- `packages/domain-*`: shared domain logic, state, and contracts
- `packages/types`: shared cross-app interfaces
- `packages/ui-web`, `packages/ui-native`, `packages/design-tokens`: shared presentation primitives

## Architecture rules implemented here

- Shared backend access is centralized behind `packages/api-client`.
- Shared workflow events and query conventions live in `packages/domain-core`.
- Search state is centralized in `packages/domain-search` with Zustand + TanStack Query.
- Geo-aware assignment and checkout quote logic live in `packages/domain-location`.
- Medical-first product helpers live in `packages/domain-catalog`.

## Running the shopper web app

Install dependencies:

```bash
npm install
```

Start the active web app:

```bash
npm run dev
```

Typecheck the active workspace:

```bash
npm run typecheck
```
