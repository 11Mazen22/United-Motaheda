/**
 * Cart store unit tests.
 *
 * Focus areas:
 *   1. addItem / removeItem / updateQty — quantity clamping and state shape
 *   2. ensureReservations — only reserves lines that lack a reservationId
 *   3. commitReservations — tallies committed vs failed correctly
 *   4. parseReserveError — error classification via addItem error path
 *   5. Race condition: quantity-change guard in the reserve .then() callback
 *
 * All external I/O (Supabase, storage, analytics, inventory RPCs) is mocked
 * so tests are synchronous-fast and hermetic.
 *
 * Jest variable-in-factory rule: only variables prefixed with "mock"
 * (case-insensitive) may be referenced inside jest.mock() factories.
 */

// ─── Global stubs ─────────────────────────────────────────────────────────────
(globalThis as any).__DEV__ = false;

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/utils/storage", () => ({
  storageGet:   jest.fn(async () => null),
  storageSet:   jest.fn(async () => {}),
  STORAGE_KEYS: { cart: "cart" },
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/crashReporter", () => ({
  captureError: jest.fn(),
}));

jest.mock("@/features/inventory", () => ({
  reserveInventory: jest.fn(),
  releaseInventory: jest.fn(),
  commitInventory:  jest.fn(),
}));

jest.mock("@/features/cart/api", () => ({
  fetchUserCart:   jest.fn(async () => []),
  mergeCartItems:  jest.fn((_local: unknown[], server: unknown[]) => server),
  removeCartItem:  jest.fn(async () => {}),
  replaceUserCart: jest.fn(async () => {}),
  upsertCartItem:  jest.fn(async () => {}),
}));

jest.mock("@/features/checkout", () => ({
  createCheckoutPricing: jest.fn(() => ({
    subtotal: 0, tax: 0, shipping: 0, total: 0, discountLine: null,
  })),
  isPromoCodeEligible: jest.fn(() => false),
}));

// idempotencyKey: sequential strings so test assertions are deterministic.
// Variable MUST be prefixed "mock" to be usable inside a jest.mock factory.
let mockKeyCounter = 0;
jest.mock("@/lib/idempotency", () => ({
  newIdempotencyKey: jest.fn(() => `mock-idempotency-key-${++mockKeyCounter}`),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { onlineManager } from "@tanstack/react-query";
import { useCartStore } from "../cart";
import type { NativeProduct } from "@/services/productsApi";

// Convenience references to the mocked functions (safe after jest.mock calls)
const { reserveInventory: mockReserveInventory, releaseInventory: mockReleaseInventory, commitInventory: mockCommitInventory } =
  jest.requireMock("@/features/inventory") as {
    reserveInventory: jest.Mock;
    releaseInventory: jest.Mock;
    commitInventory:  jest.Mock;
  };

const { captureError: mockCaptureError } =
  jest.requireMock("@/lib/crashReporter") as { captureError: jest.Mock };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProduct(id: string, stock = 10): NativeProduct {
  return {
    id,
    name:          `Product ${id}`,
    code:          id,
    price:         100,
    originalPrice: 100,
    inStock:       true,
    stock,
    description:   "",
    category:      "general",
    imageUrl:       null,
    images:        [],
    unit:          "piece",
    brandId:       null,
    brandName:     null,
    tags:          [],
    requiresPrescription: false,
    isNew:         false,
    isFeatured:    false,
    discount:      0,
  } as unknown as NativeProduct;
}

function resetStore() {
  useCartStore.setState({
    items:                [],
    promoCode:            "",
    shippingFee:          0,
    isHydrated:           false,
    userId:               null,
    lastReservationError: null,
  });
  mockKeyCounter = 0;
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

let isOnlineSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  isOnlineSpy = jest.spyOn(onlineManager, "isOnline").mockReturnValue(true);
});

afterEach(() => {
  isOnlineSpy.mockRestore();
});

// ─── addItem ──────────────────────────────────────────────────────────────────

describe("addItem", () => {
  it("adds a new item to an empty cart", () => {
    const product = makeProduct("p1");
    useCartStore.getState().addItem(product, 2);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe("p1");
    expect(items[0].quantity).toBe(2);
  });

  it("increments quantity when adding an existing item", () => {
    const product = makeProduct("p1", 20);
    useCartStore.getState().addItem(product, 3);
    useCartStore.getState().addItem(product, 4);
    expect(useCartStore.getState().items[0].quantity).toBe(7);
  });

  it("clamps quantity to product stock", () => {
    const product = makeProduct("p1", 5);
    useCartStore.getState().addItem(product, 99);
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("does not add item when product is out of stock (stock=0)", () => {
    const product = makeProduct("oos", 0);
    useCartStore.getState().addItem(product, 1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("fires reserveInventory for an authed online user", async () => {
    mockReserveInventory.mockResolvedValue({ reservation_id: "res-001" });
    useCartStore.setState({ userId: "user-1" });
    useCartStore.getState().addItem(makeProduct("p1"), 1);
    await Promise.resolve();
    await Promise.resolve();
    expect(mockReserveInventory).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "p1", quantity: 1 }),
    );
  });

  it("patches the item with reservationId after successful reserve", async () => {
    mockReserveInventory.mockResolvedValue({ reservation_id: "res-from-server" });
    useCartStore.setState({ userId: "user-1" });
    useCartStore.getState().addItem(makeProduct("p1"), 1);
    await new Promise<void>((r) => setTimeout(r, 0));
    const item = useCartStore.getState().items.find((i) => i.productId === "p1");
    expect(item?.reservationId).toBe("res-from-server");
  });

  it("does NOT fire reserveInventory for anonymous user", async () => {
    useCartStore.setState({ userId: null });
    useCartStore.getState().addItem(makeProduct("p1"), 1);
    await Promise.resolve();
    expect(mockReserveInventory).not.toHaveBeenCalled();
  });

  it("does NOT fire reserveInventory when offline", async () => {
    isOnlineSpy.mockReturnValue(false);
    useCartStore.setState({ userId: "user-1" });
    useCartStore.getState().addItem(makeProduct("p1"), 1);
    await Promise.resolve();
    expect(mockReserveInventory).not.toHaveBeenCalled();
  });
});

// ── removeItem ───────────────────────────────────────────────────────────────

describe("removeItem", () => {
  it("removes the item from the cart", () => {
    useCartStore.setState({ items: [{ productId: "p1", quantity: 2, product: makeProduct("p1") }] });
    useCartStore.getState().removeItem("p1");
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("fires releaseInventory for the removed item's reservationId", async () => {
    mockReleaseInventory.mockResolvedValue({});
    useCartStore.setState({
      userId: "user-1",
      items: [{
        productId:     "p1",
        quantity:      1,
        product:       makeProduct("p1"),
        reservationId: "res-to-release",
      }],
    });
    useCartStore.getState().removeItem("p1");
    await Promise.resolve();
    expect(mockReleaseInventory).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: "res-to-release", reason: "removed_from_cart" }),
    );
  });

  it("does NOT call releaseInventory when there is no reservationId", async () => {
    useCartStore.setState({
      userId: "user-1",
      items: [{ productId: "p1", quantity: 1, product: makeProduct("p1") }],
    });
    useCartStore.getState().removeItem("p1");
    await Promise.resolve();
    expect(mockReleaseInventory).not.toHaveBeenCalled();
  });
});

// ── updateQty ────────────────────────────────────────────────────────────────

describe("updateQty", () => {
  it("updates the quantity", () => {
    useCartStore.setState({
      items: [{ productId: "p1", quantity: 2, product: makeProduct("p1", 10) }],
    });
    useCartStore.getState().updateQty("p1", 5);
    expect(useCartStore.getState().items[0].quantity).toBe(5);
  });

  it("removes the item when qty is 0", () => {
    useCartStore.setState({
      items: [{ productId: "p1", quantity: 2, product: makeProduct("p1", 10) }],
    });
    useCartStore.getState().updateQty("p1", 0);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it("clears the reservationId after quantity change (triggers fresh reserve)", () => {
    useCartStore.setState({
      items: [{
        productId: "p1", quantity: 2, product: makeProduct("p1", 10), reservationId: "old-res",
      }],
    });
    useCartStore.getState().updateQty("p1", 3);
    const item = useCartStore.getState().items.find((i) => i.productId === "p1");
    expect(item?.reservationId).toBeUndefined();
  });
});

// ── ensureReservations ───────────────────────────────────────────────────────

describe("ensureReservations", () => {
  it("skips items that already have a reservationId", async () => {
    useCartStore.setState({
      userId: "user-1",
      items: [{
        productId: "p1", quantity: 1, product: makeProduct("p1"), reservationId: "already-reserved",
      }],
    });
    const failures = await useCartStore.getState().ensureReservations();
    expect(failures).toHaveLength(0);
    expect(mockReserveInventory).not.toHaveBeenCalled();
  });

  it("reserves items that are missing a reservationId", async () => {
    mockReserveInventory.mockResolvedValue({ reservation_id: "new-res" });
    useCartStore.setState({
      userId: "user-1",
      items: [{ productId: "p1", quantity: 2, product: makeProduct("p1") }],
    });
    const failures = await useCartStore.getState().ensureReservations();
    expect(failures).toHaveLength(0);
    expect(mockReserveInventory).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "p1", quantity: 2 }),
    );
  });

  it("patches the item with the new reservationId on success", async () => {
    mockReserveInventory.mockResolvedValue({ reservation_id: "patched-res" });
    useCartStore.setState({
      userId: "user-1",
      items: [{ productId: "p1", quantity: 1, product: makeProduct("p1") }],
    });
    await useCartStore.getState().ensureReservations();
    expect(useCartStore.getState().items[0].reservationId).toBe("patched-res");
  });

  it("returns a ReservationError with Arabic message for insufficient_stock", async () => {
    mockReserveInventory.mockRejectedValue(new Error("insufficient_stock|available=0|requested=2"));
    useCartStore.setState({
      userId: "user-1",
      items: [{ productId: "p1", quantity: 2, product: makeProduct("p1") }],
    });
    const failures = await useCartStore.getState().ensureReservations();
    expect(failures).toHaveLength(1);
    expect(failures[0].productId).toBe("p1");
    expect(failures[0].message).toContain("نفذ المخزون");
  });

  it("continues reserving other items even after one fails", async () => {
    mockReserveInventory
      .mockRejectedValueOnce(new Error("insufficient_stock|available=0|requested=1"))
      .mockResolvedValueOnce({ reservation_id: "res-p2" });

    useCartStore.setState({
      userId: "user-1",
      items: [
        { productId: "p1", quantity: 1, product: makeProduct("p1") },
        { productId: "p2", quantity: 1, product: makeProduct("p2") },
      ],
    });
    const failures = await useCartStore.getState().ensureReservations();
    expect(failures).toHaveLength(1);
    expect(failures[0].productId).toBe("p1");
    expect(useCartStore.getState().items[1].reservationId).toBe("res-p2");
  });

  it("returns an empty array for anonymous user (no userId)", async () => {
    useCartStore.setState({
      userId: null,
      items: [{ productId: "p1", quantity: 1, product: makeProduct("p1") }],
    });
    const failures = await useCartStore.getState().ensureReservations();
    expect(failures).toHaveLength(0);
    expect(mockReserveInventory).not.toHaveBeenCalled();
  });
});

// ── commitReservations ───────────────────────────────────────────────────────

describe("commitReservations", () => {
  it("commits all items with reservationIds and returns correct counts", async () => {
    mockCommitInventory.mockResolvedValue({});
    useCartStore.setState({
      items: [
        { productId: "p1", quantity: 1, product: makeProduct("p1"), reservationId: "r1" },
        { productId: "p2", quantity: 1, product: makeProduct("p2"), reservationId: "r2" },
      ],
    });
    const result = await useCartStore.getState().commitReservations("order-001");
    expect(result.committed).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("counts items without reservationId as failures and captures the error", async () => {
    useCartStore.setState({
      items: [{ productId: "p1", quantity: 1, product: makeProduct("p1") }], // no reservationId
    });
    const result = await useCartStore.getState().commitReservations("order-002");
    expect(result.committed).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockCaptureError).toHaveBeenCalled();
  });

  it("captures and counts individual commit failures without throwing", async () => {
    mockCommitInventory
      .mockResolvedValueOnce({})                          // p1 succeeds
      .mockRejectedValueOnce(new Error("commit failed")); // p2 fails

    useCartStore.setState({
      items: [
        { productId: "p1", quantity: 1, product: makeProduct("p1"), reservationId: "r1" },
        { productId: "p2", quantity: 1, product: makeProduct("p2"), reservationId: "r2" },
      ],
    });
    const result = await useCartStore.getState().commitReservations("order-003");
    expect(result.committed).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ orderId: "order-003", productId: "p2" }),
    );
  });
});

// ── Reserve error messages ────────────────────────────────────────────────────

describe("addItem — reservation failure error messages", () => {
  beforeEach(() => { useCartStore.setState({ userId: "user-1" }); });

  it("sets Arabic 'stock exhausted' message when available=0", async () => {
    mockReserveInventory.mockRejectedValue(
      new Error("insufficient_stock|available=0|requested=1"),
    );
    useCartStore.getState().addItem(makeProduct("p1"), 1);
    await new Promise<void>((r) => setTimeout(r, 0));
    const err = useCartStore.getState().lastReservationError;
    expect(err?.message).toBe("نفذ المخزون لهذا المنتج");
  });

  it("sets Arabic 'only N available' message when available>0", async () => {
    mockReserveInventory.mockRejectedValue(
      new Error("insufficient_stock|available=3|requested=10"),
    );
    useCartStore.getState().addItem(makeProduct("p1", 10), 10);
    await new Promise<void>((r) => setTimeout(r, 0));
    const err = useCartStore.getState().lastReservationError;
    expect(err?.message).toBe("الكمية المتاحة فقط 3");
  });

  it("sets generic Arabic error for unknown reserve failures", async () => {
    mockReserveInventory.mockRejectedValue(new Error("something else entirely"));
    useCartStore.getState().addItem(makeProduct("p1"), 1);
    await new Promise<void>((r) => setTimeout(r, 0));
    const err = useCartStore.getState().lastReservationError;
    expect(err?.message).toBe("تعذر حجز المخزون");
  });
});

// ── Race condition guard ─────────────────────────────────────────────────────

describe("addItem — race: quantity changed before reserve resolves", () => {
  it("does NOT patch reservationId if quantity changed since reserve was fired", async () => {
    // Use separate promises so we control each reserve call independently.
    let resolveFirstReserve!: (v: { reservation_id: string }) => void;
    const firstReservePromise = new Promise<{ reservation_id: string }>((res) => {
      resolveFirstReserve = res;
    });
    // Second reserve never resolves — it's still pending at assertion time.
    const secondReservePromise = new Promise<{ reservation_id: string }>(() => {});

    mockReserveInventory
      .mockReturnValueOnce(firstReservePromise)   // fired by addItem(p, 1) call #1
      .mockReturnValueOnce(secondReservePromise); // fired by addItem(p, 1) call #2

    useCartStore.setState({ userId: "user-1" });
    const p = makeProduct("p1", 20);

    // Call #1: qty=1; fires firstReservePromise.
    useCartStore.getState().addItem(p, 1);
    // Call #2: qty becomes 2 (1+1), clears reservationId, fires secondReservePromise.
    useCartStore.getState().addItem(p, 1);

    // Resolve the FIRST reserve (for qty=1 — stale since store now shows qty=2).
    resolveFirstReserve({ reservation_id: "stale-reserve" });
    await new Promise<void>((r) => setTimeout(r, 0));

    // Guard: `item.quantity (2) !== nextQuantity (1)` → stale patch blocked.
    const item = useCartStore.getState().items.find((i) => i.productId === "p1");
    expect(item?.reservationId).not.toBe("stale-reserve");
    // Second reserve is still pending, so reservationId is undefined.
    expect(item?.reservationId).toBeUndefined();
  });
});

// ── Selectors ─────────────────────────────────────────────────────────────────

describe("itemCount selector", () => {
  it("sums quantities across all cart lines", () => {
    useCartStore.setState({
      items: [
        { productId: "p1", quantity: 3, product: makeProduct("p1") },
        { productId: "p2", quantity: 2, product: makeProduct("p2") },
      ],
    });
    expect(useCartStore.getState().itemCount()).toBe(5);
  });

  it("returns 0 for an empty cart", () => {
    expect(useCartStore.getState().itemCount()).toBe(0);
  });
});

describe("clearReservationError", () => {
  it("clears lastReservationError", () => {
    useCartStore.setState({
      lastReservationError: { productId: "p1", message: "test", ts: Date.now() },
    });
    useCartStore.getState().clearReservationError();
    expect(useCartStore.getState().lastReservationError).toBeNull();
  });
});
