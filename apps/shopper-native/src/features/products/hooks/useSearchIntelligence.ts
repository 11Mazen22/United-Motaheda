/**
 * useSearchIntelligence — calls the search-intelligence Edge Function
 * (Product Intelligence Stage 3) for natural-language queries, with a hard
 * fallback to the plain search_effective_products RPC path
 * (useInfiniteProducts / fetchProductsPage) if the Edge Function isn't
 * deployed yet, times out, or errors.
 *
 * This is deliberately opt-in, not a replacement for useProductSearch /
 * useInfiniteProducts — those remain the primary, always-available path
 * (keystroke-stage suggestions and the main results grid). This hook is for
 * the specific case of a longer, natural-language query where intent
 * classification and (if configured) AI interpretation add real value —
 * see search.tsx for where that distinction is made.
 */
import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { EffectiveProductRowSchema, normalizeEffectiveProduct, type NativeProduct } from "../types";
import type { SearchIntelligenceRequest, SearchIntelligenceResponse } from "../types/searchIntelligence";

export interface SearchIntelligenceState {
  products: NativeProduct[];
  intent: SearchIntelligenceResponse["intent"] | null;
  intentSource: "rule" | "ai" | null;
  aiExplanation: string | null;
  clarificationQuestion: string | null;
  provider: SearchIntelligenceResponse["provider"] | null;
  isLoading: boolean;
  /** True when the Edge Function call itself failed (network/deploy issue) —
   *  callers should fall back to fetchProductsPage directly in this case. */
  unavailable: boolean;
}

const EMPTY_STATE: SearchIntelligenceState = {
  products: [],
  intent: null,
  intentSource: null,
  aiExplanation: null,
  clarificationQuestion: null,
  provider: null,
  isLoading: false,
  unavailable: false,
};

export function useSearchIntelligence() {
  const [state, setState] = useState<SearchIntelligenceState>(EMPTY_STATE);

  const run = useCallback(async (req: SearchIntelligenceRequest) => {
    setState((s) => ({ ...s, isLoading: true, unavailable: false }));
    try {
      const { data, error } = await supabase.functions.invoke<SearchIntelligenceResponse>(
        "search-intelligence",
        { body: req },
      );
      if (error || !data) {
        if (__DEV__) console.warn("[search-intelligence] Edge Function unavailable:", error?.message);
        setState({ ...EMPTY_STATE, unavailable: true });
        return null;
      }

      const parsed = EffectiveProductRowSchema.array().safeParse(data.products);
      const products = parsed.success ? parsed.data.map(normalizeEffectiveProduct) : [];

      setState({
        products,
        intent: data.intent,
        intentSource: data.intentSource,
        aiExplanation: data.aiExplanation,
        clarificationQuestion: data.clarificationQuestion,
        provider: data.provider,
        isLoading: false,
        unavailable: false,
      });
      return data;
    } catch (e) {
      if (__DEV__) console.warn("[search-intelligence] call threw:", e);
      setState({ ...EMPTY_STATE, unavailable: true });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState(EMPTY_STATE), []);

  return { ...state, run, reset };
}
