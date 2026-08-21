/**
 
 * Wishlist store unit tests.
 
 *
 
 * Focus areas:
 
 *   1. toggle — adds when missing, removes when present
 *   2. has — checks membership
 *   3. clear — empties local wishlist and cache
 *   4. hydrate anonymous — reads AsyncStorage cache
 *   5. hydrate authed — fetches, merges, replaces, and caches
 *   6. hydrate error fallback — preserves local items on network failure
 *
 
 * All external I/O (Supabase, AsyncStorage) is mocked so tests are
 * synchronous-fast and hermetic.
 
 *
 
 * Jest variable-in-factory rule: only variables prefixed with "mock"
 
 * (case-insensitive) may be referenced inside jest.mock() factories.
 
 */



// ─── Global stubs ─────────────────────────────────────────────────────────────

(globalThis as any).__DEV__ = false;



// ─── Mocks ────────────────────────────────────────────────────────────────────



jest.mock("@react-native-async-storage/async-storage", () => ({
 
  getItem:    jest.fn(async () => null),
 
  setItem:    jest.fn(async () => {}),
 
  removeItem: jest.fn(async () => {}),
 
}));



jest.mock("@/features/wishlist/api", () => ({
 
  fetchUserWishlist:   jest.fn(async () => []),
 
  mergeWishlists:      jest.fn((_local: unknown[], server: unknown[]) => server),
 
  replaceUserWishlist: jest.fn(async () => {}),
 
  addWishlistItem:     jest.fn(async () => {}),
 
  removeWishlistItem:  jest.fn(async () => {}),
 
  clearUserWishlist:   jest.fn(async () => {}),
 
}));



// ─── Imports ─────────────────────────────────────────────────────────────────



import { useWishlistStore } from "../wishlist";

import type { NativeProduct } from "@/services/productsApi";



// Convenience references to the mocked functions (safe after jest.mock calls)

const {
 
  fetchUserWishlist:   mockFetchUserWishlist,
 
  mergeWishlists:      mockMergeWishlists,
 
  replaceUserWishlist: mockReplaceUserWishlist,
 
  addWishlistItem:     mockAddWishlistItem,
 
  removeWishlistItem:  mockRemoveWishlistItem,
 
  // clearUserWishlist:   mockClearUserWishlist,  // ← تم التعليق لأن المتغير غير مستخدم
 
} =

  jest.requireMock("@/features/wishlist/api") as {

    fetchUserWishlist:   jest.Mock;

    mergeWishlists:      jest.Mock;

    replaceUserWishlist: jest.Mock;

    addWishlistItem:     jest.Mock;

    removeWishlistItem:  jest.Mock;

    clearUserWishlist:   jest.Mock;

  };



const { getItem: mockGetItem, setItem: mockSetItem, removeItem: mockRemoveItem } =

  jest.requireMock("@react-native-async-storage/async-storage") as {

    getItem:    jest.Mock;

    setItem:    jest.Mock;

    removeItem: jest.Mock;

  };



// ─── Helpers ─────────────────────────────────────────────────────────────────



function makeProduct(id: string, name = `Product ${id}`): NativeProduct {

  return {

    id,

    code:          id,

    barcode:       id,

    name,

    nameAr:        name,

    nameEn:        name,

    price:         100,

    basePrice:     100,

    stock:         10,

    inStock:       true,

    category:      "general",

    categoryName:  "General",

    categoryNameEn:"General",

    imageUrl:      `https://example.com/${id}.jpg`,

    ratingAvg:     4.5,

    ratingCount:   10,

    discountPercent: 0,

    promotionId:   null,

    promotionName: null,

    promotionEndsAt: null,

    hasActivePromotion: false,

    isNew:         false,

    isBestseller:  false,

  } as unknown as NativeProduct;

}



function resetStore() {

  useWishlistStore.setState({

    items:      [],

    isHydrated: false,

    userId:     null,

  });

}



// ─── Test lifecycle ───────────────────────────────────────────────────────────



beforeEach(() => {

  jest.clearAllMocks();

  resetStore();

});



// ─── toggle ──────────────────────────────────────────────────────────────────



describe("toggle", () => {
 
  it("adds a product to an empty wishlist", () => {
 
    const product = makeProduct("p1");
 
    useWishlistStore.getState().toggle(product);
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(1);
 
    expect(useWishlistStore.getState().items[0].id).toBe("p1");
 
  });
 
 
 
  it("adds product to the front of the list", () => {
 
    const p1 = makeProduct("p1");
 
    const p2 = makeProduct("p2");
 
    useWishlistStore.getState().toggle(p1);
 
    useWishlistStore.getState().toggle(p2);
 
 
 
    expect(useWishlistStore.getState().items[0].id).toBe("p2");
 
    expect(useWishlistStore.getState().items[1].id).toBe("p1");
 
  });
 
 
 
  it("removes an existing product from the wishlist", () => {
 
    const product = makeProduct("p1");
 
    useWishlistStore.setState({ items: [product] });
 
    useWishlistStore.getState().toggle(product);
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(0);
 
  });
 
 
 
  it("persists toggle to AsyncStorage", () => {
 
    const product = makeProduct("p1");
 
    useWishlistStore.getState().toggle(product);
 
 
 
    expect(mockSetItem).toHaveBeenCalledWith(
 
      "um_wishlist_v1",
 
      expect.any(String),
 
    );
 
  });
 
 
 
  it("syncs add to server when userId is set", () => {
 
    useWishlistStore.setState({ userId: "user-1" });
 
    const product = makeProduct("p1");
 
    useWishlistStore.getState().toggle(product);
 
 
 
    expect(mockAddWishlistItem).toHaveBeenCalledWith("user-1", product);
 
  });
 
 
 
  it("syncs remove to server when userId is set", () => {
 
    useWishlistStore.setState({ userId: "user-1", items: [makeProduct("p1")] });
 
    const product = makeProduct("p1");
 
    useWishlistStore.getState().toggle(product);
 
 
 
    expect(mockRemoveWishlistItem).toHaveBeenCalledWith("user-1", "p1");
 
  });
 
 
 
  it("does not sync to server for anonymous user", () => {
 
    useWishlistStore.setState({ userId: null });
 
    const product = makeProduct("p1");
 
    useWishlistStore.getState().toggle(product);
 
 
 
    expect(mockAddWishlistItem).not.toHaveBeenCalled();
 
    expect(mockRemoveWishlistItem).not.toHaveBeenCalled();
 
  });
 
});



// ─── has ─────────────────────────────────────────────────────────────────────



describe("has", () => {
 
  it("returns true when product is in wishlist", () => {
 
    useWishlistStore.setState({ items: [makeProduct("p1")] });
 
    expect(useWishlistStore.getState().has("p1")).toBe(true);
 
  });
 
 
 
  it("returns false when product is not in wishlist", () => {
 
    useWishlistStore.setState({ items: [makeProduct("p1")] });
 
    expect(useWishlistStore.getState().has("p2")).toBe(false);
 
  });
 
 
 
  it("returns false for empty wishlist", () => {
 
    expect(useWishlistStore.getState().has("p1")).toBe(false);
 
  });
 
});



// ─── clear ───────────────────────────────────────────────────────────────────



describe("clear", () => {
 
  it("removes all items from wishlist", () => {
 
    useWishlistStore.setState({ items: [makeProduct("p1"), makeProduct("p2")] });
 
    useWishlistStore.getState().clear();
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(0);
 
  });
 
 
 
  it("resets userId to null", () => {
 
    useWishlistStore.setState({ userId: "user-1" });
 
    useWishlistStore.getState().clear();
 
 
 
    expect(useWishlistStore.getState().userId).toBeNull();
 
  });
 
 
 
  it("removes cached wishlist from AsyncStorage", () => {
 
    useWishlistStore.getState().clear();
 
 
 
    expect(mockRemoveItem).toHaveBeenCalledWith("um_wishlist_v1");
 
  });
 
});



// ─── hydrate ─────────────────────────────────────────────────────────────────



describe("hydrate", () => {
 
  it("loads cached items from AsyncStorage for anonymous user", async () => {
 
    const cached = [makeProduct("p1"), makeProduct("p2")];
 
    mockGetItem.mockResolvedValue(JSON.stringify(cached));
 
 
 
    await useWishlistStore.getState().hydrate(null);
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(2);
 
    expect(useWishlistStore.getState().isHydrated).toBe(true);
 
    expect(useWishlistStore.getState().userId).toBeNull();
 
  });
 
 
 
  it("handles empty cache for anonymous user", async () => {
 
    mockGetItem.mockResolvedValue(null);
 
 
 
    await useWishlistStore.getState().hydrate(null);
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(0);
 
    expect(useWishlistStore.getState().isHydrated).toBe(true);
 
  });
 
 
 
  it("handles malformed cache for anonymous user", async () => {
 
    mockGetItem.mockResolvedValue("not-json");
 
 
 
    await useWishlistStore.getState().hydrate(null);
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(0);
 
    expect(useWishlistStore.getState().isHydrated).toBe(true);
 
  });
 
 
 
  it("fetches server items, merges with local, and caches for authed user", async () => {
 
    const local  = [makeProduct("p1")];
 
    const server = [makeProduct("p2")];
 
    const merged = [makeProduct("p2"), makeProduct("p1")];
 
 
 
    mockFetchUserWishlist.mockResolvedValue(server);
 
    mockMergeWishlists.mockReturnValueOnce(merged);
 
    mockReplaceUserWishlist.mockResolvedValue(undefined);
 
 
 
    useWishlistStore.setState({ items: local });
 
    await useWishlistStore.getState().hydrate("user-1");
 
 
 
    expect(mockFetchUserWishlist).toHaveBeenCalledWith("user-1");
 
    expect(mockMergeWishlists).toHaveBeenCalledWith(local, server);
 
    expect(mockReplaceUserWishlist).toHaveBeenCalledWith("user-1", merged);
 
    expect(useWishlistStore.getState().items).toHaveLength(2);
 
    expect(useWishlistStore.getState().isHydrated).toBe(true);
 
    expect(useWishlistStore.getState().userId).toBe("user-1");
 
  });
 
 
 
  it("caches merged items for authed user", async () => {
 
    const local  = [makeProduct("p1")];
 
    const server = [makeProduct("p2")];
 
    const merged = [makeProduct("p2"), makeProduct("p1")];
 
 
 
    mockFetchUserWishlist.mockResolvedValue(server);
 
    mockMergeWishlists.mockReturnValueOnce(merged);
 
    mockReplaceUserWishlist.mockResolvedValue(undefined);
 
 
 
    useWishlistStore.setState({ items: local });
 
    await useWishlistStore.getState().hydrate("user-1");
 
 
 
    expect(mockSetItem).toHaveBeenCalledWith(
 
      "um_wishlist_v1",
 
      JSON.stringify(merged),
 
    );
 
  });
 
 
 
  it("does not replace server when there are no local items", async () => {
 
    const server = [makeProduct("p1")];
 
    mockFetchUserWishlist.mockResolvedValue(server);
 
    mockReplaceUserWishlist.mockResolvedValue(undefined);
 
 
 
    useWishlistStore.setState({ items: [] });
 
    await useWishlistStore.getState().hydrate("user-1");
 
 
 
    expect(mockReplaceUserWishlist).not.toHaveBeenCalled();
 
    expect(useWishlistStore.getState().items).toHaveLength(1);
 
  });
 
 
 
  it("falls back to local items on fetch error", async () => {
 
    const local = [makeProduct("p1")];
 
    mockFetchUserWishlist.mockRejectedValue(new Error("network"));
 
 
 
    useWishlistStore.setState({ items: local });
 
    await useWishlistStore.getState().hydrate("user-1");
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(1);
 
    expect(useWishlistStore.getState().items[0].id).toBe("p1");
 
    expect(useWishlistStore.getState().isHydrated).toBe(true);
 
    expect(useWishlistStore.getState().userId).toBe("user-1");
 
  });
 
 
 
  it("sets empty items on fetch error when no local items exist", async () => {
 
    mockFetchUserWishlist.mockRejectedValue(new Error("network"));
 
 
 
    useWishlistStore.setState({ items: [] });
 
    await useWishlistStore.getState().hydrate("user-1");
 
 
 
    expect(useWishlistStore.getState().items).toHaveLength(0);
 
    expect(useWishlistStore.getState().isHydrated).toBe(true);
 
  });
 
});



// ─── Wishlist state shape ────────────────────────────────────────────────────



describe("wishlist state shape", () => {
 
  it("starts empty, not hydrated, and without a userId", () => {
 
    resetStore();
 
 
 
    expect(useWishlistStore.getState().items).toEqual([]);
 
    expect(useWishlistStore.getState().isHydrated).toBe(false);
 
    expect(useWishlistStore.getState().userId).toBeNull();
 
  });
 
});