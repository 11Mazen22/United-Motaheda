/**
 * Recent searches — MMKV-persisted, capped LRU of the user's last search
 * terms. Public, anonymous data — mirrors recentlyViewedStore's pattern
 * (device-scoped, survives sign-out, small enough for MMKV).
 */
import { create } from "zustand";
import { appKV } from "@/lib/mmkv";

const STORAGE_KEY = "recent-searches-v1";
const MAX_ITEMS = 8;

interface RecentSearchesState {
  terms: string[];
  push: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

function loadInitial(): string[] {
  const raw = appKV.getString(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, MAX_ITEMS) : [];
  } catch {
    appKV.delete(STORAGE_KEY);
    return [];
  }
}

function persist(terms: string[]): void {
  try {
    appKV.set(STORAGE_KEY, JSON.stringify(terms));
  } catch {
    // non-critical — drop silently rather than crash the search flow.
  }
}

export const useRecentSearchesStore = create<RecentSearchesState>((set, get) => ({
  terms: loadInitial(),

  push: (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const existing = get().terms;
    const filtered = existing.filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...filtered].slice(0, MAX_ITEMS);
    persist(next);
    set({ terms: next });
  },

  remove: (term) => {
    const next = get().terms.filter((t) => t !== term);
    persist(next);
    set({ terms: next });
  },

  clear: () => {
    appKV.delete(STORAGE_KEY);
    set({ terms: [] });
  },
}));
