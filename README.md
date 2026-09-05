# United Pharmacy Monorepo

**See [PROJECT_HANDBOOK.md](./PROJECT_HANDBOOK.md) for the full, verified architecture, navigation maps, and known issues.** The summary below is intentionally short — the handbook is the source of truth.

This is an `npm workspaces` monorepo for a pharmacy delivery platform, backed by a self-hosted Supabase stack on Railway.

## What's actually here

- `apps/shopper-native`: the primary product — Expo/React Native app serving customers, drivers, and pharmacists as role-based personas in one app.
- `apps/shopper-web`: Vite/React web app — public storefront plus the real staff admin panel (embedded under `/admin`).
- `apps/api`: a small NestJS service for the handful of things Supabase's direct REST/RPC access can't do alone (delivery-fee quoting, AI-assisted promotion drafting) plus admin-only operations.
- `packages/*`: 18 workspace packages. Only 8 are real and actually imported (`contracts`, `api-client`, `domain-catalog`, `domain-core`, `domain-location`, `fuzzy-search`, `types` on the web side; `design-tokens` and `ui-native` on the native side) — and **none are shared between the two apps**. The rest are unused stubs. Don't assume a package here is load-bearing without checking the handbook's usage table first.
- `apps/admin`, `apps/cashier-mobile`, `apps/customer-mobile`, `apps/ops-dashboard`, `apps/courier-mobile` are not real (removed or stub scaffolds) — see the handbook.

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
