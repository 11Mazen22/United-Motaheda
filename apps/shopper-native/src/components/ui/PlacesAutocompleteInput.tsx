/**
 * PlacesAutocompleteInput — address autocomplete backed by Geoapify.
 *
 * Wraps a TextInput with a dropdown of suggestions that appear after the
 * user types ≥3 characters. Selecting a suggestion:
 *   1. Fills this input with the street name
 *   2. Calls onSuggestionSelect so the parent can fill related fields
 *      (district, building, lat/lng)
 *
 * Design:
 *   - Dropdown appears below the input, max 6 entries
 *   - Each entry shows the formatted address with the matched part bold
 *   - Tapping a suggestion haptic-taps and closes the dropdown
 *   - Blurring the input closes the dropdown after 150ms (allows tap to land)
 *   - Loading indicator while fetching
 *   - RTL-aware layout
 *
 * Accessibility:
 *   - Dropdown items have accessibilityRole="button"
 *   - Input has accessibilityLabel from the label prop
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons }       from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Haptics       from "expo-haptics";
import { Platform }       from "react-native";

import { Text as UIText }  from "@/shared/ui";
import { kit }             from "@/shared/kit";
import { theme }           from "@/shared/theme";
import { flexRow, isRtl, textAlignStart } from "@/utils/layout";
import {
  fetchPlacesSuggestions,
  type PlacesSuggestion,
} from "@/lib/placesApi";
export type { PlacesSuggestion } from "@/lib/placesApi";

const IS_RTL     = isRtl();
const TEXT_START = textAlignStart(IS_RTL);

export interface PlacesAutocompleteInputProps {
  label:              string;
  value:              string;
  onChangeText:       (text: string) => void;
  /** Called when user picks a suggestion — lets parent fill related fields */
  onSuggestionSelect?: (suggestion: PlacesSuggestion) => void;
  placeholder?:       string;
  error?:             string;
  disabled?:          boolean;
  autoFocus?:         boolean;
}

export function PlacesAutocompleteInput({
  label,
  value,
  onChangeText,
  onSuggestionSelect,
  placeholder,
  error,
  disabled,
  autoFocus,
}: PlacesAutocompleteInputProps) {
  const { t }       = useTranslation();
  const inputRef    = useRef<TextInput>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const closeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);

  // Fetch suggestions whenever value changes (≥3 chars)
  useEffect(() => {
    const trimmed = value.trim();

    // Cancel previous in-flight request
    abortRef.current?.abort();

    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    fetchPlacesSuggestions(trimmed, { signal: controller.signal })
      .then((results) => {
        if (!controller.signal.aborted) {
          setSuggestions(results);
          setOpen(results.length > 0);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [value]);

  const handleSelect = useCallback(
    (suggestion: PlacesSuggestion) => {
      if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      // Fill input with street name (fall back to formatted if no street)
      const streetText = suggestion.street ?? suggestion.formatted;
      onChangeText(streetText);
      setSuggestions([]);
      setOpen(false);
      onSuggestionSelect?.(suggestion);
      inputRef.current?.blur();
    },
    [onChangeText, onSuggestionSelect],
  );

  const handleBlur = useCallback(() => {
    // Delay so a tap on a suggestion fires before the dropdown closes
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, []);

  const handleFocus = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (suggestions.length > 0) setOpen(true);
  }, [suggestions.length]);

  return (
    <View style={s.root}>
      {/* Label */}
      <UIText variant="caption" color="secondary" style={s.label}>
        {label}
      </UIText>

      {/* Input row */}
      <View style={[
        s.inputRow,
        { flexDirection: flexRow(IS_RTL) },
        error && s.inputRowError,
        disabled && s.inputRowDisabled,
      ]}>
        <Ionicons
          name="search-outline"
          size={14}
          color={error ? kit.color.danger : kit.color.inkFaint}
          style={{ flexShrink: 0 }}
        />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder ?? t("checkout.streetPlaceholder", "ادخل اسم الشارع أو العنوان")}
          placeholderTextColor={kit.color.inkFaint}
          style={[s.input, { textAlign: TEXT_START }]}
          editable={!disabled}
          autoFocus={autoFocus}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={label}
        />
        {loading && (
          <ActivityIndicator size="small" color={kit.color.accent} style={{ flexShrink: 0 }} />
        )}
        {!loading && value.length > 0 && (
          <Pressable
            onPress={() => { onChangeText(""); setSuggestions([]); setOpen(false); }}
            hitSlop={8}
            style={{ flexShrink: 0 }}
          >
            <Ionicons name="close-circle" size={14} color={kit.color.inkFaint} />
          </Pressable>
        )}
      </View>

      {/* Error */}
      {error && (
        <UIText variant="caption" style={s.errorText}>{error}</UIText>
      )}

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <View style={s.dropdown}>
          {suggestions.map((suggestion, idx) => (
            <Pressable
              key={suggestion.placeId}
              onPress={() => handleSelect(suggestion)}
              style={({ pressed }) => [
                s.suggestionRow,
                { flexDirection: flexRow(IS_RTL) },
                idx < suggestions.length - 1 && s.suggestionBorder,
                pressed && s.suggestionPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={suggestion.formatted}
            >
              <Ionicons
                name="location-outline"
                size={13}
                color={kit.color.accentDeep}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <UIText
                  variant="body-sm"
                  numberOfLines={1}
                  style={{ textAlign: TEXT_START }}
                >
                  {suggestion.street ?? suggestion.formatted}
                </UIText>
                {suggestion.district && (
                  <UIText
                    variant="caption"
                    color="secondary"
                    numberOfLines={1}
                    style={{ textAlign: TEXT_START }}
                  >
                    {[suggestion.district, suggestion.city]
                      .filter(Boolean)
                      .join("، ")}
                  </UIText>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:  { position: "relative", zIndex: 100 },
  label: { marginBottom: 4, textAlign: TEXT_START },

  inputRow: {
    alignItems:        "center",
    gap:               8,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1.5,
    borderColor:       kit.color.line,
    paddingHorizontal: 12,
    paddingVertical:   11,
    minHeight:         50,
  },
  inputRowError:    { borderColor: kit.color.danger, backgroundColor: kit.color.dangerTint },
  inputRowDisabled: { opacity: 0.5 },
  input: {
    flex:       1,
    fontSize:   14,
    fontFamily: theme.fonts.regular,
    color:      kit.color.ink,
    padding:    0,
  },
  errorText: { color: kit.color.danger, marginTop: 3 },

  dropdown: {
    position:          "absolute",
    top:               "100%",
    left:              0,
    right:             0,
    marginTop:         4,
    backgroundColor:   kit.color.surface,
    borderRadius:      kit.radius.lg,
    borderWidth:       1,
    borderColor:       kit.color.line,
    ...kit.shadow.floating,
    zIndex:            200,
    overflow:          "hidden",
  },
  suggestionRow: {
    alignItems:        "flex-start",
    gap:               10,
    paddingHorizontal: 14,
    paddingVertical:   12,
  },
  suggestionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: kit.color.line,
  },
  suggestionPressed: {
    backgroundColor: kit.color.accentTint,
  },
});
