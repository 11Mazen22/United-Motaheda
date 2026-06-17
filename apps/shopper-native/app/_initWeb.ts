/**
 * _initWeb.ts — Web-only runtime shims executed before any component renders.
 *
 * Imported at the very top of app/_layout.tsx so it runs before any other
 * module-level side-effects reach the DOM.
 *
 * Three problems solved here:
 *
 * 1. react-native-web StyleSheet dark-mode strategy
 *    RNW defaults to 'media' (system CSS media query).  Calling
 *    StyleSheet.setFlag('darkMode', 'class') switches it to class-based
 *    control, which is required before anything calls Appearance.setColorScheme.
 *    Must run synchronously, as close to module load as possible.
 *
 * 2. ReactDOM.render → createRoot bridge
 *    Third-party libs built for React 17 sometimes call ReactDOM.render.
 *    We route those calls through createRoot so React 18's concurrent mode
 *    works correctly and avoids the "passed to ReactDOM.render" warning.
 *
 * 3. Known un-fixable library warnings
 *    Some warnings originate deep inside react-native-web or expo libraries
 *    that we cannot patch at source.  We selectively suppress them here so
 *    the console stays clean for real errors.
 */

// React Native polyfills `global.window = global`, so `typeof window !== "undefined"`
// is true on Android/iOS but `window.addEventListener` is not a function there.
// We guard every browser-only branch with this stricter check.
const WINDOW = typeof globalThis !== "undefined" ? (globalThis as any).window : undefined;
const IS_BROWSER = typeof WINDOW !== "undefined" && typeof WINDOW.addEventListener === "function";

// ─── 1. Dark-mode strategy — must run first, synchronously ───────────────────

if (IS_BROWSER) {
  // Use require() inside the web branch so the native bundler never touches
  // react-native during an Android/iOS build.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require("react-native") as typeof import("react-native");
    const ss = (rn as any).StyleSheet;
    if (ss && typeof ss.setFlag === "function") {
      ss.setFlag("darkMode", "class");
    }
  } catch {
    // react-native-web version does not support setFlag — safe to ignore.
  }
}

// ─── 2. Unhandled-rejection safety net ───────────────────────────────────────
// Async throws that escape component trees (e.g. font-load timeouts, Supabase
// channel drops) surface as PromiseRejectionEvents on web. Without a handler
// the browser logs an "Uncaught (in promise)" error that can kill HMR and
// confuse Sentry. We suppress the known non-fatal ones; everything else still
// surfaces in the console for real debugging.

if (IS_BROWSER) {
  WINDOW.addEventListener("unhandledrejection", (event: any) => {
    const msg = String((event.reason as { message?: string } | null)?.message ?? event.reason ?? "");
    const SUPPRESS = [
      "timeout",            // expo-font / Supabase channel reconnect timeouts
      "Network request failed", // offline font fetch
      "Cannot manually set color scheme", // belt-and-suspenders: fixed via tailwind darkMode:class
    ];
    if (SUPPRESS.some((s) => msg.includes(s))) {
      event.preventDefault();
    }
  });
}

// ─── 3. Console noise suppressor ─────────────────────────────────────────────

if (IS_BROWSER) {
  // Messages that come from library internals we cannot patch at source.
  // Suppressed only on web; native builds never reach this code.
  const SUPPRESSED_PATTERNS: string[] = [
    // React 18: react-native-web still imports createRoot from the legacy path.
    "You are importing createRoot from \"react-dom\"",
    // expo-notifications: push token listener is a no-op on web.
    "Listening to push token changes is not yet fully supported on web",
    // react-native-web: harmless initialisation warning when setFlag runs late.
    "Cannot manually set color scheme",
  ];

  const shouldSuppress = (args: unknown[]): boolean => {
    if (!args.length || typeof args[0] !== "string") return false;
    return SUPPRESSED_PATTERNS.some((p) => (args[0] as string).includes(p));
  };

  const origError = console.error.bind(console);
  const origWarn  = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    if (!shouldSuppress(args)) origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    if (!shouldSuppress(args)) origWarn(...args);
  };
}

// ─── 4. ReactDOM.render → createRoot bridge ───────────────────────────────────
// Note: on web, Metro already aliases 'react-dom' to reactDomR19Web.js which
// injects render() backed by createRoot. This block is a belt-and-suspenders
// safety net for any edge-case that escapes the Metro alias (e.g. pre-bundled
// third-party chunks that embed their own react-dom copy).

if (IS_BROWSER) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ReactDOMClient = require("react-dom/client") as {
      createRoot: (el: Element) => { render: (node: unknown) => void };
    };

    if (ReactDOMClient && typeof ReactDOMClient.createRoot === "function") {
      const createRoot = ReactDOMClient.createRoot;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ReactDOM = require("react-dom") as Record<string, unknown>;

      // React 19 removed render() — inject unconditionally regardless of
      // whether it existed previously (unlike React 18 where it was defined).
      (ReactDOM as any).render = function (
        element: unknown,
        container: Element & { __reactRoot?: ReturnType<typeof createRoot> },
        callback?: () => void,
      ) {
        if (!container.__reactRoot) {
          container.__reactRoot = createRoot(container);
        }
        container.__reactRoot.render(element);
        callback?.();
      };
    }
  } catch {
    // react-dom/client unavailable — nothing to do.
  }
}

// ─── Module export ────────────────────────────────────────────────────────────

// Expo Router requires every file in app/ to export a default React component.
// This file is pure side-effects, so we export a no-op component.
export default function WebShims(): null {
  return null;
}
