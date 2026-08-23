/**
 
 * Orders store unit tests.
 
 *
 
 * Focus areas:
 
 *   1. hydrate — fetch + cache for authed users, clear on sign-out
 *   2. hydrate error fallback — reads AsyncStorage cache when network fails
 *   3. clearOrders — resets local state and cache
 *   4. loading state — true during async hydrate
 *
 
 * All external I/O (Supabase, AsyncStorage) is mocked so tests are
 * synchronous-fast and hermetic.
 
 *
 
 * Jest variable-in-factory rule: only variables prefixed with "mock"
 
 * (case-insensitive) may be referenced inside jest.mock() factories.
 
 */



// ─── Global stubs ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).__DEV__ = true;



// ─── Mocks ────────────────────────────────────────────────────────────────────



jest.mock("@react-native-async-storage/async-storage", () => ({
 
  getItem:    jest.fn(async () => null),
 
  setItem:    jest.fn(async () => {}),
 
  removeItem: jest.fn(async () => {}),
 
}));



jest.mock("@/features/orders/api", () => ({
 
  fetchUserOrders: jest.fn(async () => []),
 
}));



// ─── Imports ─────────────────────────────────────────────────────────────────



import { useOrderStore } from "../orders";

import type { Order } from "../orders";



// Convenience references to the mocked functions (safe after jest.mock calls)

const { fetchUserOrders: mockFetchUserOrders } =

  jest.requireMock("@/features/orders/api") as {

    fetchUserOrders: jest.Mock;

  };



const { getItem: mockGetItem, setItem: mockSetItem, removeItem: mockRemoveItem } =

  jest.requireMock("@react-native-async-storage/async-storage") as {

    getItem:    jest.Mock;

    setItem:    jest.Mock;

    removeItem: jest.Mock;

  };



// ─── Helpers ─────────────────────────────────────────────────────────────────



function makeOrder(id: string, status: Order["status"] = "pending"): Order {

  return {

    id,

    createdAt: new Date().toISOString(),

    items:     [{ productId: "p1", name: "Product", price: 100, quantity: 1 }],

    subtotal:  100,

    delivery:  10,

    total:     110,

    address: {

      name:  "Test User",

      phone: "123",

      city:  "Cairo",

      street: "Street",

    },

    status,

    paymentMethod:   "cash",

    paymentStatus:   "pending",

    externalRef:     null,

    paymentProofUrl: null,

    transferNumber:  null,

    qrToken:         null,

  } as Order;

}



function resetStore() {

  useOrderStore.setState({

    orders:     [],

    isHydrated: false,

    loading:    false,

  });

}



// ─── Test lifecycle ───────────────────────────────────────────────────────────



beforeEach(() => {

  jest.clearAllMocks();

  resetStore();

});



// ─── hydrate ─────────────────────────────────────────────────────────────────



describe("hydrate", () => {
 
  it("fetches orders and sets them for a given userId", async () => {
 
    const serverOrders = [makeOrder("o1", "confirmed"), makeOrder("o2", "delivered")];
 
    mockFetchUserOrders.mockResolvedValue(serverOrders);
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(2);
 
    expect(useOrderStore.getState().orders[0].id).toBe("o1");
 
    expect(useOrderStore.getState().orders[1].id).toBe("o2");
 
    expect(useOrderStore.getState().isHydrated).toBe(true);
 
    expect(useOrderStore.getState().loading).toBe(false);
 
  });
 
 
 
  it("caches fetched orders in AsyncStorage", async () => {
 
    const serverOrders = [makeOrder("o1")];
 
    mockFetchUserOrders.mockResolvedValue(serverOrders);
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(mockSetItem).toHaveBeenCalledWith(
 
      "um_orders_v2",
 
      expect.any(String),
 
    );
 
  });
 
 
 
  it("sets loading true while fetching", async () => {
 
    let resolveFetch: (v: Order[]) => void;
 
    const fetchPromise = new Promise<Order[]>((resolve) => {
 
      resolveFetch = resolve;
 
    });
 
    mockFetchUserOrders.mockReturnValue(fetchPromise);
 
 
 
    const hydratePromise = useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().loading).toBe(true);
 
 
 
    resolveFetch!([makeOrder("o1")]);
 
    await hydratePromise;
 
 
 
    expect(useOrderStore.getState().loading).toBe(false);
 
  });
 
 
 
  it("clears orders when userId is null (sign-out)", async () => {
 
    useOrderStore.setState({ orders: [makeOrder("o1")] });
 
    await useOrderStore.getState().hydrate(null);
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(0);
 
    expect(useOrderStore.getState().isHydrated).toBe(true);
 
    expect(useOrderStore.getState().loading).toBe(false);
 
  });
 
 
 
  it("removes cached orders from AsyncStorage on sign-out", async () => {
 
    await useOrderStore.getState().hydrate(null);
 
 
 
    expect(mockRemoveItem).toHaveBeenCalledWith("um_orders_v2");
 
  });
 
 
 
  it("falls back to AsyncStorage cache when fetchUserOrders throws", async () => {
 
    mockFetchUserOrders.mockRejectedValue(new Error("network"));
 
    const cached = [makeOrder("o-cached", "confirmed")];
 
    mockGetItem.mockResolvedValue(JSON.stringify(cached));
 
 
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(1);
 
    expect(useOrderStore.getState().orders[0].id).toBe("o-cached");
 
    expect(useOrderStore.getState().isHydrated).toBe(true);
 
    expect(useOrderStore.getState().loading).toBe(false);
 
  });
 
 
 
  it("ignores malformed cache and sets empty orders on fetch error", async () => {
 
    mockFetchUserOrders.mockRejectedValue(new Error("network"));
 
    mockGetItem.mockResolvedValue("not-json");
 
 
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(0);
 
    expect(useOrderStore.getState().isHydrated).toBe(true);
 
  });
 
 
 
  it("ignores non-array cache and sets empty orders on fetch error", async () => {
 
    mockFetchUserOrders.mockRejectedValue(new Error("network"));
 
    mockGetItem.mockResolvedValue(JSON.stringify({ id: "x" }));
 
 
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(0);
 
  });
 
 
 
  it("handles fetch error when AsyncStorage cache is empty", async () => {
 
    mockFetchUserOrders.mockRejectedValue(new Error("network"));
 
    mockGetItem.mockResolvedValue(null);
 
 
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(0);
 
    expect(useOrderStore.getState().isHydrated).toBe(true);
 
  });
 
 
 
  it("handles fetch error when AsyncStorage throws", async () => {
 
    mockFetchUserOrders.mockRejectedValue(new Error("network"));
 
    mockGetItem.mockRejectedValue(new Error("storage failure"));
 
 
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(0);
 
    expect(useOrderStore.getState().isHydrated).toBe(true);
 
  });
 
 
 
  it("replaces existing orders with freshly fetched ones", async () => {
 
    useOrderStore.setState({ orders: [makeOrder("old")] });
 
    mockFetchUserOrders.mockResolvedValue([makeOrder("new", "confirmed")]);
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(1);
 
    expect(useOrderStore.getState().orders[0].id).toBe("new");
 
  });
 
});



// ─── clearOrders ─────────────────────────────────────────────────────────────



describe("clearOrders", () => {
 
  it("clears orders from local state", () => {
 
    useOrderStore.setState({ orders: [makeOrder("o1"), makeOrder("o2")] });
 
    useOrderStore.getState().clearOrders();
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(0);
 
  });
 
 
 
  it("resets isHydrated to false", () => {
 
    useOrderStore.setState({ isHydrated: true });
 
    useOrderStore.getState().clearOrders();
 
 
 
    expect(useOrderStore.getState().isHydrated).toBe(false);
 
  });
 
 
 
  it("resets loading to false", () => {
 
    useOrderStore.setState({ loading: true });
 
    useOrderStore.getState().clearOrders();
 
 
 
    expect(useOrderStore.getState().loading).toBe(false);
 
  });
 
 
 
  it("removes cached orders from AsyncStorage", () => {
 
    useOrderStore.getState().clearOrders();
 
 
 
    expect(mockRemoveItem).toHaveBeenCalledWith("um_orders_v2");
 
  });
 
 
 
  it("does not affect server-side orders (local-only clear)", () => {
 
    useOrderStore.setState({ orders: [makeOrder("o1")] });
 
    useOrderStore.getState().clearOrders();
 
 
 
    expect(mockFetchUserOrders).not.toHaveBeenCalled();
 
  });
 
});



// ─── Order state shape ───────────────────────────────────────────────────────



describe("order state shape", () => {
 
  it("starts with empty orders, not hydrated, and not loading", () => {
 
    resetStore();
 
 
 
    expect(useOrderStore.getState().orders).toEqual([]);
 
    expect(useOrderStore.getState().isHydrated).toBe(false);
 
    expect(useOrderStore.getState().loading).toBe(false);
 
  });
 
 
 
  it("preserves hydrated orders until explicitly cleared", async () => {
 
    const serverOrders = [makeOrder("o1")];
 
    mockFetchUserOrders.mockResolvedValue(serverOrders);
 
    await useOrderStore.getState().hydrate("user-1");
 
 
 
    expect(useOrderStore.getState().orders).toHaveLength(1);
 
    useOrderStore.getState().clearOrders();
 
    expect(useOrderStore.getState().orders).toHaveLength(0);
 
  });
 
});
