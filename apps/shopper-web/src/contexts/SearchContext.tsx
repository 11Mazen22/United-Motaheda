
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { clearFuzzyCache, fuzzyMatch, fuzzyScore } from "@pharmacy/fuzzy-search";
import type { CatalogProduct } from "../app/catalog";
import { useCatalog } from "./CatalogContext";
import { fetchProductsPage } from "../services/shopperCatalogApi";

// ─── Public types ─────────────────────────────────────────────────────────────

export type SearchInputContextValue = {
  searchQuery:    string;
  setSearchQuery: (value: string) => void;
  committedQuery: string;
  /**
   * Debounced commit of an explicit value. Used by callers that want to commit
   * a string different from the current input (e.g. selecting a suggestion).
   */
  commitQuery:    (value: string) => void;
  /**
   * Debounced commit of the **current** input value. Equivalent to
   * `commitQuery(searchQuery)` but doesn't require the caller to thread the
   * query through. Preferred for "submit on enter" / route-level handlers
   * that just want to push whatever the user has typed.
   */
  commitSearch:   () => void;
};

export type SearchResultsContextValue = {
  suggestions:     CatalogProduct[];
  isSearching:     boolean;
  isWorkerReady:   boolean;
  workerStatus:    "idle" | "building" | "ready";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SUGGESTIONS_LIMIT  = 20;
/** Reduced from 500ms → 320ms — the user wants to see search results update
 *  as they type, not half a second after they stop. */
const COMMIT_DEBOUNCE    = 320;
/** Reduced from 200ms → 140ms — the LRU cache in shopperCatalogApi means
 *  repeated identical queries are free (memory hit); for net-new queries the
 *  140ms gap still batches fast typists without an extra round-trip. */
const SUGGESTION_SERVER_DEBOUNCE_MS = 140;

// ─── Contexts ─────────────────────────────────────────────────────────────────

const SearchInputContext   = createContext<SearchInputContextValue | undefined>(undefined);
const SearchResultsContext = createContext<SearchResultsContextValue | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProductSearchFields(product: CatalogProduct) {
  return {
    nameAr:   product.nameAr   ?? product.name,
    nameEn:   product.nameEn   ?? product.name,
    category: `${product.categoryName ?? ""} ${product.categoryNameEn ?? ""}`,
    code:     product.code,
    barcode:  product.barcode,
  };
}

/**
 * Smart inline ranking on the already-loaded products slice (~24 items).
 *
 * Scoring bonuses (applied on top of the base fuzzyScore):
 *   +200  exact match on either name
 *   +100  one name starts with the query (prefix match)
 *    +50  product is in stock   ← surfaced first to show immediately-orderable items
 *    +20  query found in the category name (secondary signal)
 *
 * Results are stable-sorted: same score → original catalog order preserved.
 */
function rankInline(
  products: CatalogProduct[],
  query:    string,
  limit?:   number,
): string[] {
  type Entry = { id: string; score: number; index: number };
  const entries: Entry[] = [];
  const lower = query.trim().toLowerCase();

  for (let i = 0; i < products.length; i++) {
    const p      = products[i];
    const fields = getProductSearchFields(p);
    if (!fuzzyMatch(query, fields)) continue;

    let score = fuzzyScore(query, fields);

    // In-stock boost — show available items before out-of-stock
    if (p.inStock) score += 50;

    const nameEn = (fields.nameEn ?? "").toLowerCase();
    const nameAr = (fields.nameAr ?? "").toLowerCase();

    // Exact match
    if (nameEn === lower || nameAr === lower) {
      score += 200;
    } else if (nameEn.startsWith(lower) || nameAr.startsWith(lower)) {
      // Prefix match
      score += 100;
    }

    // Category match bonus
    if (fields.category?.toLowerCase().includes(lower)) score += 20;

    entries.push({ id: p.id, score, index: i });
  }

  entries.sort((l, r) =>
    r.score !== l.score ? r.score - l.score : l.index - r.index,
  );

  if (limit && limit > 0 && entries.length > limit) entries.length = limit;
  return entries.map((e) => e.id);
}

function mapIdsToProducts(
  rankedIds:   string[],
  productsById: Map<string, CatalogProduct>,
  limit?:      number,
): CatalogProduct[] {
  const mapped: CatalogProduct[] = [];
  const max = limit && limit > 0 ? Math.min(limit, rankedIds.length) : rankedIds.length;
  for (let i = 0; i < max; i++) {
    const p = productsById.get(rankedIds[i]);
    if (p) mapped.push(p);
  }
  return mapped;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SearchProvider({ children }: { children: ReactNode }) {
  const location     = useLocation();
  const navigate     = useNavigate();
  const { products } = useCatalog();

  // ── 1. Raw input state ────────────────────────────────────────────────────
  //
  // Initialize from the URL on first render so deep-links like
  // /products?search=panadol arrive with the query already populated. The
  // previous version started both states empty, which let the "clear URL when
  // empty" effect run on mount and wipe the ?search= param before the URL→
  // state sync effect had a chance to read it.

  const initialUrlQuery = (() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return (params.get("search") ?? params.get("q") ?? "").trim();
  })();

  const [searchQuery,    setSearchQueryRaw] = useState(initialUrlQuery);
  const [committedQuery, setCommittedQuery] = useState(initialUrlQuery);
  const debounceTimer                       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSearchQuery = useCallback((value: string) => {
    setSearchQueryRaw(value);
  }, []);

  const commitQuery = useCallback((value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      const trimmed = value.trim();
      setCommittedQuery(trimmed);

      // Write to URL only on the /products route — this is the single
      // source of URL mutation for search. Products.tsx no longer has its
      // own URL-sync effect, so the URL is only updated here (explicit
      // commit) and in the clear effect below (explicit clear).
      if (
        location.pathname === "/products" ||
        location.pathname.startsWith("/products/")
      ) {
        const params = new URLSearchParams(location.search);
        if (trimmed) {
          params.set("search", trimmed);
        } else {
          params.delete("search");
        }
        navigate({ search: params.toString() }, { replace: true });
      }
    }, COMMIT_DEBOUNCE);
  }, [location.pathname, location.search, navigate]);

  // Latest `searchQuery` mirror used by `commitSearch()` so the callback can
  // remain referentially stable while still reading the current value.
  const searchQueryRef = useRef(searchQuery);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
  }, [searchQuery]);

  const commitSearch = useCallback(() => {
    commitQuery(searchQueryRef.current);
  }, [commitQuery]);

  // Cancel pending commit and clear URL search param when input is cleared.
  useEffect(() => {
    if (searchQuery) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    setCommittedQuery("");

    if (
      location.pathname === "/products" ||
      location.pathname.startsWith("/products/")
    ) {
      const params = new URLSearchParams(location.search);
      if (params.has("search") || params.has("q")) {
        params.delete("search");
        params.delete("q");
        navigate({ search: params.toString() }, { replace: true });
      }
    }
  }, [searchQuery, location.pathname, location.search, navigate]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ── 2. URL sync ───────────────────────────────────────────────────────────

  const urlSyncRef = useRef<string | null>(null);

  useEffect(() => {
    const params     = new URLSearchParams(location.search);
    const nextSearch = params.get("search") ?? params.get("q") ?? "";

    if (nextSearch) {
      if (urlSyncRef.current !== nextSearch) {
        urlSyncRef.current = nextSearch;
        setSearchQueryRaw(nextSearch);
        setCommittedQuery(nextSearch);
      }
      return;
    }

    if (
      location.pathname === "/products" ||
      location.pathname.startsWith("/products/")
    ) {
      if (urlSyncRef.current !== "") {
        urlSyncRef.current = "";
        setSearchQueryRaw("");
        setCommittedQuery("");
      }
    }
  }, [location.pathname, location.search]);

  // ── 3. Clear caches on route change ──────────────────────────────────────

  useEffect(() => {
    clearFuzzyCache();
  }, [location.pathname]);

  // ── 4. Deferred value (keeps input responsive) ────────────────────────────

  const deferredSearchQuery = useDeferredValue(searchQuery.trim());

  // ── 5. Stable products map ────────────────────────────────────────────────

  const productsById = useMemo(
    () => new Map<string, CatalogProduct>(products.map((p) => [p.id, p])),
    [products],
  );

  // ── 6. Suggestions — server-side via Supabase ilike ──────────────────────
  //
  // Previous architecture: fuzzy-searched over 52K products in a Web Worker.
  // Problem: requires all 52K products in memory — useCatalog().products now
  // only contains 24 (page 1 from CatalogContext mount fetch).
  //
  // New architecture:
  //   1. Instant path — fuzzy match on whichever products are already loaded
  //      (the ~24 from page 1). Shows instant results before the network call.
  //   2. Server path — fetchProductsPage(1, { searchQuery }) via Supabase ilike.
  //      Debounced 200ms. Cached by the LRU page cache in shopperCatalogApi so
  //      repeat queries for the same string cost zero network calls.
  //
  // workerStatus is always "ready" because we no longer depend on a worker.

  const [suggestions,     setSuggestions]     = useState<CatalogProduct[]>([]);
  const [suggestionsBusy, setSuggestionsBusy] = useState(false);

  const suggestionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionAbort       = useRef<AbortController>(new AbortController());

  useEffect(() => {
    const query = deferredSearchQuery;

    if (query.length < 2) {
      startTransition(() => {
        setSuggestions([]);
        setSuggestionsBusy(false);
      });
      return;
    }

    // Abort any in-flight server request from the previous render.
    suggestionAbort.current.abort();
    suggestionAbort.current = new AbortController();
    const abortSignal = suggestionAbort.current.signal;

    // ── Instant path: fuzzy match on already-loaded products ──────────────
    // Fuzzy-match the ~24 page-1 products so the dropdown can show something
    // immediately while Supabase is queried.
    const instantProducts =
      products.length > 0
        ? mapIdsToProducts(
            rankInline(products, query, SUGGESTIONS_LIMIT),
            productsById,
            SUGGESTIONS_LIMIT,
          )
        : [];

    startTransition(() => setSuggestions(instantProducts));
    setSuggestionsBusy(true);

    // ── Server path: full-catalog search via Supabase ilike ───────────────
    //
    // CRITICAL: an empty server response must NOT overwrite a non-empty instant
    // fuzzy list. That was the cause of the "results flash then disappear" bug:
    // a flaky RPC fallback returned 0 rows and wiped out genuine matches.
    //
    // Rule:
    //   • server returns ≥1 result → use server result (authoritative for 52K).
    //   • server returns 0 results → keep whatever instant fuzzy produced.
    if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    suggestionDebounceRef.current = setTimeout(() => {
      void fetchProductsPage(1, { searchQuery: query })
        .then((result) => {
          if (abortSignal.aborted) return;
          startTransition(() => {
            if (result.products.length > 0) {
              setSuggestions(result.products.slice(0, SUGGESTIONS_LIMIT));
            }
            // else: keep the instant fuzzy results already in state.
            setSuggestionsBusy(false);
          });
        })
        .catch(() => {
          if (abortSignal.aborted) return;
          // Network/RPC failure — leave the instant fuzzy results visible.
          startTransition(() => setSuggestionsBusy(false));
        });
    }, SUGGESTION_SERVER_DEBOUNCE_MS);

    return () => {
      if (suggestionDebounceRef.current) clearTimeout(suggestionDebounceRef.current);
    };
  }, [deferredSearchQuery, products, productsById]);

  // ── 7. Context values (split to prevent cascade re-renders) ──────────────

  const inputValue = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      committedQuery,
      commitQuery,
      commitSearch,
    }),
    [searchQuery, setSearchQuery, committedQuery, commitQuery, commitSearch],
  );

  const resultsValue = useMemo(
    () => ({
      suggestions,
      isSearching:   suggestionsBusy,
      isWorkerReady: true,   // server-side search is always "ready"
      workerStatus:  "ready" as const,
    }),
    [suggestions, suggestionsBusy],
  );

  return (
    <SearchInputContext.Provider value={inputValue}>
      <SearchResultsContext.Provider value={resultsValue}>
        {children}
      </SearchResultsContext.Provider>
    </SearchInputContext.Provider>
  );
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useSearchInput(): SearchInputContextValue {
  const ctx = useContext(SearchInputContext);
  if (!ctx) throw new Error("useSearchInput must be used within SearchProvider");
  return ctx;
}

export function useSearchResults(): SearchResultsContextValue {
  const ctx = useContext(SearchResultsContext);
  if (!ctx) throw new Error("useSearchResults must be used within SearchProvider");
  return ctx;
}

/**
 * Legacy combined hook — prefer useSearchInput() / useSearchResults() separately.
 */
export function useSearch() {
  return { ...useSearchInput(), ...useSearchResults() };
}
