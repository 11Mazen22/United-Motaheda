/**
 * ErrorBoundary — production-grade React error boundary.
 *
 * Catches render-phase exceptions in its subtree and displays a calm
 * Arabic-first recovery screen instead of a white crash. Used at:
 *  - app root (catches anything below QueryClientProvider)
 *  - any screen that wants its own isolated recovery surface
 *
 * Pairs with the runtime fallback patterns we've used per-feature
 * (e.g. CategoryStatsDock's error state). This boundary handles the
 * RENDER-phase failure mode — not network errors, which features
 * handle locally with try/catch.
 *
 * IMPORTANT — zero-dependency rule for DefaultFallback:
 *
 *   This file intentionally imports NOTHING from the app's own modules
 *   except crashReporter (which is itself zero-dependency). Specifically:
 *
 *   1. NO fontFamily — Cairo fonts may not be registered when this boundary
 *      fires on early boot. An unregistered fontFamily makes Text invisible
 *      on Android; the OS system font is always available.
 *
 *   2. NO theme import — @pharmacy/design-tokens resolves through tokens.ts at module
 *      load time. If the theme module itself throws (broken OTA asset, native
 *      module mismatch), the ErrorBoundary must still render. Keeping styles
 *      as hardcoded hex literals is the only way to guarantee this.
 *
 *   DO NOT add `import { theme } from "@pharmacy/design-tokens"` here or replace
 *   these hex values with token references. The styles below are intentionally
 *   hardcoded and must remain so.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { captureError } from "@/lib/crashReporter";
import { flexRow, isRtl } from "@/utils/layout";

interface Props {
  children: React.ReactNode;
  /**
   * Optional callback when an error is caught. If omitted, the error is
   * reported through captureError() — the provider-agnostic crash shim.
   */
  onError?: (error: Error, info: React.ErrorInfo) => void;
  /** Optional override for the recovery UI. */
  fallback?: (reset: () => void, error: Error) => React.ReactNode;
  /** Identifies which surface threw — attached to the crash report. */
  surface?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error("[ErrorBoundary] caught:", error, info);
    }
    if (this.props.onError) {
      this.props.onError(error, info);
    } else {
      captureError(error, {
        surface:         this.props.surface ?? "root",
        component_stack: info.componentStack ?? null,
      });
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.reset, this.state.error);
      }
      return <DefaultFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

/**
 * DefaultFallback intentionally uses NO custom fontFamily anywhere. Cairo
 * may not be registered yet when this renders (early boot crash). System
 * font is always available and produces visible text on all platforms.
 */
function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <View style={styles.container}>
      {/* Warning emoji — zero dependencies, always renders */}
      <Text style={styles.icon}>{"⚠️"}</Text>

      {/* Hardcoded bilingual strings — no external dependencies at all so this
          renders even before any provider, font, or native module is ready. */}
      <Text style={styles.title}>{"حدث خطأ غير متوقع\nSomething went wrong"}</Text>
      <Text style={styles.body}>
        {"أعد تشغيل التطبيق أو اضغط على إعادة المحاولة\nPlease restart the app or tap Retry."}
      </Text>

      <View style={styles.devBox}>
        <Text style={styles.devLabel}>Error:</Text>
        <Text style={styles.devText} selectable>
          {error.message}
        </Text>
      </View>

      <Pressable onPress={onReset} style={styles.btn}>
        <Text style={styles.btnText}>{"↺  إعادة المحاولة / Retry"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F7FA",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  icon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    // No fontFamily — always uses system font so text is visible even when
    // Cairo hasn't loaded yet.
    fontSize: 17,
    fontWeight: "700",
    color: "#0F1724",
    textAlign: "center",
    lineHeight: 26,
  },
  body: {
    fontSize: 13,
    color: "#64748B",           // slate[500] — hardcoded per zero-dependency rule
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  devBox: {
    alignSelf: "stretch",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F8FAFC", // slate[50]  — hardcoded per zero-dependency rule
    borderWidth: 1,
    borderColor: "#E2E8F0",     // slate[200] — hardcoded per zero-dependency rule
    marginTop: 8,
  },
  devLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",           // slate[500] — hardcoded per zero-dependency rule
    marginBottom: 4,
  },
  devText: {
    fontSize: 11,
    color: "#334155",           // slate[700] — hardcoded per zero-dependency rule
  },
  btn: {
    flexDirection: flexRow(isRtl()),
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0891B2", // brand[600] — hardcoded per zero-dependency rule
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 12,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
