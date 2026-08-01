/**
 * PlacesAutocompleteField — web address autocomplete backed by Geoapify.
 *
 * Matches the visual style of the existing <Field /> component used in
 * Checkout.tsx so it integrates without a layout change.
 *
 * Behaviour:
 *   - Fetches suggestions after user types ≥3 chars (300ms debounce)
 *   - Dropdown closes on blur (150ms delay to allow click to land)
 *   - Selecting a suggestion fills the street field and calls
 *     onSuggestionSelect so parent can fill building/district/coords
 *   - Aborts in-flight requests when value changes
 *   - Caches results in memory for the session
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { cn } from "./UI";

const GEOAPIFY_KEY =
  import.meta.env.VITE_GEOAPIFY_KEY ?? "c6beba954a794cb49263d1679e4bc8bf";

export interface PlacesSuggestion {
  formatted:    string;
  street:       string | null;
  houseNumber:  string | null;
  district:     string | null;
  city:         string | null;
  lat:          number;
  lng:          number;
  placeId:      string;
}

const cache = new Map<string, PlacesSuggestion[]>();

async function fetchSuggestions(
  query:  string,
  signal: AbortSignal,
): Promise<PlacesSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const key = q;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const params = new URLSearchParams({
      text:   q,
      apiKey: GEOAPIFY_KEY,
      limit:  "6",
      lang:   "ar",
      bias:   "rect:30.70,29.78,31.90,30.28",
      filter: "countrycode:eg",
    });
    const resp = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`,
      { signal },
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    const results: PlacesSuggestion[] = (json.features ?? []).map((f: any) => ({
      formatted:   f.properties.formatted,
      street:      f.properties.street ?? null,
      houseNumber: f.properties.housenumber ?? null,
      district:    f.properties.suburb ?? f.properties.district ?? null,
      city:        f.properties.city ?? null,
      lat:         f.properties.lat,
      lng:         f.properties.lon,
      placeId:     f.properties.place_id,
    }));
    cache.set(key, results);
    return results;
  } catch {
    return [];
  }
}

interface Props {
  label:               string;
  value:               string;
  onChange:            (v: string) => void;
  onBlur?:             () => void;
  onSuggestionSelect?: (s: PlacesSuggestion) => void;
  placeholder?:        string;
  error?:              string;
  lang?:               "ar" | "en";
}

export function PlacesAutocompleteField({
  label,
  value,
  onChange,
  onBlur,
  onSuggestionSelect,
  placeholder,
  error,
  lang = "ar",
}: Props) {
  const abortRef    = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [suggestions, setSuggestions] = useState<PlacesSuggestion[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [open,        setOpen]        = useState(false);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);

      fetchSuggestions(trimmed, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setSuggestions(results);
            setOpen(results.length > 0);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [value]);

  const handleSelect = useCallback(
    (s: PlacesSuggestion) => {
      onChange(s.street ?? s.formatted);
      setSuggestions([]);
      setOpen(false);
      onSuggestionSelect?.(s);
    },
    [onChange, onSuggestionSelect],
  );

  const handleBlur = useCallback(() => {
    closeRef.current = setTimeout(() => {
      setOpen(false);
      onBlur?.();
    }, 160);
  }, [onBlur]);

  const handleFocus = useCallback(() => {
    if (closeRef.current) clearTimeout(closeRef.current);
    if (suggestions.length > 0) setOpen(true);
  }, [suggestions.length]);

  const isRtl = lang === "ar";

  return (
    <div className="relative w-full" dir={isRtl ? "rtl" : "ltr"}>
      {/* Label */}
      <label className="mb-1.5 block text-xs font-bold text-slate-500 uppercase tracking-wide">
        {label}
      </label>

      {/* Input row */}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-2xl border bg-white px-4 py-3 transition-colors",
          error
            ? "border-red-400 bg-red-50"
            : "border-slate-200 focus-within:border-teal-400 focus-within:bg-white",
        )}
      >
        <MapPin
          size={15}
          className={cn("shrink-0", error ? "text-red-400" : "text-teal-500")}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            placeholder ??
            (isRtl ? "ادخل اسم الشارع أو العنوان…" : "Enter street or address…")
          }
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-300"
          autoComplete="street-address"
          dir={isRtl ? "rtl" : "ltr"}
        />
        {loading && (
          <Loader2 size={14} className="shrink-0 animate-spin text-teal-500" />
        )}
        {!loading && value.length > 0 && (
          <button
            type="button"
            onClick={() => { onChange(""); setSuggestions([]); setOpen(false); }}
            className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors"
            aria-label={isRtl ? "مسح" : "Clear"}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs font-semibold text-red-500">{error}</p>
      )}

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl"
          role="listbox"
        >
          {suggestions.map((s, idx) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                // prevent blur firing before click
                e.preventDefault();
                handleSelect(s);
              }}
              className={cn(
                "flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-teal-50 transition-colors",
                idx < suggestions.length - 1 && "border-b border-slate-50",
              )}
            >
              <MapPin size={13} className="mt-0.5 shrink-0 text-teal-500" />
              <div className="min-w-0 flex-1" dir={isRtl ? "rtl" : "ltr"}>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {s.street ?? s.formatted}
                </p>
                {(s.district ?? s.city) && (
                  <p className="truncate text-xs text-slate-400">
                    {[s.district, s.city].filter(Boolean).join("، ")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
