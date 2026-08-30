---
kind: frontend_style
name: 'United Pharmacy Design System: Tailwind CSS v4 + NativeWind + Semantic Tokens'
category: frontend_style
scope:
    - '**'
source_files:
    - packages/design-tokens/src/semantic.ts
    - packages/design-tokens/src/index.ts
    - packages/design-tokens/src/legacy.ts
    - packages/design-tokens/src/luxury.ts
    - apps/shopper-web/src/styles/theme.css
    - apps/shopper-web/src/styles/tailwind.css
    - apps/shopper-web/vite.config.ts
    - apps/shopper-native/tailwind.config.js
    - apps/shopper-native/global.css
    - apps/shopper-native/babel.config.js
    - apps/shopper-native/metro.config.js
    - apps/admin/tailwind.config.js
    - postcss.config.mjs
    - packages/ui-native/src/index.ts
    - packages/ui-native/package.json
---

## What system/approach is used

The monorepo implements a **design-system-first** frontend style strategy centered on three layers:

1. **Platform-neutral semantic tokens** in `packages/design-tokens` — TypeScript modules (`semantic.ts`, `legacy.ts`, `luxury.ts`) that define light/dark palettes, typography, spacing, radii, shadows, motion, and layout tokens as typed JS objects (e.g. `SemanticColors`, `lightTheme`, `darkTheme`, `resolveTheme()`). This package has no CSS dependency and is consumed by both web and native apps.
2. **Web styling via Tailwind CSS v4** — The shopper-web app uses `@tailwindcss/vite` (see `vite.config.ts` importing `tailwindcss from "@tailwindcss/vite"`) with a single source declaration `@import 'tailwindcss' source(none); @source '../**/*.{js,ts,jsx,tsx}';` in `src/styles/tailwind.css`. Theme variables live in `src/styles/theme.css`, which declares CSS custom properties under `:root` and `.dark`, then maps them into Tailwind's theme via `@theme inline { --color-*: var(--*) }`. A separate admin app at `apps/admin/` uses its own Tailwind config with a `pharmacy` color namespace and Cairo font.
3. **Native styling via NativeWind + Tailwind** — The Expo shopper-native app (`apps/shopper-native/`) enables Tailwind through `nativewind/preset` in `tailwind.config.js`, sets `darkMode: "class"` (with an explicit comment explaining why class-based dark mode is required to avoid NativeWind injecting `media` into `<head>`), and compiles JSX with the `nativewind/babel` plugin in `babel.config.js`. Global styles are declared in `global.css` using `@tailwind base/components/utilities`.

A shared UI layer lives in `packages/ui-native` (React Native primitives, layout, overlays, customer kit) and `packages/ui-web` (currently empty scaffold), both depending on `@pharmacy/design-tokens`.

## Key files and packages

- `packages/design-tokens/src/semantic.ts` — authoritative light/dark semantic color contracts, typography, spacing, radii, shadows, motion, layout tokens; exports `lightTheme`, `darkTheme`, `resolveTheme(name)`.
- `packages/design-tokens/src/index.ts` — re-exports semantic, legacy, luxury token sets and provides backward-compatible `designTokens` default.
- `apps/shopper-web/src/styles/theme.css` — CSS custom properties defining brand palette, semantic tokens (`--background`, `--primary`, `--card`, etc.), admin panel tokens, and `@theme inline` mappings into Tailwind v4.
- `apps/shopper-web/src/styles/tailwind.css` — Tailwind v4 entry with `@import 'tailwindcss' source(none)` and `@source` directive for content scanning.
- `apps/shopper-web/vite.config.ts` — registers `@tailwindcss/vite` plugin; also references `tw-animate-css` for animation utilities.
- `apps/shopper-native/tailwind.config.js` — NativeWind preset, `darkMode: "class"`, brand color scale, `System` font family.
- `apps/shopper-native/global.css` — Tailwind directives and root layout rules.
- `apps/admin/tailwind.config.js` — Admin-specific Tailwind config with `brand` and `pharmacy` color namespaces, Cairo font.
- `postcss.config.mjs` — Root PostCSS config (empty; comments note Tailwind v4 via Vite handles plugins automatically).
- `packages/ui-native/src/index.ts` — Exposes `theme`, `kit`, primitives, layout, overlays, and `CustomerUI` namespace.
- `packages/ui-native/package.json` — Declares peer deps on React Native ecosystem and depends on `@pharmacy/design-tokens`.

## Architecture and conventions

- **Token-driven theming**: All colors flow from `@pharmacy/design-tokens` semantic definitions rather than hard-coded hex values in components. The `SemanticColors` interface enforces a consistent shape across brand, canvas, text, status, delivery, chart, pharmacy, and border categories.
- **Dual-theme support**: Both light and dark themes are defined side-by-side in `semantic.ts` and exposed via `resolveTheme()`. Web uses a `.dark` CSS class toggle; NativeWind mirrors this with `darkMode: "class"`.
- **Tailwind v4 `@theme inline` mapping**: Instead of a traditional `tailwind.config.js` color map, shopper-web defines CSS variables and maps them into Tailwind's theme via `@theme inline { --color-*: var(--*) }`, keeping design decisions centralized in `theme.css`.
- **Admin vs shopper separation**: The admin app maintains its own Tailwind config with a distinct `pharmacy` color namespace (`primary`, `ink`, `canvas`, `surface`, `line`) and Cairo font, while the shopper web app uses a teal brand palette (`#2CBEB5` / `#24B8B5`).
- **Responsive strategy**: Uses Tailwind's built-in responsive breakpoints plus CSS `clamp()` for fluid typography and spacing (e.g. `clamp(1rem, 2vw, 1.75rem)` gutters, `clamp(2rem, 5vw, 4rem)` headings). Arabic locale gets dedicated overrides in `html[lang="ar"]` blocks adjusting line-height, letter-spacing, and font-family to Cairo.
- **Animation library**: `tw-animate-css` is imported alongside Tailwind for prebuilt keyframes; custom animations (float, shimmer, product-card-in, slide-up, pulse-ring, gradient-x, count-up) are defined in `theme.css`.
- **Shared component primitives**: `packages/ui-native` exposes a `kit` and primitive components (layout, overlays, primitives) that consume the design tokens, providing a reusable building block for both customer and courier experiences.

## Conventions and constraints

- **Dark mode must be class-based on native**: The shopper-native `tailwind.config.js` explicitly sets `darkMode: "class"` with a comment stating that NativeWind's default `media` mode injects `media` into `<head>` on web, which triggers an uncaught error in `color-scheme.js` that kills the entire React tree.
- **Content scanning via `@source`**: Shopper-web uses Tailwind v4's `@source '../**/*.{js,ts,jsx,tsx}'` directive instead of a `content` array in `tailwind.config.js`, so all source files under `src/` are scanned automatically.
- **Arabic typography overrides**: Any Arabic text must use the `Cairo` font family and adjusted line-height/letter-spacing; `theme.css` contains extensive `html[lang="ar"]` and `html[dir="rtl"]` selectors that override tracking, line-height, and font-weight for headings and large text.
- **Brand color discipline**: Colors are referenced through semantic token names (`--background`, `--primary`, `--card`, `--border`, etc.) or Tailwind utility classes derived from them, not raw hex literals in components. The `@pharmacy/design-tokens` package is the single source of truth for color values.
- **Admin panel isolation**: The admin app keeps its own color namespace (`pharmacy.*`, `admin-*` CSS variables) to prevent visual bleed between the shopper-facing teal brand and the internal admin dashboard.
- **Motion tokens are centralized**: Duration and easing values live in `motion` tokens in `semantic.ts` (`fast: 150ms`, `normal: 250ms`, `slow: 350ms`; standard, decelerate, accelerate, easeInOut curves) and are mirrored as CSS custom properties (`--duration-*`, `--ease-*`) in `theme.css`.
- **Touch target minimum**: Both the design tokens (`layout.touchTarget: 48`) and the web theme (`--touch-min: 2.75rem`) enforce a 48px minimum touch target size for accessibility.