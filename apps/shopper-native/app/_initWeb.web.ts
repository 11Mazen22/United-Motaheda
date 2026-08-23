/**
 * Web-only runtime bootstrap.
 *
 * This file is selected only for Expo web. Keeping it in a .web.ts module
 * prevents the native React Native renderer from entering the web bundle.
 */

const WINDOW = typeof globalThis !== "undefined" ? (globalThis as unknown as { window?: Window }).window : undefined;

const IS_BROWSER = typeof WINDOW !== "undefined" && typeof WINDOW.addEventListener === "function";

if (IS_BROWSER) {
  try {
    // @ts-expect-error - react-native-web types not declared
    const rnWebModule = await import("react-native-web");
    const rnWeb = rnWebModule as { StyleSheet?: { setFlag?: (key: string, value: string) => void } };
    const ss = rnWeb?.StyleSheet;
    if (ss && typeof ss.setFlag === "function") {
      ss.setFlag("darkMode", "class");
    }
  } catch {
    // Safe on versions without the flag API.
  }

  WINDOW.addEventListener("unhandledrejection", (event: Event & { reason: { message?: string } | null }) => {
    const msg = String(event.reason?.message ?? event.reason ?? "");
    const suppress = [
      "timeout",
      "Network request failed",
      "Cannot manually set color scheme",
    ];
    if (suppress.some((value) => msg.includes(value))) event.preventDefault();
  });

  const suppressedPatterns = [
    "You are importing createRoot from \"react-dom\"",
    "Listening to push token changes is not yet fully supported on web",
    "Cannot manually set color scheme",
  ];

  const shouldSuppress = (args: unknown[]) =>
    args.length > 0 &&
    typeof args[0] === "string" &&
    suppressedPatterns.some((pattern) => String(args[0]).includes(pattern));

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    if (!shouldSuppress(args)) origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    if (!shouldSuppress(args)) origWarn(...args);
  };

  try {
    const ReactDOMClientModule = await import("react-dom/client");
    const ReactDOMClient = ReactDOMClientModule as { createRoot?: (el: Element) => { render: (node: unknown) => void } };

    const ReactDOMModule = await import("react-dom");
    const ReactDOM = ReactDOMModule as Record<string, unknown>;

    if (typeof ReactDOMClient?.createRoot === "function") {
      const createRoot = ReactDOMClient.createRoot;
      ReactDOM.render = function (
        element: unknown,
        container: Element & { __reactRoot?: ReturnType<typeof createRoot> },
        callback?: () => void,
      ) {
        if (!container.__reactRoot) container.__reactRoot = createRoot(container);
        container.__reactRoot.render(element);
        callback?.();
      };
    }
  } catch {
    // Nothing to bridge when the ReactDOM client API is unavailable.
  }
}

export default function WebInit(): null {
  return null;
}
