/**
 * CheckoutErrorFallback — cart-preserving recovery screen for the checkout
 * Error Boundary.
 *
 * Design contract:
 *   - Never white-screen. Always render, even if kit/theme modules have thrown.
 *   - Show the user their cart is safe (items are in persistent Zustand store).
 *   - Offer "retry" (reset boundary) and "go back" (navigate away) so they are
 *     never stuck.
 *   - Display cart item count so users trust their selection is preserved.
 *   - Attach the error code to the crash report displayed in DEV only.
 *
 * Zero-dependency on kit/theme for the same reason ErrorBoundary.tsx avoids
 * them — this file may render when the module graph itself is broken.
 * Colors are hardcoded hex literals matching the design system tokens but
 * without importing them (same pattern as ErrorBoundary.tsx, documented there).
 */

import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView } from "react-native";
import { useCartStore, selectItemCount } from "@/stores/cart";

interface CheckoutErrorFallbackProps {
  error:    Error;
  onReset:  () => void;
  onGoBack: () => void;
}

export function CheckoutErrorFallback({
  error,
  onReset,
  onGoBack,
}: CheckoutErrorFallbackProps) {
  // Zustand is accessed outside of React render so it always works even if
  // the React subtree is broken. selectItemCount is a stable selector.
  const itemCount = useCartStore(selectItemCount);

  const handleRetry = useCallback(() => {
    onReset();
  }, [onReset]);

  return (
    <ScrollView
      contentContainerStyle={s.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Icon */}
      <View style={s.iconWrap}>
        <Text style={s.iconEmoji}>🛒</Text>
      </View>

      {/* Heading */}
      <Text style={s.title}>{"حدث خطأ في صفحة الدفع"}</Text>
      <Text style={s.titleEn}>{"Checkout encountered an error"}</Text>

      {/* Cart safety assurance */}
      <View style={s.cartSafe}>
        <Text style={s.cartSafeIcon}>✓</Text>
        <View style={s.cartSafeText}>
          <Text style={s.cartSafeTitle}>
            {itemCount > 0
              ? `سلة التسوق محفوظة — ${itemCount} ${itemCount === 1 ? "منتج" : "منتجات"}`
              : "سلة التسوق محفوظة"}
          </Text>
          <Text style={s.cartSafeSub}>
            {"Your cart is safe. All items are preserved."}
          </Text>
        </View>
      </View>

      {/* Body */}
      <Text style={s.body}>
        {
          "يمكنك إعادة المحاولة أو العودة للمتابعة لاحقاً.\nYou can retry the checkout or go back and try again later."
        }
      </Text>

      {/* Error detail — DEV only */}
      {__DEV__ && (
        <View style={s.devBox}>
          <Text style={s.devLabel}>Error (dev only):</Text>
          <Text style={s.devText} selectable>
            {error.message}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={s.actions}>
        <Pressable
          onPress={handleRetry}
          style={({ pressed }) => [s.btnPrimary, pressed && s.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="إعادة المحاولة"
        >
          <Text style={s.btnPrimaryText}>{"↺  إعادة المحاولة / Retry"}</Text>
        </Pressable>

        <Pressable
          onPress={onGoBack}
          style={({ pressed }) => [s.btnSecondary, pressed && s.btnPressed]}
          accessibilityRole="button"
          accessibilityLabel="العودة"
        >
          <Text style={s.btnSecondaryText}>{"← العودة / Go Back"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flexGrow:          1,
    backgroundColor:   "#F4F7FA",
    alignItems:        "center",
    justifyContent:    "center",
    padding:           28,
    gap:               14,
  },
  iconWrap: {
    width:           80,
    height:          80,
    borderRadius:    40,
    backgroundColor: "#E6F4F3",
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    4,
  },
  iconEmoji: {
    fontSize: 38,
  },
  title: {
    fontSize:   18,
    fontWeight: "700",
    color:      "#0F1724",
    textAlign:  "center",
    lineHeight: 26,
  },
  titleEn: {
    fontSize:   14,
    fontWeight: "600",
    color:      "#334155",
    textAlign:  "center",
    lineHeight: 22,
    marginTop:  -6,
  },
  cartSafe: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    gap:               12,
    backgroundColor:   "#ECFDF5",   // green-50
    borderWidth:       1,
    borderColor:       "#6EE7B7",   // green-300
    borderRadius:      14,
    paddingHorizontal: 16,
    paddingVertical:   14,
    alignSelf:         "stretch",
  },
  cartSafeIcon: {
    fontSize:   18,
    color:      "#059669",          // green-600
    fontWeight: "700",
    marginTop:  1,
  },
  cartSafeText: {
    flex: 1,
    gap:  3,
  },
  cartSafeTitle: {
    fontSize:   13,
    fontWeight: "700",
    color:      "#065F46",          // green-900
    lineHeight: 20,
  },
  cartSafeSub: {
    fontSize:   11,
    color:      "#047857",          // green-700
    lineHeight: 17,
  },
  body: {
    fontSize:   12,
    color:      "#64748B",
    textAlign:  "center",
    lineHeight: 20,
    maxWidth:   320,
  },
  devBox: {
    alignSelf:         "stretch",
    padding:           12,
    borderRadius:      12,
    backgroundColor:   "#F8FAFC",
    borderWidth:       1,
    borderColor:       "#E2E8F0",
    marginTop:         4,
  },
  devLabel: {
    fontSize:     10,
    fontWeight:   "700",
    color:        "#64748B",
    marginBottom: 4,
  },
  devText: {
    fontSize: 11,
    color:    "#334155",
  },
  actions: {
    alignSelf: "stretch",
    gap:       10,
    marginTop: 4,
  },
  btnPrimary: {
    backgroundColor:   "#0E7E74",
    paddingHorizontal: 22,
    paddingVertical:   14,
    borderRadius:      14,
    alignItems:        "center",
  },
  btnSecondary: {
    backgroundColor:   "#F1F5F9",
    paddingHorizontal: 22,
    paddingVertical:   14,
    borderRadius:      14,
    alignItems:        "center",
    borderWidth:       1,
    borderColor:       "#CBD5E1",
  },
  btnPressed: {
    opacity:   0.82,
    transform: [{ scale: 0.98 }],
  },
  btnPrimaryText: {
    fontSize:   14,
    fontWeight: "700",
    color:      "#fff",
  },
  btnSecondaryText: {
    fontSize:   14,
    fontWeight: "600",
    color:      "#334155",
  },
});
