# United Motaheda — Engineering Roadmap

**Document owner:** engineering
**Status:** active
**Last revised:** 2026-05-11
**Scope:** post-stabilization roadmap for `apps/shopper-web` and supporting packages.

> **Stale as of 2026-09-05**: written before `apps/shopper-native` existed (its own "M12 — not started" line is long out of date; the native app is now the primary product). The specific shopper-web milestones below may still be valid — verify each against current code before acting on it. See [PROJECT_HANDBOOK.md](./PROJECT_HANDBOOK.md) for the current, verified state of the whole codebase.

---

## 0. Executive summary

The codebase is past its acute-stabilization phase. Six TypeScript build errors are resolved, the two competing catalog data stacks have been collapsed to one, the broken mutating `CatalogContext` actions are removed, and the V8 spread-limit crash on the mobile catalog page is fixed.

This roadmap sequences the remaining work to bring the platform to enterprise-grade performance, multi-branch geo-aware delivery, and production-quality typing. It is deliberately scoped to **what we can prove**, not what would sound impressive. Each milestone has a defined acceptance test; nothing is "done" without it.

The roadmap is **sequenced by dependency and risk**, not by visual impact. The most user-visible improvements (UI polish, premium animations) are deliberately later because they are worthless on top of a broken data layer.

### Snapshot of where things stand

| Area | State | Reference |
|---|---|---|
| Build (TypeScript) | Green | M0 |
| Catalog data stack | Single stack, schema-correct | M0 |
| Catalog mutations | Read-only snapshot model | M0 |
| Worker-based search | Working, but thrashes on navigation | M4 |
| Provider tree | Global `CatalogProvider` at root — blocks every route | M1 |
| Supabase cold fetch | Sequential 1000-row pages (~50 round trips) | M2 |
| Server-paginated reads | Infrastructure exists, unused | M3 |
| Branch / geo delivery | Hardcoded to one branch and fixed fee | M5 |
| TypeScript strict mode | Off | M6 |
| Bundle size | Unmeasured | M7 |
| Image pipeline | Unaudited | M8 |
| Observability | None | M9 |
| UI/UX polish pass | Out of scope until M1–M9 land | M10 |
| Folder/package structure | Drifting (two `AuthContext` files, dual `hooks/` trees) | M11 |
| React Native app | Not started — separate program of work | M12 |

---

## 1. Definition of done

"Done" for this program means **all of the following** are true simultaneously:

1. Cold `/products` route renders interactive in **under 2.5 s** on a simulated Slow 4G connection with a 52 000-product catalog.
2. **No** main-thread task on any route exceeds **50 ms** during steady-state interaction (per Chrome DevTools Long Task API).
3. Searching, category filtering, and sorting on `/products` complete in **under 100 ms** at the 95th percentile.
4. **Zero** hardcoded business values (address, delivery fee, ETA, branch name) remain in client code.
5. User location resolves to the correct **branch + delivery zone + fee + ETA** within 1 s of permission grant.
6. `tsc --strict` passes on the full repo with **zero** `any`, `@ts-ignore`, or `@ts-expect-error` suppressions.
7. Bundle size budget enforced in CI: initial JS payload **≤ 250 KB gzipped** for the public shell.
8. Lighthouse mobile performance score **≥ 90** on `/`, `/products`, `/checkout`.
9. Smoke test suite covers the **happy path**: browse → search → add to cart → checkout → order confirmation. CI blocks merges on regression.

This is the target. Each milestone below moves one or more of these metrics.

---

## 2. Sequencing principles

The order of milestones is determined by three rules, applied in order:

1. **Fix the data layer before optimizing rendering.** A virtualized grid over corrupt data is not faster than a non-virtualized grid over correct data; it is just confidently wrong.
2. **Fix architectural drift before adding features.** Building the geo-delivery system on top of two competing catalog stacks would double the migration cost when one of them dies.
3. **Defer cosmetic work until performance work is observable.** Premium animations on a 30-second cold load are a UX regression, not an upgrade.

The roadmap therefore proceeds: **data layer → boot path → search/worker → features → quality gates → polish.**

---

## 3. Milestones

Each milestone below specifies its goal, scope, acceptance test, risks, dependencies, and estimated effort. **Effort is given in "focused sessions"** of senior engineering work (one session ≈ half a working day with no context switching). These are honest estimates, not optimistic ones.

### M1 — Move `CatalogProvider` out of the global root

**Goal.** Stop forcing routes that don't need products (auth pages, support, returns, order tracking) to wait on the catalog snapshot.

**Scope.**
- Identify the route partition: catalog-required vs catalog-independent. The required set is the shopper-facing catalog surface plus admin: `/`, `/products`, `/categories`, `/category/:id`, `/product/:id`, `/cart`, `/checkout`, `/favorites`, `/offers`, `/admin/*`, `/driver/*`.
- The independent set is: `/login`, `/register`, `/profile`, `/about`, `/contact`, `/support`, `/returns`, `/track/:orderId`.
- Introduce a `<CatalogShell>` route layout component that wraps the catalog-required tree and provides `<CatalogProvider>`. Move `<CatalogProvider>` out of `main.tsx`.
- Audit `useCatalog()` callers to confirm each lives under the new shell. Add a development-only assertion in `useCatalog()` that throws if no provider is present.

**Acceptance.**
- `/login` and `/register` render their first paint without ever invoking `fetchShopperCatalogSnapshot` (verified via network panel).
- No regression in routes that legitimately need the catalog.
- Production bundle for the auth routes drops measurably (target: visible reduction in initial chunk hydration cost).

**Risks.**
- Some `Layout` or shared header component may call `useCatalog()` unconditionally; needs a careful pass.
- `Profile.tsx` may rely on cached products for "recent orders" recommendations — confirm before re-classifying.

**Dependencies.** None.
**Effort.** 1 session.

---

### M2 — Parallelize the cold-boot Supabase fetch

**Goal.** Reduce the worst-case cold catalog fetch from ~50 sequential round trips to a small bounded number of concurrent waves.

**Scope.**
- Modify `app/catalog.ts:fetchAllProductRows` to (a) get the total `count` from a `select('id', { count: 'exact', head: true })` first, (b) compute the page count, and (c) fire N requests in parallel using `Promise.all` with a concurrency cap of 6 (matching typical HTTP/2 stream limits).
- Preserve the existing fallback to cached snapshot on error.
- Keep the same `normalizeSupabaseProduct` post-processing pipeline; this milestone is network-only.

**Acceptance.**
- Cold-boot full-catalog fetch on a 52 000-row catalog completes in **≤ 4 seconds** on a 50 Mbps connection (down from ~25 seconds previously).
- Partial-failure behavior unchanged: a single failed chunk falls back to cached data; total failure still throws with the original error.

**Risks.**
- Supabase rate limits on concurrent requests from a single client. Cap at 6 is a defensive lower bound; can be tuned up if rate headers permit.
- Out-of-order results are fine because we re-sort downstream, but tests should still verify ordering invariants.

**Dependencies.** None. Independent of M1.
**Effort.** 1 session.

---

### M3 — Server-paginated catalog reads

**Goal.** Stop loading 52 000 products on initial visit. Serve only what the user can see.

**Scope.** This is the single largest change in the program. Approach:

1. **Repurpose `shopperCatalogApi.fetchProductsPage`** (already implemented, currently dead code) as the primary read path.
2. **Split the worker init.** The fuzzy-search worker needs a stable index to do its job. Two viable patterns:
   - **(A) Lazy full-catalog load for search only.** UI renders from paginated reads; the full catalog is fetched lazily, post-first-paint, in an idle callback, and handed to the worker for indexing. Search returns server-paginated results until the worker is ready, then transparently switches to client-side instant search.
   - **(B) Server-side search, worker for suggestions only.** All search and filter requests go through `fetchProductsPage` with appropriate Supabase `or()` filters. The worker is reduced to a suggestion-dropdown engine over a smaller dataset (e.g. top 5 000 popular products).
   - **Recommendation: Pattern A.** Pattern B requires a popular-products signal we don't have. Pattern A keeps the worker stack we already invested in.
3. **Update `CatalogContext`** to expose `productsPage`, `currentPage`, `hasNextPage`, and `loadNextPage` rather than the full `products` array. Provide a separate `useFullCatalog()` hook for the worker init path and admin pages that need the full set.
4. **Update consumers** that currently read all products: `Products.tsx`, `CategoryDetails.tsx`, `ShopperMobileViews.tsx`. They should use the paginated source and let the worker layer handle search.
5. **Featured / spotlight / metrics** can still derive from the full catalog once it loads in the background; they don't gate first paint.

**Acceptance.**
- TTI on `/products` cold-load under **2.5 seconds** on simulated Slow 4G.
- Worker index is built only once per session, not per navigation.
- Search latency p95 under **100 ms** once the worker is ready.
- Pre-worker search (the first ~3 seconds) is handled server-side by `fetchProductsPage` and feels reasonable to the user (no obvious gap).

**Risks.**
- The hardest change in the roadmap. Touches `CatalogContext`, the worker init contract, every page that reads `products` from the catalog, and the suggestion pipeline.
- Worker init still requires the full catalog. If the background fetch fails or is slow, the user gets server-side search only — needs UI signaling.
- API rate limits on filtered queries (search-as-you-type would hit the DB hard without throttling). Reuse the existing debounce + abort infrastructure.

**Dependencies.** M2 should land first so the lazy full-catalog fetch is fast.
**Effort.** 4–5 sessions.

---

### M4 — Stop the worker re-init thrash on navigation

**Goal.** Eliminate the cost of re-initializing the 4-worker pool every time a page is mounted with a new `products` reference.

**Scope.**
- After M3, `CatalogContext` no longer mutates `products` on filter/search. But `CategoryDetails.tsx:246` still creates a *new* filtered array on every render, which `useCatalogProductSearch:241` re-feeds to the worker.
- The worker init should bind to a **stable, session-scoped** product set (the full catalog from M3's background fetch), not to whatever filtered slice a page happens to be showing.
- The hook should pass the **filter** to the worker as a query parameter (the worker already supports `category`, `onlyInStock`, `priceCap` filters per `catalogSearchWorker.ts:67-74`), not a pre-filtered product list.
- This is mostly a *contract* fix at the hook boundary.

**Acceptance.**
- Navigating `/products → /category/medications → /products → /category/skin-care` triggers `ensureCatalogSearchWorkerInit` exactly **once** for the session (verified via console-instrumented check).
- Search behavior unchanged from the user's perspective.

**Risks.**
- Small. The worker already supports server-style filter parameters; we just need to use them.

**Dependencies.** M3.
**Effort.** 1 session.

---

### M5 — Branch + geo-aware delivery (Phase 4 of the original prompt)

**Goal.** Replace all hardcoded business values (Gardenia address, 10 EGP fee, fixed ETA) with a real multi-branch system driven by user location.

**Scope.**

**Backend (apps/api):**
- The `Branch` and `DeliveryZone` Prisma models already exist (`schema.prisma:760-798`). Confirm the `BranchesController` exposes `GET /branches`, `GET /branches/:id`, `GET /delivery/quote?lat=…&lng=…&subtotal=…`. If not, add them.
- Implement a `POST /delivery/resolve` endpoint that accepts `{ lat, lng, subtotal }` and returns `{ branch, zone, fee, etaMinutes, isAvailable }`. Algorithm:
  - Find all `DeliveryZone` polygons containing the point (Postgres `ST_Contains` if PostGIS is available; otherwise client-side point-in-polygon over the cached zone list).
  - Of matching zones, pick the one whose branch has the lowest `loadFactor` (or nearest by Haversine distance — needs product-side decision).
  - Compute fee: `zone.baseFee` × current-time surge if applicable, waived if `subtotal ≥ zone.freeAboveSubtotal`.
  - Compute ETA: base time (10 min prep) + driving time estimate (distance / 30 km/h average) + load surcharge.

**Frontend (apps/shopper-web):**
- A `useDeliveryContext` hook owns the resolution. Inputs: user location (geolocation permission or selected saved address). Outputs: current branch, zone, fee, ETA, availability. Stored in `localStorage` so the second visit doesn't re-prompt for location.
- `BranchSelector.tsx`, `BranchMap.tsx`, `GeofenceStatusBanner.tsx` already exist — audit them, refactor to consume `useDeliveryContext` instead of any hardcoded values.
- Cart and Checkout pages render the dynamic fee + ETA from the hook. The "delivery to Gardenia" string is replaced with the resolved branch's localized name.
- Out-of-zone case: clear UX banner — "Delivery to your area isn't available yet. You can still browse and contact support to request coverage."

**Cross-cutting:**
- Migrate any existing orders/checkout flows that wrote a hardcoded address to instead snapshot the resolved branch + delivery fee at order creation time. The `orders.shipping_fee` column already exists in the schema — wire it up.

**Acceptance.**
- A grep for the literal strings "جاردينيا", "Gardenia", "10 EGP" (and variants), and any hardcoded `deliveryFee` constant returns zero hits in `apps/shopper-web/src`.
- Changing browser geolocation in DevTools triggers a re-resolution: branch name, fee, and ETA update within 1 second.
- Out-of-zone simulated coordinates produce the unavailable banner, and Cart's checkout button is disabled.
- New orders persist `shipping_fee` and an address+branch snapshot.

**Risks.**
- PostGIS may not be enabled on the Supabase project. Confirm before building the server endpoint; client-side point-in-polygon over ~10 zones is fine if not.
- Geolocation permission denial is the most common case in practice — the "pick a saved address" fallback must work end-to-end, not be an afterthought.

**Dependencies.** None strictly, but easier after M3 because the data plane is cleaner.
**Effort.** 4–5 sessions.

---

### M6 — TypeScript strict mode rollout

**Goal.** Eliminate the entire class of nullability and implicit-`any` bugs the current `strict: false` setting hides.

**Scope.** Roll out per-flag, file-by-file, because flipping `strict: true` at once would produce thousands of errors and no path to green.

Order of flag rollout (each is its own sub-milestone):

1. `noImplicitAny` — surfaces the easy wins. Estimated ~30–60 fixes.
2. `strictNullChecks` — the big one. Will surface real bugs in places that quietly assume non-null. Estimated 100+ fixes.
3. `strictFunctionTypes`, `strictBindCallApply`, `alwaysStrict` — usually cheap.
4. `strictPropertyInitialization` — only relevant for class fields; mostly cosmetic in this repo.
5. `noUnusedLocals`, `noUnusedParameters` — surface dead code. Run after the above so we don't churn twice.

**Acceptance.**
- `tsc --strict` passes with zero errors across the repo.
- `apps/shopper-web/src` contains zero `any`, `@ts-ignore`, or `@ts-expect-error` outside of justified module-boundary cases (Supabase response shapes get a single typed boundary in `normalizeSupabaseProduct`; that's the maximum).
- The `noImplicitAny` violation in `optimizedCatalogApi.ts:186` (`row: any`) is already eliminated as a byproduct of M0's stack deletion.

**Risks.**
- Some real bugs will surface. They're bugs we want to find. Plan to triage them in-flight rather than suppress them.
- React 18 + react-router 7 typings can be quirky around `RouteObject` and `useLoaderData`. Reserve a session for type acrobatics.

**Dependencies.** Best done after M1–M5 so we're not re-typing code that's about to be rewritten.
**Effort.** 3–4 sessions.

---

### M7 — Bundle size + code-split audit

**Goal.** Get the initial JS payload under control. Define a budget. Enforce it in CI.

**Scope.**
- Run `vite build --report` (or equivalent visualizer) on the current build. Get a real baseline number.
- Audit the heavy hitters in `package.json`:
  - **`framer-motion`** — verify it's only loaded on routes that animate (Home, ShopperMobileViews). Should not be in the main chunk for `/login`.
  - **`recharts`** — admin-only. Confirm it's not pulled into shopper bundles.
  - **`lucide-react`** — notorious for tree-shaking failures. Verify only the icons used are bundled. If not, switch to per-icon imports.
  - **`@radix-ui/*`** — already per-package, should be fine.
  - **`@mui/material`** — heavy. Audit usage; if it's only one or two components, replace them with hand-rolled equivalents and remove the dep.
  - **`react-slick`** + **`embla-carousel-react`** — two carousel libraries. Pick one.
  - **`react-popper` + `@popperjs/core`** — likely redundant with Radix's Popover.
- Enforce per-route bundle budgets in CI using `vite-plugin-bundle-analyzer` or similar.

**Acceptance.**
- Public shopper-web initial JS payload **≤ 250 KB gzipped**.
- Per-route incremental payloads **≤ 100 KB gzipped** for any single route.
- CI fails on regressions exceeding the budget by more than 5%.

**Risks.**
- Removing MUI requires UI rewrites. Scope before committing.
- Carousel consolidation is a UX change; needs design sign-off if behavior differs.

**Dependencies.** None strictly, but easier after M11 (folder cleanup).
**Effort.** 2–3 sessions.

---

### M8 — Image pipeline

**Goal.** Stop loading raw, unsized, uncompressed product images. Hit LCP under 2.5 s on `/products`.

**Scope.**
- Audit `app/components/figma/ImageWithFallback.tsx`. Confirm what it does today.
- For Supabase-hosted images: use Supabase Storage's transform API (`?width=`, `?quality=`, `?format=webp`) to request appropriately sized images per viewport.
- Implement responsive `srcset` for `ProductCard` images: 320w, 480w, 640w, 960w, with `sizes` attribute matching the grid breakpoints.
- Add blur-up placeholders for above-the-fold images using a low-quality `?width=24&blur=20` thumb encoded as a data URL, or the native `loading="lazy"` + `decoding="async"` for below-the-fold.
- Preload the LCP image hint via `<link rel="preload" as="image">` on the relevant routes.
- Enforce: every `<img>` tag in shopper-web has `width`, `height`, `alt`, and `loading`/`decoding` attributes.

**Acceptance.**
- LCP on `/products` cold load **≤ 2.5 s** on simulated Slow 4G (matching the M1+M2+M3 target).
- Lighthouse "Properly size images" check passes.
- Total image bytes on `/products` first paint **≤ 500 KB**.

**Dependencies.** Independent.
**Effort.** 2 sessions.

---

### M9 — Observability and performance budgets

**Goal.** Stop guessing. Measure.

**Scope.**
- **Runtime errors:** add Sentry (or equivalent). Capture unhandled exceptions, unhandled rejections, React error boundaries. Tag by route and user segment (anonymous / signed-in / admin).
- **Web Vitals:** capture LCP, FID/INP, CLS, TTFB per route via `web-vitals` package. Send to a metrics backend (Sentry Performance, or a custom endpoint).
- **CI gates:**
  - TypeScript check (already exists via `npm run typecheck`).
  - Bundle size budget (M7).
  - Lighthouse CI on `/`, `/products`, `/checkout` — fails the PR if any score drops below 85 on mobile.
  - Smoke test suite (see Cross-cutting §4.2).
- **Catalog telemetry:** Supabase query duration p95 per filter combination. Helps identify missing indexes.

**Acceptance.**
- Production deploys emit metrics; a dashboard exists.
- CI blocks regressions on the four gates above.
- Mean Time To Detection on production incidents drops from "user complaint" to "alert".

**Dependencies.** None.
**Effort.** 2 sessions.

---

### M10 — UI/UX polish (Phase 5 of the original prompt)

**Goal.** Premium feel: consistent loading states, empty states, error states, transitions, accessibility.

**Scope.** Deliberately deferred until M1–M9 because:

1. Polish on top of slow data is a worse experience than rough edges on fast data.
2. Some routes will change shape during M3 (server pagination, infinite scroll behavior); polishing first means polishing twice.

When we get here, the work breaks down as:
- **Audit every route** for the four required states: loading, empty, error, success. Confirm each is designed and implemented.
- **Skeleton sweep.** Replace any spinner-only loading state with a content-shaped skeleton that matches the eventual layout (avoids cumulative layout shift).
- **Transition discipline.** Pick one motion library (Framer Motion is already in; drop `motion` if duplicated). Define a tokenized animation system: 4 durations (instant/fast/normal/slow), 3 easings (standard/decelerate/accelerate). Apply uniformly.
- **Accessibility pass.** All interactive elements: keyboard-reachable, focus-ring visible, `aria-*` correct. Run axe-core in CI.
- **RTL/LTR audit.** The codebase is bilingual; spot-check every flow in both languages for layout breakage.
- **Mobile touch targets.** Every tappable element ≥ 44×44 px per Apple HIG and 48×48 dp per Material.

**Acceptance.**
- Defined per-route in a checklist (TBD when the milestone starts).
- Lighthouse Accessibility score ≥ 95 on every route.
- Manual QA pass in both languages with no visible layout breaks.

**Dependencies.** M1–M9 must land first.
**Effort.** 4–6 sessions. Scoped per route once we get there.

---

### M11 — Codebase structure consolidation (Phase 6 of the original prompt)

**Goal.** Eliminate folder drift. One pattern, applied uniformly.

**Scope.** The repo currently has:
- `src/context/AuthContext.tsx` AND `src/contexts/AuthContext.tsx` (the latter re-exports the former — confused).
- `src/components/` (top-level) AND `src/app/components/` (route-scoped). Unclear which is which.
- `src/hooks/` (top-level — currently houses the deleted `useOptimizedCatalog`) AND `src/app/hooks/` (the real worker hooks).
- `packages/` listed in `tsconfig.base.json` paths (`@pharmacy/domain-*`, `@pharmacy/ui-*`) but most of them are empty placeholders.

The cleanup:
- **One context folder.** Move everything to `src/contexts/`, delete `src/context/`, update imports.
- **Component organization by domain, not by location.** `src/components/` holds primitives; `src/features/<feature>/components/` holds feature-scoped components. Drop `src/app/components/` as a concept.
- **Hooks organized the same way.** `src/hooks/` for cross-cutting, `src/features/<feature>/hooks/` for feature-scoped.
- **Activate the `packages/` workspaces.** Move shared types into `packages/types/`, shared domain logic into `packages/domain-*/`. The path mappings already exist in `tsconfig.base.json:20-39` — just populate them.
- **One source of `CatalogProduct`.** Currently defined in `app/catalog.ts`. Move to `packages/domain-catalog/` so it's reusable when M12 (React Native) lands.

**Acceptance.**
- Single canonical location for each kind of file. Imports across the repo agree.
- `packages/domain-*` populated and importable.
- No file moved without consumer-side import updates (no broken paths).

**Dependencies.** Best done after M6 so we're not refactoring types we're about to re-type.
**Effort.** 2–3 sessions.

---

### M12 — React Native application (deferred)

**Goal.** Native mobile app for iOS and Android, sharing business logic with the web app.

**Scope.** Out of scope for this roadmap as a separate program of work. Notes for planning:

- **Build target:** Expo (managed workflow) unless native modules force bare RN. Default to Expo.
- **Shared code:** business logic and domain types live in `packages/domain-*` (populated in M11). UI primitives split into `packages/ui-web` and `packages/ui-native` (paths already exist in `tsconfig.base.json`).
- **State and data:** the React Query layer is portable. The Supabase client works in RN with minor configuration. The fuzzy-search worker pool is web-only; RN gets a JS-thread implementation or uses the server-side search path exclusively.
- **Estimated scope:** 3–6 months of dedicated work with one or two senior engineers, depending on feature parity requirements.

**Acceptance.** TBD in a separate planning document when this becomes active work.

**Dependencies.** M11 minimum (shared packages). M3 strongly preferred (server search reduces RN platform-specific work).
**Effort.** Multi-month, separate program.

---

## 4. Cross-cutting initiatives

These run alongside the milestones and are not sequenced in the main flow.

### 4.1 Testing

The codebase currently has no automated tests. This is the highest-risk fact in the entire roadmap; every refactor is implicitly trusted to not regress functionality we can't verify.

**Plan:**
- **Smoke tests first.** Five Playwright tests covering the happy path: load home → browse to product → add to cart → checkout → see confirmation. Block CI on failure.
- **Unit tests for hot paths.** `useCatalogProductSearch`, `useDeliveryContext` (post-M5), the fuzzy-search worker, `normalizeSupabaseProduct`. Vitest is the natural choice given Vite is already the build tool.
- **Visual regression tests** (optional, low priority) on the product card and grid via Playwright screenshots.

**Effort:** 2 sessions to bootstrap, then continuous as part of each milestone.

### 4.2 Documentation

Every milestone produces a `docs/decisions/NNN-<slug>.md` ADR-style note: what we changed, why, what we considered and rejected, and the acceptance result. The roadmap document you're reading is the program-level plan; ADRs are the per-decision record.

### 4.3 Database indexes

The `products` table is queried by `Name_Ar`, `Name_En`, `Code`, `Barcode`, `Category_Name`, `Category_Name_En`, `is_active`, and `Price`. Confirm with Supabase that indexes exist on:
- `is_active` (used in every page query's sort).
- `Category_Name` and `Category_Name_En` (used for category filters when slug-to-name resolution lands).
- A trigram GIN index on `Name_Ar`, `Name_En` for `ilike` performance under load.

This is a one-time DBA task. Track it as part of M3 prep.

---

## 5. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| M3 breaks something invisible (no test coverage) | High | High | Bootstrap smoke tests (§4.1) before starting M3. Non-negotiable. |
| PostGIS not available for M5 server-side geo | Medium | Medium | Fallback to client-side point-in-polygon. Performance is fine for <100 zones. |
| Supabase free-tier rate limits hit during M2 parallelization | Low | Medium | Cap concurrency at 6. Monitor; tune down if 429 responses appear. |
| TypeScript strict mode surfaces a hard bug late in M6 | Medium | Low | Roll out per-flag, per-folder. Stash and revert is cheap. |
| Bundle audit (M7) reveals the MUI dep is load-bearing | Medium | Medium | Plan a separate MUI removal sprint if found. Not the main critical path. |
| User location resolution fails for the bulk of users | Low | High | M5's "saved address fallback" path must be first-class, not an afterthought. |
| Worker pool re-architecture in M3+M4 produces UX regression | Medium | High | Feature-flag the rollout. Compare side-by-side before flipping in production. |

---

## 6. Out of scope (explicit non-goals)

Things this roadmap deliberately does not address:

1. **Rewriting the worker stack.** `catalogSearchWorker.ts` and `fuzzySearch.worker.ts` are well-engineered. They get fed differently in M3, but the internals don't change.
2. **Rewriting `ProductGrid`, `ProductCard`, `FilterSidebar`.** These are production-grade. They get the same data, just plumbed differently.
3. **Migrating off Supabase.** Off-the-shelf Postgres+Auth+Storage is the right call for this scale. No DB migration in this plan.
4. **Migrating off React.** No.
5. **Adding new shopper features (wishlists, prescription uploads, etc.)** unless they're already partially implemented. Feature work is its own roadmap.
6. **Admin UX overhaul.** Admin pages are functional; they're not the bottleneck for the user-facing platform. Defer to a separate program.
7. **i18n beyond AR/EN.** The infrastructure supports more, but the business hasn't asked.

If any of these become priorities, they require an explicit replan and a new estimate.

---

## 7. Dependency graph

```
M1 (provider tree) ──┐
                     ├──> M3 (server pagination) ──> M4 (worker thrash fix)
M2 (parallel fetch) ─┘                                     │
                                                           │
M5 (branch/geo) ─────────────────────────────────────────┐ │
                                                         │ │
M6 (TS strict)  ────────────────────────────────────────┐│ │
                                                        ││ │
M7 (bundle)     ───────────────────────────────────────┐│| │
                                                       ││| │
M8 (images)     ──────────────────────────────────────┐│|│ │
                                                      ││││ │
M9 (observability) ──────────────────────────────────┐│|│| │
                                                     │││││ │
                                                     ▼▼▼▼▼ ▼
                                                     M10 (polish)

M11 (structure)  ──> M12 (React Native, separate program)
```

M1 and M2 are independent and can run in parallel.
M3 depends on M2.
M4 depends on M3.
M5 is independent but easier after M3.
M6–M9 are independent of each other; they can interleave with M5.
M10 requires the foundation milestones (M1–M9) to provide stable UI surfaces.
M11 is best after M6.
M12 is a separate program.

---

## 8. Total effort estimate

| Milestone | Sessions |
|---|--:|
| M1 — Provider tree | 1 |
| M2 — Parallel fetch | 1 |
| M3 — Server pagination | 4–5 |
| M4 — Worker thrash fix | 1 |
| M5 — Branch / geo | 4–5 |
| M6 — TS strict mode | 3–4 |
| M7 — Bundle audit | 2–3 |
| M8 — Image pipeline | 2 |
| M9 — Observability | 2 |
| M10 — UI/UX polish | 4–6 |
| M11 — Structure cleanup | 2–3 |
| Cross-cutting (tests, ADRs) | 2–3 |
| **Total (M1–M11)** | **28–36 sessions** |
| M12 — React Native | separate program (months) |

This is a real, sustained engineering effort. Done well, it produces a platform that holds up under real growth — not a polished demo that breaks under load.

---

## 9. Decision points (open questions)

Before starting, the following questions need answers from product or business. Each is a fork that changes downstream work.

1. **M3 / Pattern choice.** Pattern A (lazy full-catalog for worker search) vs Pattern B (server-side search, smaller worker dataset)? Recommendation: A.
2. **M5 / Geo precision.** PostGIS or client-side? Confirm Supabase project supports `postgis`. If yes, server-side is preferred for accuracy under load.
3. **M5 / Branch selection rule.** When multiple zones cover a point, do we pick by *lowest load* or *nearest distance*? Business call.
4. **M5 / Out-of-zone behavior.** Hard block (no checkout) or soft allow (checkout with "delivery may be delayed" disclaimer)? Business call.
5. **M7 / MUI removal.** If MUI is bundling a heavy footprint for a small surface, is the business OK with the visual change a swap-out implies?
6. **M9 / Observability vendor.** Sentry, LogRocket, Datadog, or self-host? Mainly a cost decision.
7. **M12 / RN timeline.** Is the React Native app a 2026 commitment or a 2027 plan? Affects how much we invest in `packages/` extraction in M11.

These should be resolved before the respective milestone starts. Resolving them upfront reduces in-flight thrash.

---

## 10. How to use this document

- **At kickoff of each milestone**, copy the relevant section into a working doc and refine the acceptance criteria with the latest context.
- **At completion**, file the ADR under `docs/decisions/` and update this roadmap's status table.
- **Each merged PR** references its milestone in the description: `[M3] switch CatalogContext to paginated reads`.
- **If a milestone overruns by >50%**, stop and replan. Don't just keep going.

The roadmap is a living document. It is **not** a contract. As we learn, we update.
