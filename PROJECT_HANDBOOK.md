# United Pharmacy — Project Handbook

**Last verified: 2026-09-05.** Everything in this document was confirmed directly against the actual code, config, and (where noted) the live database on that date — not copied from older docs. Where older docs disagree with this one, **this document is correct and they are stale** (see §10 for exactly which ones and why).

## 0. How to use this document

This is the single entry point for understanding the whole codebase. Read §1–§2 for orientation, then jump to whichever app/system section you need. §6 ("Known issues, gotchas, and dead code") is worth reading in full before you touch anything — it front-loads the mistakes that have already cost real debugging time on this project.

This supersedes the architecture described in root `README.md` (which describes a package layout that was never actually built out — see §4). It does **not** replace `SESSION_HANDOFF.md`, which is a chronological, incident-by-incident debugging diary written by previous AI sessions — keep using that for infra credentials and the exact history of specific bug fixes. This document is the map; `SESSION_HANDOFF.md` is the trip log.

---

## 1. What this project is

**United Pharmacy** (صيدليات المتحدة) is a pharmacy delivery e-commerce platform serving Egypt (Cairo/Ismailia area branches). Customers order medication and health products for home delivery; pharmacists prepare and verify orders (including prescription review); drivers deliver them. It has three real, actively-developed codebases:

- **`apps/shopper-native`** — a React Native / Expo app that is the primary product surface. One app, three personas: customers, drivers, and pharmacists all sign into the *same* app and are routed to different tab sets based on their role.
- **`apps/shopper-web`** — a Vite/React web app that is both the public storefront (for customers without the native app) *and* the actual staff back-office (order management, inventory, prescriptions review, staff/user administration), embedded under `/admin`.
- **`apps/api`** — a NestJS backend that is a small admin/ops service, not a general-purpose API. Most of the system talks directly to Supabase (PostgREST/Auth/Realtime/Storage); this service only exists for the handful of things that need it (see §3.3).

The backend is a **self-hosted Supabase stack running on Railway** — Postgres, PostgREST, GoTrue (Auth), Realtime, Storage, and Supabase Edge Functions, each as its own Railway service — not Supabase Cloud. It was migrated off Supabase Cloud around 2026-08-29. There is also a self-hosted **Ollama** LLM service (also on Railway) powering one admin feature (AI-assisted promotion drafting — see §3.3).

---

## 2. Repository map

```
I:\United-Motaheda\
├── apps\
│   ├── shopper-native\   ← REAL, primary app (Expo/React Native) — §3.1
│   ├── shopper-web\      ← REAL, primary app (Vite/React) — §3.2
│   ├── api\              ← REAL, small NestJS admin/ops service — §3.3
│   ├── cashier-mobile\   ← stub: package.json + one 1-line component, nothing else
│   ├── customer-mobile\  ← stub: same pattern
│   ├── ops-dashboard\    ← stub: same pattern
│   ├── courier-mobile\   ← empty directory, no code at all
│   └── admin\            ← DELETED 2026-09-05 (commit c7b5be0) — see §4.1
├── packages\              ← 18 workspace packages; only 8 are real+used — §4.2
├── supabase\              ← self-hosted Supabase config: migrations, Edge Functions — §5
├── database\              ← 28 untracked, copy-paste-only ad-hoc SQL scripts — §5.2
├── scripts\               ← repo-wide utility + Railway build/start scripts — §7.2
├── docs\                  ← SOP guide (.docx), presentations, a couple of task-completion notes
├── guidelines\Guidelines.md ← a handful of real, current UI/routing conventions (see §6)
├── .validation\           ← CI/lint scratch output, not documentation
├── assets\                ← shared static assets (web favicons etc., pulled in by shopper-web's Vite config)
├── .qoder\, .cursor\, .kilo\, .kiro\, .trae\, .windsurf\, .zed\, .agents\
│                          ← editor-specific state from various AI coding tools used on this
│                            project over time. `.qoder/repowiki/` in particular contains an
│                            auto-generated architecture wiki that describes the *aspirational*
│                            package architecture from README.md, not the real one — don't
│                            trust it over this document (see §4.2).
├── README.md              ← now updated to point here; previously described a fictional layout
├── SESSION_HANDOFF.md     ← chronological incident log, gitignored (has some infra secrets), see §0
├── ENGINEERING_ROADMAP.md ← dated 2026-05-11, predates the native app entirely — stale, see §10
├── PRODUCTION_SETUP_CHECKLIST.md, GET_SUPABASE_KEY.md, OLLAMA_RAILWAY_SETUP.md
│                          ← Ollama/Promotion-Copilot infra setup docs; reference the OLD
│                            pre-migration Supabase Cloud project ref in places — verify before
│                            following literally, see §10
├── app.json, eas.json     ← STALE DUPLICATES, not what Expo/EAS actually builds from — see §6.4
├── package.json           ← root npm workspace manifest (workspaces: shopper-web,
│                            shopper-native, packages/*  — NOT apps/api, NOT the stub apps)
└── Dockerfile.ollama, start-ollama.sh ← the self-hosted Ollama service build
```

---

## 3. The three real applications

### 3.1 `apps/shopper-native` — React Native / Expo app (customer + driver + pharmacist)

**Stack**: Expo SDK ~55, React Native 0.83, `expo-router` (file-based routing), React Query 5 + Zustand (deliberately layered — see §6.3), Supabase JS client, NativeWind/Tailwind, Reanimated 4, MMKV, i18next. TypeScript ~5.9.

**Entry & bootstrap** — `app/_layout.tsx`: waits on font loading (Cairo font family, 6s timeout fallback), then mounts a large provider stack (error boundary → RTL locale → gesture handler → bottom sheet → safe area + persisted React Query client → network bridge → language → theme → **auth**), then session-wide singletons (notification sync, customer-orders realtime sync, products sync, push registration + deep-link routing, cart-reservation notifier, and `PharmacyBootstrap` which hydrates prescriptions/health-profile/orders/cart/wishlist/payment stores). Root `<Stack>` registers `index`, `onboarding`, `(customer)`, `(driver)`, `(pharmacist)`, `(auth)`.

**`app/index.tsx`** is the real boot-time router — not a screen. It waits for onboarding-seen + auth-loading, computes a target (`/onboarding` | `/(driver)` | `/(pharmacist)` | `/(tabs)`) exactly once (locked into a `useRef`), and defers the actual `router.replace()` by one macrotask to avoid a documented React "Maximum update depth exceeded" crash class.

**Role-based routing** — three separate layouts each independently gate access, all using the same "lock a ref only once role is genuinely known" pattern (this fixes a historical bug where drivers/pharmacists got permanently stranded on the customer tabs — see §6 for the pattern and why it matters):
- `app/(customer)/(tabs)/_layout.tsx` — waits for `!loading && (user.role !== undefined)` before locking; renders a blank view, never the tabs, while undecided.
- `app/(driver)/_layout.tsx` — gates on **both** `role === "driver"` **and** a live, `APPROVED`/`ACTIVE` `DriverProfile.status` — role alone isn't trusted, because an admin can flip `profiles.role` to `"driver"` from the web admin's `UsersManager.tsx` with zero vetting.
- `app/(pharmacist)/_layout.tsx` — gates on role only (`pharmacist`/`admin`/`manager`) — **no equivalent "approved profile" check exists for pharmacists**, an asymmetry worth knowing about.
- `AuthContext` also subscribes to realtime updates on the user's own `profiles` row, so a role/status change while the app is open re-runs the routing decision and force-signs-out a suspended user.

**Full navigation map** (route groups under `app/`):

*`(auth)`* (modal-presented): `login`, `register`, `forgot-password`, `verify-phone` (OTP), `reset-password`, `complete-profile` (post-Google-signup name/phone collection), `verify-email` ("check your email" + resend with cooldown).

*Top-level*: `index` (boot router), `onboarding` (first-launch carousel), `auth-callback` (OAuth/email PKCE exchange), `driver-application`, `edit-profile`, `change-password`. `help/_layout.tsx` exists but has no screens and no navigation target anywhere — vestigial. `__preview/components` is a `__DEV__`-only component gallery.

*`(customer)`* — tab bar (`(tabs)`): Home / Shop (`products`) / Cart / Orders / Profile, plus three `href:null` phantom tab entries (`map`, `meds`, `search`) that reference files which don't exist in this folder (the real screens moved into `(shop)/` and are just `<Redirect>` stubs there — leftover from a refactor). Sibling groups on the same stack: `(account)` (addresses, favorites, notification preferences/inbox, order detail/tracking/return, default payment method), `(info)` (about/faq/privacy/terms), `(shop)` (category browsing, deals, product detail, full search experience — `map.tsx`/`meds.tsx`/`featured.tsx` here are just redirect stubs), `checkout` (modal), and an ungrouped `prescriptions/` folder (list, add-via-scan/manual/transfer, detail, refill).

*`(driver)`* — tabs: Home (`DriverManifest`, today's queue) / Map (`DriverMap`, live GPS + route to destination) / Offers (`AssignmentOffersList`, badge = live offer count). Other screens: offer detail, active-delivery execution screen, issue reporting, profile, earnings, a driver-scoped notification center.

*`(pharmacist)`* — 6 tabs: Workbench / Orders / Prescriptions / Inventory / Analytics / Profile. Other screens: order detail, prescription detail, refills, barcode scanner, returns queue + inspection, a pharmacist-scoped notification center.

**Feature folders** (`src/features/`, 23 total, one empty): `addresses`, `auth`, `cart`, `checkout` (pricing engine, Zod schema, coupon/manual-payment/resilience-with-retry-and-draft-persistence), `delivery`, `dependents`, `driver` (manifest/offers/execution/earnings/GPS Kalman filter/stage machine), `faq`, `health-profile`, `home`, `insurance`, `inventory` (reservation lifecycle RPCs), `notifications`, `observability`, `orders`, `payment`, `pharmacist` (dashboard/orders/inventory/prescriptions/refills, with a `domain/` subfolder separating pure business logic from API/UI), `prescriptions`, `products`, `profile`, `recommendations`, `search` (**empty, no files**), `wishlist`.

**Shared infra** (`src/lib/`): single Supabase client for all three personas (`src/lib/supabase.ts`, PKCE flow, AsyncStorage session storage); a single React Query client (`queryClient.ts`, 5 min stale / 24h gc, offline-first mutations) persisted to MMKV; an offline mutation queue with exponential backoff; network/focus bridges for React Query. State management is **both** Zustand and React Query on purpose: React Query owns server state/caching, Zustand stores are an instantly-readable local mirror hydrated from it (documented explicitly in several store headers). Top-level stores: `cart.ts` (largest, 26.7K, optimistic + inventory-reservation lifecycle), `orders.ts`, `wishlist.ts`, `checkout.ts`, `healthProfileStore.ts`.

**i18n/RTL**: `src/i18n/index.ts`, i18next, **Arabic is the default** (`fallbackLng: "ar"`), English is opt-in and stored in MMKV. RTL is **forced at the OS layout-engine level** (`I18nManager.allowRTL/forceRTL`) whenever the active language is Arabic — and because Android only applies a `forceRTL` change after a real reload, switching language triggers `Updates.reloadAsync()`. This is a fundamentally different mechanism from the web app (§3.2) — don't assume the two apps' RTL code ports directly between each other.

**Design system**: `packages/ui-native` + `packages/design-tokens`, both heavily used (158 and 89 importing files respectively — not vestigial). Resolution is **not** normal npm-workspace linking — see §6.4 for why, and don't try to "fix" it by renaming the package without understanding that first.

**Config**: the app has its **own** `app.json`/`eas.json` inside `apps/shopper-native/` — these are the real ones EAS builds from, not the stale duplicates at repo root (§6.4). Bundle/package id `com.unitedpharmacy.app`, scheme `shopper`, Android `versionCode: 54`. EAS profiles: `development`, `preview`, `preview-aab`, `production-apk`, `verify`, `production` — six, not five. Publishing an OTA update: `cd apps/shopper-native && eas update --branch preview --message "..." --non-interactive` (run in background, it can take minutes), then **force-stop and relaunch the app on-device twice** — the first relaunch downloads the update, the second applies it. One relaunch is not enough; this has bitten prior sessions repeatedly.

### 3.2 `apps/shopper-web` — Vite/React web app (storefront + embedded admin)

**Stack**: React 18.3, `react-router-dom` v7, Vite 6, **Tailwind v4** (this app's own `package.json` overrides the root's Tailwind v3 pin), Radix primitives wrapped shadcn/ui-style, TanStack Query (installed but lightly used — most data fetching is bespoke `useState`/`useEffect` + service functions, not `useQuery`), plain React Context for cart (not Zustand). Originally scaffolded via Figma Make (per `ATTRIBUTIONS.md`), which explains the heavy Radix/MUI dependency list — `@mui/material`/`@emotion/*` are root dependencies with **zero actual imports** in this app.

**Entry & routing**: `src/main.tsx` → `src/app/App.tsx`. Every route is lazy-loaded. Three tiers: auth/public routes with no catalog provider (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/suspended`, `/track/:orderId` — public guest order tracking); then a `CatalogShell` wrapping everything else in `CatalogProvider`+`CartProvider`; inside that, `/driver` (a standalone protected UI, not part of the admin panel), `/admin/*` (see below), and the customer shell (`/`, `/products`, `/products/:id`, `/categories`, `/categories/:id`, `/offers`, `/cart`, `/checkout`, `/profile`, `/orders`, `/favorites`, legal/support pages).

**Dual desktop/mobile rendering**: below a **1200px** breakpoint (`useIsShopperShell()` — distinct from a separate 768px `useIsMobile()`), the app renders an app-like shell with a persistent bottom nav (`ShopperMobileLayout.tsx`) instead of the desktop chrome — same routes, different components, not a separate mobile site.

**The embedded admin panel** (`src/app/admin/*`, ~24 files) is **the real, deployed admin panel** — not the standalone `apps/admin` (deleted, §4.1). Gated to `admin`/`manager`/`pharmacist` roles (driver has its own separate `/driver` route, unrelated to this panel). Sidebar sections: Overview (Dashboard), Order Processing (Orders, Special Orders), Inventory (Fast Entry, Product Catalog, Promotions), Prescriptions (Review queue), User Management (Users, Staff — admin-only), Notifications (broadcast composer). Key files: `OrdersManager.tsx` (order lifecycle + driver dispatch — this is what the automated-dispatch work in §9.1 wired into), `OrderDetailDrawer.tsx`, `ProductManager.tsx` + `FastProductEntry.tsx` + `BarcodeScannerDialog.tsx`, `PromotionsManager.tsx` + `PromotionCopilotWorkspace.tsx` (AI-assisted promotion drafting, talks to `apps/api`), `PrescriptionsManager.tsx`, `StaffManager.tsx` / `UsersManager.tsx` (with `SuspendDialog.tsx` / `DeleteUserDialog.tsx`), `NotificationsManager.tsx`. Role model (`AdminRole`) is the single canonical `Role` type from `packages/contracts` (`ROLE_VALUES = [admin, manager, pharmacist, driver, customer]`) — shared correctly, this part isn't fragmented.

**Services layer** (`src/services/`, 24 files) — almost everything talks **directly to Supabase**, not to `apps/api`. `googleSheetsApi.ts` is a ~1400-line legacy misnomer (no longer touches Google Sheets) that's mostly superseded but still load-bearing for barcode lookup and fast product entry — don't delete it assuming it's dead. `optimizedCatalogApi.ts` and `searchSuggestions.ts` are empty dead stubs. `specialOrdersApi.ts` targets a `special_order_requests` table with zero call sites anywhere — the admin's `SpecialOrdersManager.tsx` actually queries a *different* table, `special_orders`, directly inline. There is **no customer-facing prescription upload UI on web** — prescriptions arrive via the native app, staff manual entry, or WhatsApp (a `submission_source` enum value), and are only ever reviewed here, not created here.

**Realtime**: `src/hooks/useRealtimeSync.ts` is the generic subscribe-to-a-table hook, used across catalog, orders, admin orders/prescriptions/products/promotions/staff/users.

**i18n/RTL**: toggleable (not forced), Arabic-first (`fallbackLng: "ar"`), implemented as a live `document.documentElement.dir` flip on language change — no app reload needed. This is a **different mechanism from the native app** (§3.1) on purpose; don't assume shared code between them here.

**Build/deploy**: `npm run railway:build:shopper-web` → `scripts/railway/build-shopper-web.sh` → `apps/shopper-web/dist`; start script runs `serve apps/shopper-web/dist -s` — the `-s` SPA-rewrite flag is load-bearing (without it, a direct link to `/reset-password` from an email 404s).

**Env vars**: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`/`VITE_API_BASE`/`VITE_SITE_URL` plus several read outside the centralized `src/app/env.ts` (`VITE_MAPTILER_KEY`, `VITE_WEB3FORMS_ACCESS_KEY`, `VITE_VITALS_ENDPOINT`, `VITE_ERROR_ENDPOINT`). **Important**: `env.ts` and a couple of other files hardcode production fallback values for the Supabase URL/anon key and the MapTiler key — the app boots fully functional against **production** data with zero `.env` file present. Convenient for quick local testing (this is exactly how this session's own live verification worked), but means a careless local run can write real data.

### 3.3 `apps/api` — NestJS admin/ops backend

**This is not a general-purpose API** — most of the system (auth, catalog, cart, checkout, orders, nearly all admin CRUD) talks directly to Supabase's PostgREST/Auth/Realtime/Storage. This service exists only for things that genuinely need server-side logic Supabase's REST layer can't express alone, plus one now-largely-dead subsystem left over from an earlier architecture.

**Database**: the exact same self-hosted Supabase Postgres instance as everything else (confirmed — its Prisma schema includes the full `auth.*` GoTrue schema, and its `DATABASE_URL` connects through the same Railway proxy as `supabase_admin`). Prisma's own tracked migrations (`apps/api/prisma/migrations/`, only 4 files) manage just 9 PascalCase tables (`Branch`, `DeliveryZone`, `DriverProfile`, `DriverLocation`, `DeliveryAssignment`, `DriverSession`, `DriverEarning`, `NotificationToken`, `NotificationLog`) — the other ~95 models in `schema.prisma` were pulled in via `prisma db pull` against Supabase's pre-existing schema and are managed elsewhere (§5.2).

**Auth**: no independent session system — `SupabaseAuthService` validates the same Supabase-issued JWT the frontends use (`supabase.auth.getUser(token)`), loads the matching `profiles` row via Prisma, and role-gates from there. Uses the **service-role key** (RLS-bypassing) for admin-grade operations (creating auth users, Storage uploads). `RoleAuthGuard`/`AdminAuthGuard`/`DriverAuthGuard` are the guards applied per-route.

**What's actually used** (verified by grepping every frontend for calls to this service):
- **`POST /delivery/quote`** — polygon-based delivery fee/ETA calculation, called by both `shopper-web` and `shopper-native`. Genuine shared business logic too complex for a plain PostgREST filter.
- **`GET /branches`** (public) — called by `shopper-native`.
- **`POST /admin/promotion-copilot/propose`** — an LLM tool-calling loop against the self-hosted Ollama instance that drafts (never auto-saves) promotion proposals, grounded by querying Postgres search/pricing functions as tools. Called by `shopper-web`'s `PromotionCopilotWorkspace.tsx`. The one piece of functionality here Supabase genuinely can't provide on its own.
- **Everything under `/admin/drivers*`, `/admin/orders*`, `/admin/stats`, `/admin/branches*` (write side), `/admin/customers`, `/notifications/broadcast`, `/notifications/admin/history`, and the `/driver-locations` Socket.IO gateway** — these were called **exclusively by the now-deleted standalone `apps/admin`** (§4.1). **They currently have no caller anywhere in the codebase.** They're not broken, just orphaned — worth a follow-up decision on whether to remove them or keep them as a documented, currently-unused admin API surface.

**What's confirmed dead**: the entire public `driver.controller.ts` REST flow (driver registration/login/profile/GPS/document-upload/full delivery-workflow state machine) was built for `apps/courier-mobile`, which was retired before this session (it's now an empty directory, §4.1). `apps/shopper-native`'s driver persona talks to Supabase directly instead. The module's own `README.md` states this explicitly.

**A separate, mostly-unconfigured push-notification system**: `NotificationsModule` here uses **Firebase Cloud Messaging**, entirely separate from the Expo-push system the native app actually uses (which runs through a Supabase Edge Function + `notification_outbox` queue, §5.7). In the actual deployed `.env`, no `FIREBASE_*` variables are set at all, so this module silently no-ops.

**Known broken route** (now moot since its only caller is deleted, but worth knowing): `apps/admin` called `PATCH /admin/inventory/:id` and `PATCH /admin/products/:id`; neither controller implements anything but `GET`. These would have 404'd.

**Deploy**: driven from repo root, not `apps/api/package.json` directly — `npm run railway:build:api`/`railway:start:api` → `scripts/railway/build-api.sh`/`start-api.sh`. **Node version is inconsistent across configs** — build script requires ≥24, start script requires ≥22, `.nvmrc` says 24, `.node-version` says 22, root `nixpacks.toml` pins 22, and there's also an unreferenced `apps/api/Dockerfile` pinning Node 20 that doesn't appear to be the live deploy path. Worth resolving deliberately, not by guessing.

---

## 4. Everything else — what's real vs. dead weight

### 4.1 The stub/dead apps

| Folder | State | Verdict |
|---|---|---|
| `apps/admin` | **Deleted 2026-09-05**, commit `c7b5be0`, per explicit request — it was a real 33-file standalone React admin app but had no production deployment anywhere (no Railway service, no Vercel link, no CI workflow) and was functionally superseded by `shopper-web`'s embedded admin (§3.2). | Removed. See §3.3 for what this orphaned in `apps/api`. |
| `apps/cashier-mobile` | `package.json` + one file that renders the literal string `"Cashier mobile shell"`. | Stub, not a real app. |
| `apps/customer-mobile` | Same pattern (`"Customer mobile shell"`). | Stub, not a real app. |
| `apps/ops-dashboard` | Same pattern (`"Ops dashboard shell"`). | Stub, not a real app. |
| `apps/courier-mobile` | Empty directory, no tracked files at all. | Not a real app; its role was absorbed into `shopper-native`'s driver persona. |

None of these five are npm workspace members, referenced by any Railway build script, or referenced by any GitHub Actions workflow.

### 4.2 `packages/*` — 18 workspace packages, and the truth about "shared code"

Root `package.json`'s `workspaces` field includes `packages/*` wholesale, and `README.md` describes a shared-package architecture (`api-client`, `domain-*`, `ui-web`/`ui-native`, `design-tokens`) as if it were load-bearing cross-app infrastructure. **The evidence says otherwise: not one of these 18 packages is actually used by both apps.** Resolution for all of them happens through hand-written `tsconfig.base.json` path aliases and per-app bundler config (`vite.config.ts` aliases for web, `metro.config.js` `extraNodeModules` for native) pointing straight at each package's `src/`, not real npm-workspace `node_modules` linking — several packages' own `package.json` `dependencies` are empty even though their code imports things, because everything actually resolves through the *root* `package.json`'s dependency list being hoisted.

| Package | Real content? | Used by | Verdict |
|---|---|---|---|
| `contracts` | Real (zod schemas: order status, roles, geo, delivery) | shopper-web (13 files) + `apps/api` | Actively used — the one genuinely cross-cutting package |
| `api-client` | Real (347-line API layer, distance/ETA math) | shopper-web only (3 files) | Web-only |
| `domain-catalog` | Real (medical-info builder, alternatives ranking) | shopper-web only (2 files) | Web-only |
| `domain-core` | Real (tiny event bus + shared query client factory) | shopper-web only (2 direct + 2 transitive) | Web-only |
| `domain-location` | Real (zustand location store + delivery quote hook) | shopper-web only (5 files) — shopper-native built its own parallel version instead | Web-only |
| `fuzzy-search` | Real and substantial (1,334 lines, AR/EN pharma dictionary) | shopper-web only (6 files) | Web-only, load-bearing |
| `types` | Real (191 lines of shared types) | shopper-web, but **only transitively** (never imported directly) | Web-only, indirect |
| `design-tokens` | Real (theme/token system) | shopper-native only (89 files) | Native-only, heavy |
| `ui-native` | Real (~27-file RN design system) | shopper-native only (163 files) | Native-only, very heavy — **package.json name is `@united-pharmacy/ui-native` but every import site uses `@pharmacy/ui-native`; this only works because of the metro/tsconfig alias hack** (§6.4) |
| `domain-search` | Real, fully built (search state hook) | **nobody** — shopper-web's real search bypasses it and calls `fuzzy-search` directly | Built, never adopted |
| `ui-web` | Near-empty stub (`export const webUiPackage = {...}`) | nobody | Stub |
| `domain-account`, `domain-cart`, `domain-checkout`, `domain-courier`, `domain-ops`, `domain-orders`, `domain-prescriptions` | Each a single-line type alias, no logic | nobody | Stubs (7 packages) |

Practical takeaway: if you need to share logic between the native and web apps, there is currently **no working example of that pattern to copy** — you'd be establishing it fresh, not extending an existing one. `contracts` is the closest thing to a real shared package and the right place to start if that's ever needed.

Also note: **`.qoder/repowiki/`** contains an auto-generated architecture wiki (from a previous AI tool used on this project) that describes the same idealized/aspirational package architecture as `README.md` — it is not more trustworthy just because it's more detailed. This handbook's package table above is the verified version.

---

## 5. Database & backend architecture

### 5.1 Self-hosted Supabase on Railway

Two **separate** Railway projects — easy to conflate:
- **"efficient-communication"** — the Supabase stack itself (Postgres, PostgREST, GoTrue, Realtime, Storage, Edge Functions, Supavisor, Studio, Imgproxy). Public gateway (Envoy): `https://envoy-production-1cbe.up.railway.app` — this is the value every app's `SUPABASE_URL` should point at.
- **"charismatic-perception"** — hosts the actual app deployments: `shopper-native`'s Expo web export, `shopper-web`, `apps/api`, and the `ollama` service.

Supabase Studio on this deployment has **no authentication wall** (no `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`, no private networking) — anyone with the URL can retrieve the `service_role` key. This was known and flagged in `SESSION_HANDOFF.md` as of this document's writing and had not yet been acted on — verify current status before assuming it's still open.

### 5.2 Schema reality check — read this before touching the database

**The live database cannot be fully rebuilt from this repository's tracked migrations.** There are four separate, uncoordinated places schema changes have been made over this project's life:

1. **`supabase/migrations/`** — the current, CLI-tracked source of truth going forward. 106 files, 2026-07-05 → 2026-09-05.
2. **`apps/shopper-native/supabase/migrations/`** — an **older, frozen** 31-file migration history that lived inside the Expo app before the project's migration tracking was consolidated into the root `supabase/` folder around 2026-07-05. Not deleted, not active — don't add new files here.
3. **`apps/api/prisma/migrations/`** — Prisma's own 4-file ledger, the only tracked source for the 9 PascalCase driver/branch tables (§3.3).
4. **`database/`** — 28 dated, **untracked** ad-hoc `.sql` scripts (2026-05-11 → 2026-07-15), several with headers literally saying "run this in the Supabase SQL editor." No filename overlaps with `supabase/migrations/`.

Combining all four still doesn't account for the real schema: **roughly 37 of the database's ~72 hand-written tables — including `orders`, `profiles`, `products`, `notifications`, `prescriptions`, `refill_requests`, `cart_items`, `favorites`, `inventory`, `pharmacies`, and the entire referral/reward-tier subsystem — have no `CREATE TABLE` statement anywhere in version control.** They were created ad-hoc directly in the Supabase Studio SQL editor. Several in-repo migration comments confirm this explicitly (e.g. "public.notifications has no CREATE TABLE in this repo"). The same is true of some load-bearing functions — `is_manager()` (used in dozens of RLS policies and called by name throughout this document) and `expire_stale_reservations()` (scheduled by pg_cron) have **no `CREATE FUNCTION` anywhere in the tracked repo**.

**Practical implication**: if this database is ever lost, or if you're setting up a second environment, replaying every tracked migration file will *not* reproduce it. If you touch `orders`, `profiles`, `products`, or anything role/permission-related, first confirm the current live definition directly (Studio or a direct `psql`/`pg` connection) rather than trusting any single migration file to be the whole story — and consider writing a proper `pg_dump --schema-only` snapshot as a real fix, not urgent-but-important technical debt.

There's also live/repo drift on Edge Functions: a `driver-batch-scan` function is called by `shopper-web`'s `logisticsApi.ts` and referenced as "deployed" in another function's own comments, but has **no folder in `supabase/functions/` at all**.

### 5.3 Core tables (grouped)

- **PascalCase, Prisma-owned** (written almost exclusively by `apps/api` over a direct service-role connection, bypassing RLS): `Branch`, `DeliveryZone`, `DriverProfile`, `DriverLocation`, `DeliveryAssignment`, `DriverSession`, `DriverEarning`, `NotificationToken`, `NotificationLog`.
- **snake_case, Supabase-owned** (what the client apps actually talk to via PostgREST + RLS + RPCs): `orders`, `order_items`, `profiles`, `products` (has legacy PascalCase *columns* like `Name`/`Price`/`Stock` inside an otherwise snake_case table), `delivery_assignments`, `delivery_issues`, `notifications`/`notification_tokens`, `notification_outbox`/`notification_delivery_attempts`, `prescriptions`/`refill_requests`/`order_prescriptions`, `cancellations`/`refunds`/`order_status_history`, `return_requests`/`return_items`/`return_timeline`, `coupons`/`coupon_batches`/`coupon_redemptions`, `promotions`/`promotion_products`, `sms_campaigns`/`sms_campaign_recipients`/`sms_audit_log`, `addresses`, `cart_items`, `favorites`/`wishlist_items`, `product_reviews`, loyalty/referral/reward tables, health-record tables (`allergies`, `conditions`, `dependents`, `dose_logs`, `medication_reminders`, `insurance_cards`, `drug_interactions`), `admin_audit_log`, `anti_fraud_events`, `user_suspensions`.

**Important overlap/duplication to know about**: `delivery_assignments` (snake_case, what all the driver-dispatch RPCs in §5.4 use) is a genuinely different table from `DeliveryAssignment` (PascalCase, Prisma) — `orders` has relations to *both* simultaneously. Same pattern for `driver_locations` vs `DriverLocation`, and `notification_tokens`/`notifications` vs `NotificationToken`/`NotificationLog`. These aren't typos; they're two parallel systems for the same concern, bridged ad hoc by triggers (`post_driver_earning_on_delivery()`, `ensure_driver_profile()`) that reach across from snake_case triggers into the quoted PascalCase tables. When working on anything driver/delivery/notification-related, confirm *which* of the two tables is actually the live one before assuming — as of this writing, the snake_case versions are the ones the active native-app driver flow and the auto-dispatch system (§9.1) both read and write.

### 5.4 Key functions/RPCs (the ones you'll actually touch)

- **`transition_order(order_id, next_status)`** — the general order-lifecycle state machine, SECURITY DEFINER, role-gated. Current version as of `20260904131500_lock_down_order_status_rpcs.sql`, which fixed a real vulnerability (`auth.uid() IS NULL` satisfying `!=`/`NOT IN` checks under SQL NULL semantics, letting unauthenticated callers cancel arbitrary orders).
- **`admin_transition_order`**, **`get_order_actions`**, **`execute_order_cancellation`** — admin wrapper, allowed-actions computer, and the actual cancellation executor (inventory release + refund record).
- **`manual_assign_driver`, `driver_accept_assignment`, `driver_decline_assignment`, `auto_dispatch_tick`, `rank_available_drivers`** — the automated driver-dispatch system (§9.1, all written 2026-09-05).
- **`resolve_delivery_zone`, `point_in_polygon`, `haversine_km`** — pure-SQL geometry (no PostGIS), ported to match `apps/api`'s NestJS delivery-quote logic so checkout/driver/pharmacist share one answer.
- **`enqueue_notification` / `enqueue_notification_batch`** — idempotent (dedup-key-based) notification writer, feeding both the in-app `notifications` feed and the `notification_outbox` delivery queue.
- **`is_admin()`, `is_manager()`, `has_permission()`** — role-check helpers used inside most RLS policies. `has_permission()` simply delegates to `is_manager()` — there is no granular permission/template system anywhere in this codebase; "has permission" today just means "is manager or admin." **`is_manager()` itself has no tracked `CREATE FUNCTION`** (§5.2).
- **`profiles_guard_role_status()`** (trigger) — pins `role`/`status` back to their prior values for non-managers on any `profiles` write, closing a self-escalation hole RLS alone can't close (RLS filters rows, not columns).

### 5.5 RLS pattern

Role source of truth is a single `profiles.role` column. The recurring gotcha: **a policy on table A that queries table B can recurse if B's own policies query back into A** (this happened live this session — a new `profiles` policy that did a raw `EXISTS (SELECT ... FROM orders ...)` recursed because `orders`' own policies query `profiles`). The fix pattern used throughout this codebase is a `SECURITY DEFINER` helper function that internally bypasses RLS to break the cycle — `is_admin()`/`is_manager()` are the original examples, and every subsequent cross-table policy check follows the same shape. Column-level restrictions (which RLS structurally cannot express) are done via `BEFORE INSERT OR UPDATE` triggers instead (see `profiles_guard_role_status()` above). A few internal-only tables (`DeliveryZone`, `NotificationToken`, `Branch`, `NotificationLog`) are RLS-enabled with **zero policies** — intentional default-deny, since only `apps/api`'s service-role connection ever touches them directly.

### 5.6 pg_cron jobs (all impersonate a real admin user via `SET LOCAL request.jwt.claims`, since cron has no JWT context)

| Job | Interval | Purpose |
|---|---|---|
| `generate-embeddings-tick` | 15s | Drains the product-embedding backfill queue (local `gte-small` model, no external AI API) |
| `expire-stale-reservations` | every 15 min | Sweeps stale inventory reservations that would otherwise block checkout with false "out of stock" |
| `auto-dispatch-tick` | 7s | The automated driver-dispatch waterfall (§9.1) |

### 5.7 Edge Functions (`supabase/functions/`)

`main` (the self-hosted edge-runtime path dispatcher — required because self-hosting runs one process routing by path, unlike Supabase Cloud's one-container-per-function model), `notification-worker` (drains `notification_outbox`, sends via Expo push, retries with backoff — **this is the real push-notification path the native app uses**, unrelated to `apps/api`'s dormant Firebase module), `email-webhook` (transactional email via Resend), `create-order` (checkout entrypoint, re-prices server-side, never trusts client pricing), `cancel-order`, `process-return`, `admin-privileged-actions` (service-role admin actions: staff creation, account locking), `delete-own-account`, `driver-location`, `track-order` (public guest order tracking), `validate-coupon`, `generate-embeddings`, `search-intelligence` (explicitly local-only inference, no external AI API), `sms-campaign-worker` (Twilio, silently no-ops if credentials unset).

---

## 6. Cross-cutting conventions

### 6.1 Auth & roles

One canonical role model, `packages/contracts/src/role.ts`: `ROLE_VALUES = ["admin", "manager", "pharmacist", "driver", "customer"]`, with a rank ordering (`admin(3) > manager(2) > {pharmacist, driver}(1) > customer(0)`). Both apps import this type. The actual authorization boundary is always the database (RLS + SECURITY DEFINER functions) or, for `apps/api`, its own guard checking the same `profiles.role` column — never trust a client-side role check alone.

### 6.2 i18n & RTL — native and web use genuinely different mechanisms

Both apps are Arabic-first (`fallbackLng: "ar"`) with English opt-in. **Native** forces RTL at the OS layout-engine level (`I18nManager.forceRTL`) and needs an app reload to apply a change. **Web** just flips `document.documentElement.dir` live, no reload. Don't port RTL-handling code between them assuming the same semantics — a native-specific quirk like "plain `left`/`right` on `position:absolute` can get silently mirrored under `forceRTL`" has no web equivalent, and vice versa.

### 6.3 State management pattern (native app)

Zustand for instantly-readable local state, React Query for server state/caching — used together deliberately, not as competing choices. Web app takes a lighter approach: TanStack Query is installed but most of its data fetching is still bespoke service-function calls in `useEffect`, and cart state is plain React Context + `localStorage`, not Zustand.

### 6.4 The package-resolution workaround (read before "fixing" it)

`apps/shopper-native/metro.config.js` and `tsconfig.base.json` hand-map `@pharmacy/ui-native` and `@pharmacy/design-tokens` straight to `packages/ui-native/src` and `packages/design-tokens/src`, bypassing normal node_modules resolution entirely. `apps/shopper-web/vite.config.ts` does the equivalent for all the packages it uses. This exists because normal npm-workspace symlinking wasn't reliable here (there's a stray `.ui-native-fUdyND8O` directory in `node_modules` — an interrupted-install artifact confirming this). One direct consequence: `packages/ui-native`'s own `package.json` says its name is `@united-pharmacy/ui-native`, but literally every import site in the app uses `@pharmacy/ui-native` — this only works because of the alias, and renaming either side without updating the other will break the native app's build.

Also: **repo-root `app.json`/`eas.json` are stale duplicates**, genuinely different in content from `apps/shopper-native/app.json`/`eas.json` (confirmed via diff — not a symlink). The ones inside `apps/shopper-native/` are what EAS/Expo actually build from. If you're editing native app config and it doesn't seem to take effect, check you edited the right copy.

---

## 6.5 Known issues, gotchas, and dead code — consolidated

**Data/security:**
- The live schema is not fully reproducible from version control (§5.2) — the single most important fact in this document for anyone doing schema work.
- Supabase Studio has no auth wall on its public URL (§5.1) — unresolved as of this writing.
- `apps/api`'s admin/driver/notification-broadcast endpoints and its Socket.IO driver-location gateway are now orphaned (no caller) following the `apps/admin` deletion (§3.3, §4.1) — worth a deliberate decision, not silent bit-rot.
- `apps/shopper-web` boots fully functional against **production** Supabase with zero `.env` file, due to hardcoded fallbacks (§3.2) — easy to accidentally write real data from a local dev box.

**Dead code inventory** (safe to remove once double-checked, not yet acted on by this document):
- `apps/shopper-web/src/services/optimizedCatalogApi.ts`, `searchSuggestions.ts` — empty stubs.
- `apps/shopper-web/src/services/specialOrdersApi.ts` — full implementation, zero call sites (targets the wrong table).
- `apps/shopper-web/src/components/` (singular — distinct from `src/app/components/`): `CatalogPerformanceMonitor.tsx`, `LoadingOverlay.tsx`, `PerformanceMonitor.tsx`, `Skeleton.tsx` — zero importers.
- `apps/shopper-web/src/app/admin/AdminSidebar.tsx`'s `DRIVER_SECTIONS` constant — unreachable, `AdminLayout` excludes drivers before the sidebar ever renders it.
- `apps/shopper-web/src/app/admin/pharmacy_catalog_with_images.xlsx` — an orphaned spreadsheet sitting in source.
- `packages/domain-search` — fully implemented, never adopted (real search bypasses it).
- 8 one-line-stub packages under `packages/` (§4.2).
- `apps/shopper-native/app/(customer)/(tabs)/_layout.tsx`'s `map`/`meds`/`search` phantom tab entries — reference files that don't exist in that folder.
- `apps/shopper-native/app/(customer)/help/` — a bare layout with no screens and no navigation entry point anywhere.
- `apps/api/src/modules/driver/driver.controller.ts`'s entire public REST surface — built for the retired `courier-mobile`, confirmed dead by the module's own README.
- A pile of one-off diagnostic scripts at both `apps/api/` root (~122 files: `check_*.js`, `fix_*.js`, `verify_*.js`, etc.) and `apps/shopper-native/` root (`fix_cart.cjs`, `test_supabase*.js`, stray zip/binary artifacts) — debugging session leftovers, not part of either app's runtime.

**Historical gotchas worth remembering** (full detail and root causes are in `SESSION_HANDOFF.md`, kept short here):
- A React Native `<Pressable style={({pressed}) => [...]}>` (function-form style prop) silently fails to deliver `flexDirection` to children on this app's RN/Fabric setup — several screens still use this pattern; convert to the shared `PressableScale` wrapper if a "children rendered in the wrong order/position" bug shows up.
- Missing `lineHeight` on heavy-weight (`extrabold`/`black`) Arabic text can visually garble the rendered letters, not just clip them.
- This app's custom `Text` primitive only resolves font weight from its own `weight` prop — a raw `style.fontWeight` number is silently ignored.
- EAS OTA updates need the app force-stopped and relaunched **twice**, not once, before a fix is actually visible on-device.

---

## 7. Current feature state (as of 2026-09-05)

### 7.1 Automated order & driver dispatch — done and verified live

The order-assignment workflow used to be fully manual: an admin had to open every "ready" order and hand-pick a driver, with no distinction between "never assigned" and "declined and nobody noticed." As of today, this is now a self-healing automatic waterfall:

1. The instant an order is `ready`, a background job (`auto_dispatch_tick`, every 7s) ranks every online, eligible driver by distance + current workload and offers the order to the single best one — not a broadcast.
2. That driver gets 25 seconds to accept or decline via push notification. Decline or timeout → the system automatically offers the next-best candidate.
3. Acceptance locks the order to that driver; every other driver is excluded — no scenario where two drivers both think they're delivering the same order.
4. If every candidate is exhausted, the order is marked `escalated` and every admin/manager is notified to step in manually — the fallback, not the common path.
5. An admin can manually override at any point; this atomically supersedes any pending automatic offer so a stale offer can never mutate the order after something else has taken its place.

Implementation: `orders.dispatch_status` (idle/searching/assigned/escalated), layered on top of (not replacing) the existing `orders.status` lifecycle; `manual_assign_driver`/`driver_accept_assignment`/`driver_decline_assignment`/`auto_dispatch_tick` (§5.4); admin UI in `OrdersManager.tsx` shows a live badge per order (searching-with-countdown / manually-assigned-awaiting-response / accepted / escalated); native driver app shows a real countdown to the offer's actual `expires_at`. Verified via a 27-assertion test suite covering every race condition (concurrent ticks, late acceptance, manual-override-vs-stale-offer, escalation notification correctness) — all passing — plus live browser verification of the admin assign-driver flow.

**Not yet built**: the equivalent for pharmacists. Today, any pharmacist scoped to a branch can act on any order there — no formal "claim," so two pharmacists could in principle collide on the same order. The designed (not yet implemented) fix is a claim/release mechanism: a pharmacist taps "Take Order," locking it to them; it auto-releases after 10 minutes of inactivity or on explicit release.

### 7.2 Prescriptions system — not yet audited

There's a real, built-out prescriptions feature on both native (full add/scan/manual/transfer/refill flow) and web (staff review only, §3.2), backed by real tables and RLS (`prescriptions`, `refill_requests`, `order_prescriptions`, `review_prescription()` RPC). A full correctness/completeness audit of this system has been requested but not yet performed — don't assume it's been verified end-to-end just because the code exists.

### 7.3 Branches & delivery zones — recently corrected

All 6 physical branch locations (names, addresses, coordinates, phone numbers) were corrected to match verified ground truth as of 2026-09-05, with their delivery-zone polygons regenerated to match. Branch/zone data is otherwise Prisma-owned (`Branch`, `DeliveryZone` — §5.3), edited via direct SQL, not through any admin UI form.

---

## 8. Where to go for more

- **`SESSION_HANDOFF.md`** — chronological, incident-by-incident debugging log from previous sessions. Has the *why* behind specific fixes, exact Railway service IDs/credentials (it's gitignored on purpose — never un-gitignore it, the GitHub repo is public), and the on-device ADB verification workflow in detail.
- **`ENGINEERING_ROADMAP.md`** — dated 2026-05-11, written before the native app existed. Its milestones (M0–M12) may still describe real unaddressed shopper-web performance work, but its "snapshot of where things stand" table is stale — verify each item against current code before trusting it.
- **`PRODUCTION_SETUP_CHECKLIST.md`, `GET_SUPABASE_KEY.md`, `OLLAMA_RAILWAY_SETUP.md`** — Ollama/Promotion-Copilot infrastructure setup. Useful for the deployment mechanics, but reference the **old, pre-migration Supabase Cloud project** in places (`gntpxffonjvnvadjclpl.supabase.co`) — substitute the current self-hosted gateway URL (§5.1) before following any step literally.
- **`apps/shopper-web/LOADING_STATE_GUIDE.md`** and **`OPTIMIZATION_SETUP.md`** — app-local docs on loading-state/CLS architecture and the 52K-product catalog performance setup.
- **`guidelines/Guidelines.md`** — mostly template boilerplate, but its last two sections (mobile shopper shell tab rules, auth route conventions) are real and current.
- **`.qoder/repowiki/`** — an auto-generated wiki from a previous AI tool. Treat it the same way as `README.md`'s old architecture claims: more detailed than reality, not more accurate. This handbook is the corrected version.
