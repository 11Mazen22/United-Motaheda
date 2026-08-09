/**
 * CouponInput — animated coupon code entry for the checkout review step.
 *
 * States:
 *   idle       — text input + Apply button
 *   loading    — spinner inside Apply button, input locked
 *   success    — green success banner with discount amount + Remove button
 *   error      — red error message below input + input editable again
 *
 * Animations:
 *   - Success banner: FadeInDown spring entrance + scale pulse on checkmark
 *   - Error message: FadeInDown with slight horizontal shake via translateX
 *   - Remove action: FadeIn
 *
 * Accessibility:
 *   - Apply button has accessibilityRole="button" + accessibilityState.busy
 *   - Input has accessibilityLabel
 *   - Success/error states set accessibilityLiveRegion="polite"
 *
 * RTL: all layout uses isRtl() / flexRow() / textAlignStart() helpers,
 * matching every other checkout component.
 */

import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { Text as UIText } from "@pharmacy/ui-native";
import { kit } from "@pharmacy/ui-native";
import { theme } from "@pharmacy/design-tokens";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import { formatPrice } from "@/utils/format";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

interface CouponInputProps {
  value:            string;
  onChangeText:     (v: string) => void;
  onApply:          () => void;
  onRemove:         () => void;
  loading:          boolean;
  applied:          boolean;
  discountAmount:   number;
  error:            string | null;
  /** Code that was successfully applied (displayed in the success banner). */
  appliedCode:      string;
}

export const CouponInput = React.memo(function CouponInput({
  value,
  onChangeText,
  onApply,
  onRemove,
  loading,
  applied,
  discountAmount,
  error,
  appliedCode,
}: CouponInputProps) {
  const { t } = useTranslation();

  // ── Checkmark scale pulse on success ─────────────────────────────────────
  const checkScale = useSharedValue(1);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  useEffect(() => {
    if (applied) {
      checkScale.value = withSequence(
        withTiming(1.35, { duration: 180, easing: Easing.out(Easing.back(2)) }),
        withTiming(1,    { duration: 200, easing: Easing.out(Easing.quad)   }),
      );
    }
  }, [applied, checkScale]);

  // ── Error shake ───────────────────────────────────────────────────────────
  const shakeX = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    if (error) {
      shakeX.value = withSequence(
        withTiming(-6,  { duration: 55 }),
        withTiming( 6,  { duration: 55 }),
        withTiming(-4,  { duration: 50 }),
        withTiming( 4,  { duration: 50 }),
        withTiming( 0,  { duration: 45 }),
      );
    }
  }, [error, shakeX]);

  const handleApply = useCallback(() => {
    if (!loading && !applied) onApply();
  }, [loading, applied, onApply]);

  // ── Success state ─────────────────────────────────────────────────────────
  if (applied) {
    return (
      <Animated.View
        entering={FadeInDown.duration(320).springify().damping(16)}
        style={s.successBanner}
        accessibilityLiveRegion="polite"
      >
        <View style={s.successLeft}>
          <Animated.View style={[s.successIconWrap, checkStyle]}>
            <Ionicons name="checkmark-circle" size={22} color={kit.color.success} />
          </Animated.View>
          <View style={s.successTextWrap}>
            <UIText variant="body-sm" weight="bold" style={s.successTitle}>
              {t("checkout.promoApplied")} — {appliedCode}
            </UIText>
            <UIText variant="caption" style={s.successSaving}>
              {t("checkout.discountRow")} {formatPrice(discountAmount)}
            </UIText>
          </View>
        </View>
        <Animated.View entering={FadeIn.delay(120).duration(220)}>
          <Pressable
            onPress={onRemove}
            style={s.removeBtn}
            accessibilityRole="button"
            accessibilityLabel={t("checkout.removeCoupon", "إزالة")}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={kit.color.inkFaint} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    );
  }

  // ── Input + error state ───────────────────────────────────────────────────
  return (
    <View>
      <View style={[s.inputRow, { flexDirection: flexRow(IS_RTL) }]}>
        {/* Input */}
        <View style={[s.inputWrap, error && s.inputWrapError]}>
          <Ionicons
            name="pricetag-outline"
            size={14}
            color={error ? kit.color.danger : kit.color.inkFaint}
            style={s.inputIcon}
          />
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={t("checkout.promoPlaceholder")}
            placeholderTextColor={kit.color.inkFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            editable={!loading}
            onSubmitEditing={handleApply}
            returnKeyType="done"
            accessibilityLabel={t("checkout.promoPlaceholder")}
            style={[s.input, { textAlign: TEXT_START }]}
          />
        </View>

        {/* Apply button */}
        <Pressable
          onPress={handleApply}
          disabled={loading || !value.trim()}
          style={({ pressed }) => [
            s.applyBtn,
            (loading || !value.trim()) && s.applyBtnDisabled,
            pressed && !loading && value.trim() && s.applyBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("checkout.promoApply")}
          accessibilityState={{ busy: loading, disabled: loading || !value.trim() }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <UIText style={s.applyBtnText}>{t("checkout.promoApply")}</UIText>
          )}
        </Pressable>
      </View>

      {/* Error message */}
      {error && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={shakeStyle}
          accessibilityLiveRegion="polite"
        >
          <View style={s.errorRow}>
            <Ionicons name="alert-circle" size={13} color={kit.color.danger} />
            <UIText
              variant="caption"
              style={[s.errorText, { textAlign: TEXT_START }]}
            >
              {error}
            </UIText>
          </View>
        </Animated.View>
      )}
    </View>
  );
});

const s = StyleSheet.create({
  // ── Input row ───────────────────────────────────────────────────────────
  inputRow: {
    alignItems: "flex-end",
    gap:        8,
  },
  inputWrap: {
    flex:              1,
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    gap:               8,
    backgroundColor:   kit.color.well,
    borderWidth:       1,
    borderColor:       kit.color.line,
    borderRadius:      12,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  inputWrapError: {
    borderColor: kit.color.danger,
    backgroundColor: kit.color.dangerTint,
  },
  inputIcon: {
    flexShrink: 0,
  },
  input: {
    flex:               1,
    fontSize:           13,
    fontFamily:         theme.fonts.bold,
    color:              kit.color.ink,
    letterSpacing:      1.5,
    includeFontPadding: false,
    padding:            0,
  },
  applyBtn: {
    paddingHorizontal: 16,
    paddingVertical:   11,
    borderRadius:      12,
    backgroundColor:   kit.color.accent,
    minWidth:          76,
    alignItems:        "center",
    justifyContent:    "center",
  },
  applyBtnDisabled: {
    backgroundColor: kit.color.lineStrong,
  },
  applyBtnPressed: {
    opacity:   0.85,
    transform: [{ scale: 0.97 }],
  },
  applyBtnText: {
    fontSize:           12,
    fontFamily:         theme.fonts.black,
    color:              "#fff",
    includeFontPadding: false,
  },

  // ── Error ───────────────────────────────────────────────────────────────
  errorRow: {
    flexDirection:  flexRow(IS_RTL),
    alignItems:     "center",
    gap:            5,
    marginTop:      6,
    paddingHorizontal: 4,
  },
  errorText: {
    flex:               1,
    color:              kit.color.danger,
    lineHeight:         17,
    includeFontPadding: false,
  },

  // ── Success banner ──────────────────────────────────────────────────────
  successBanner: {
    flexDirection:     flexRow(IS_RTL),
    alignItems:        "center",
    justifyContent:    "space-between",
    gap:               10,
    backgroundColor:   kit.color.successTint,
    borderWidth:       1.5,
    borderColor:       kit.color.success,
    borderRadius:      14,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  successLeft: {
    flex:          1,
    flexDirection: flexRow(IS_RTL),
    alignItems:    "center",
    gap:           10,
  },
  successIconWrap: {
    flexShrink: 0,
  },
  successTextWrap: {
    flex: 1,
    gap:  2,
  },
  successTitle: {
    color:     kit.color.success,
    textAlign: TEXT_START,
  },
  successSaving: {
    color:     kit.color.success,
    opacity:   0.8,
    textAlign: TEXT_START,
  },
  removeBtn: {
    padding:     4,
    flexShrink:  0,
  },
});
