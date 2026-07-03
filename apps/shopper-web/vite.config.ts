import { defineConfig } from "vite";
import path from "path";
import { pathToFileURL } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

function sitemapBuildPlugin() {
  let outDir = path.resolve(__dirname, "dist");

  return {
    name: "sitemap-build-plugin",
    apply: "build" as const,
    configResolved(config: { root: string; build: { outDir: string } }) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const helperPath = pathToFileURL(
        path.resolve(__dirname, "./scripts/generate-sitemaps.mjs"),
      ).href;
      const { generateSitemapFiles } = (await import(helperPath)) as {
        generateSitemapFiles: (outputDir?: string) => Promise<unknown>;
      };
      await generateSitemapFiles(outDir);
    },
  };
}

export default defineConfig({
  // Serve root assets/web/ as static public files (favicons, PWA icons, manifest)
  publicDir: path.resolve(__dirname, "../../assets/web"),
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    sitemapBuildPlugin(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      "@": path.resolve(__dirname, "./src"),
      // Alias @assets to the root shared assets folder
      "@assets": path.resolve(__dirname, "../../assets"),
      "@pharmacy/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
      "@pharmacy/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "@pharmacy/contracts/": path.resolve(__dirname, "../../packages/contracts/src/"),
      "@pharmacy/api-client": path.resolve(__dirname, "../../packages/api-client/src/index.ts"),
      "@pharmacy/domain-core": path.resolve(__dirname, "../../packages/domain-core/src/index.ts"),
      "@pharmacy/domain-search": path.resolve(__dirname, "../../packages/domain-search/src/index.ts"),
      "@pharmacy/fuzzy-search": path.resolve(__dirname, "../../packages/fuzzy-search/src/index.ts"),
      "@pharmacy/domain-catalog": path.resolve(__dirname, "../../packages/domain-catalog/src/index.ts"),
      "@pharmacy/domain-location": path.resolve(__dirname, "../../packages/domain-location/src/index.ts"),
      "@pharmacy/domain-cart": path.resolve(__dirname, "../../packages/domain-cart/src/index.ts"),
      "@pharmacy/domain-checkout": path.resolve(__dirname, "../../packages/domain-checkout/src/index.ts"),
      "@pharmacy/domain-orders": path.resolve(__dirname, "../../packages/domain-orders/src/index.ts"),
      "@pharmacy/domain-prescriptions": path.resolve(__dirname, "../../packages/domain-prescriptions/src/index.ts"),
      "@pharmacy/domain-account": path.resolve(__dirname, "../../packages/domain-account/src/index.ts"),
      "@pharmacy/domain-ops": path.resolve(__dirname, "../../packages/domain-ops/src/index.ts"),
      "@pharmacy/domain-courier": path.resolve(__dirname, "../../packages/domain-courier/src/index.ts"),
      "@pharmacy/ui-web": path.resolve(__dirname, "../../packages/ui-web/src/index.ts"),
      "@pharmacy/ui-native": path.resolve(__dirname, "../../packages/ui-native/src/index.ts"),
      "@pharmacy/design-tokens": path.resolve(__dirname, "../../packages/design-tokens/src/index.ts"),
    },
  },
  server: {
    fs: {
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "../../"),
        path.resolve(__dirname, "../../packages"),
        path.resolve(__dirname, "../../assets"),
      ],
    },
  },
  optimizeDeps: {
    include: [
      "@pharmacy/contracts",
      "@pharmacy/api-client"
    ]
  },
  build: {
    // M7: Budget — warn at 600 KB; target initial shell ≤ 250 KB gzipped.
    // All routes are code-split via lazy() in App.tsx so the initial chunk
    // contains only react-core, router, context providers, and the Layout shell.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          // ── React core ── must resolve before any React-importing packages
          // "react" matches: react, react-dom, react-router, react-hook-form …
          // so we gate it narrowly — only the React runtime packages.
          if (
            /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id)
          ) {
            return "react-core";
          }
          // react-refresh is dev-only; keep with react-core in builds that include it
          if (id.includes("react-refresh")) return "react-core";

          // ── Router ──
          if (
            id.includes("react-router") ||
            id.includes("@remix-run") ||
            id.includes("/history/")
          ) {
            return "router";
          }

          // ── Animation ──
          // BUG FIX (M7): the previous `id.includes("motion")` incorrectly
          // matched `@emotion/react` and `@emotion/styled` (emotion ⊃ motion).
          // Use path-segment matching to target only the animation packages.
          if (
            id.includes("framer-motion") ||
            /node_modules[\\/]motion[\\/]/.test(id)
          ) {
            return "motion";
          }

          // ── CSS-in-JS (emotion — peer dep of MUI) ──
          // Must come before the @mui check so emotion lands in the MUI chunk,
          // not scattered across consumer chunks.
          if (id.includes("@emotion")) return "mui";

          // ── UI component libraries ──
          if (id.includes("@radix-ui")) return "ui-libs";
          if (id.includes("@mui")) return "mui";

          // ── Icons ──
          // lucide-react tree-shakes well per named import; heroicons is
          // admin-only (lazy route) so it will only appear in admin chunk.
          if (
            id.includes("lucide-react") ||
            id.includes("@heroicons") ||
            /node_modules[\\/]lucide[\\/]/.test(id)
          ) {
            return "icons";
          }

          // ── Charts ── admin-only (DashboardTrendChart, ui/chart) ──
          // These are always behind a lazy() boundary so they don't touch the
          // initial shell. Grouping them avoids duplicating recharts in every
          // admin sub-chunk.
          if (
            id.includes("recharts") ||
            id.includes("/d3-") ||
            id.includes("victory")
          ) {
            return "charts";
          }

          // ── Utilities ── small, standalone, no React dep ──
          if (
            id.includes("lodash") ||
            id.includes("date-fns") ||
            id.includes("dayjs") ||
            id.includes("/clsx/") ||
            id.includes("tailwind-merge") ||
            id.includes("class-variance-authority")
          ) {
            return "utils";
          }

          // ── Data layer ──
          if (
            id.includes("@supabase") ||
            id.includes("@tanstack") ||
            id.includes("/swr/")
          ) {
            return "data";
          }

          // ── State management ──
          if (id.includes("zustand") || id.includes("jotai")) return "state";

          // ── Forms ──
          if (
            id.includes("react-hook-form") ||
            id.includes("/zod/") ||
            id.includes("@hookform")
          ) {
            return "forms";
          }

          // ── Large optional libs ──
          if (id.includes("pdf-lib")) return "pdf";
          if (id.includes("xlsx")) return "excel";
          if (id.includes("/jsqr/")) return "qr";
          if (id.includes("leaflet") || id.includes("react-leaflet")) return "maps";

          // Everything else rides with its consuming chunk — avoids splitting
          // tiny transitive deps into their own HTTP requests.
          return undefined;
        },
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
