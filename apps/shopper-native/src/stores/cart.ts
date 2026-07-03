/**
 * Cart store — Supabase-backed with optimistic local mirror + inventory
 * reservations.
 *
 * Architecture:
 *   - Anonymous user: cart works locally (AsyncStorage cache). No server.
 *     Inventory reservations are skipped (the RPC requires auth.uid()); the
 *     server-side reserve happens lazily at checkout once the user signs in.
 *   - Authed user: every mutation writes through to Supabase `cart_items`
 *     in the background (fire-and-forget). Inventory reservations are
 *     created via reserve_inventory() per cart line so the stock is held
 *     for the user during checkout. The reservation_id is stored on the
 *     cart line and consumed via commit_inventory() once the order is placed.
 *
 * Idempotency:
 *   Each reservation gets a fresh idempotency key. React Query retries
 *   re-use the same key, so a transient network failure during reserve
 *   doesn't create a phantom second reservation.
 *
 * The pricing engine remains the single source of truth for totals — never
 * compute subtotal/tax/shipping locally beyond the canonical engine.
 */

import { create } from "zustand";
import { storageGet, storageSet, STORAGE_KEYS } from "@/utils/storage";
import { track } from "@/lib/analytics";
import { captureError } from "@/lib/crashReporter";
import { onlineManager } from "@tanstack/react-query";
import {
  fetchUserCart,
  mergeCartItems,
  removeCartItem,
  replaceUserCart,
  upsertCartItem,
} from "@/features/cart/api";
import type { NativeProduct } from "@/services/productsApi";
import {
  createCheckoutPricing,
  isPromoCodeEligible,
  type CheckoutLineInput,
  type CheckoutPricing,
} from "@/features/checkout";
import {
  commitInventory,
  releaseInventory,
  reserveInventory,
  validateInventory,
} from "@/features/inventory";
import { newIdempotencyKey } from "@/lib/idempotency";

export interface CartItem {
  productId:      string;
  quantity:       number;
  product:        NativeProduct;
  /** Server-side inventory reservation, present after reserveInventory() lands. */
  reservationId?: string;
}

export interface ReservationError {
  productId: string;
  message:   string;
  ts:        number;
}

interface CartState {
  items:                  CartItem[];
  promoCode:              string;
  shippingFee:            number;
  isHydrated:             boolean;
  userId:                 string | null;
  /** Most recent reservation rejection — UIs subscribe to surface a toast. */
  lastReservationError:   ReservationError | null;

  // mutations
  hydrate:        (userId: string | null) => Promise<void>;
  addItem:        (product: NativeProduct, qty?: number) => void;
  removeItem:     (productId: string) => void;
  updateQty:      (productId: string, qty: number) => void;
  clearCart:      () => void;
  setPromoCode:   (code: string) => void;
  setShippingFee: (fee: number) => void;
  /** Clears the last reservation error (after the UI has shown its toast). */
  clearReservationError: () => void;

  // ── Inventory integration ──
  /**
   * Pre-flight: every cart line must have a valid (non-expired) reservation
   * before checkout submits the order. Idempotent — re-uses existing
   * reservationIds when present and only reserves missing lines.
   * Returns the failure list; an empty list means it's safe to submit.
   */
  ensureReservations: () => Promise<ReservationError[]>;
  /**
   * Post-place: convert each cart line's reservation into a 'committed' one
   * bound to the order_id. Failures are captured via captureError but do
   * NOT throw — the order is already in the DB; admin cleanup if needed.
   */
  commitReservations: (orderId: string) => Promise<{ committed: number; failed: number }>;

  // selectors
  itemCount: () => number;
  subtotal:  () => number;
  pricing:   () => CheckoutPricing;
  toCheckoutLines: () => CheckoutLineInput[];
}

/**
 * Clamp quantity against product stock — mirrors web `clampQuantity`.
 * Returns 0 when item should be dropped (no product / out of stock).
 */
function clampQuantity(product: NativeProduct | undefined, requested: number): number {
  if (!product) return 0;
  if (!product.inStock || product.stock <= 0) return 0;
  return Math.min(requested, Math.max(1, Math.floor(product.stock)));
}

function itemsToLines(items: CartItem[]): CheckoutLineInput[] {
  return items
    .filter((i) => i.product && i.product.inStock && i.product.stock > 0)
    .map((i) => ({
      productId: i.productId,
      quantity:  i.quantity,
      unitPrice: i.product.price ?? 0,
      name:      i.product.name,
      code:      i.product.code,
    }));
}

/** Best-effort server sync. Failures are logged in dev and swallowed in prod. */
function mirror(label: string, fn: () => Promise<unknown>): void {
  void fn().catch((e) => {
    if (__DEV__) console.warn(`[cart] ${label} sync failed:`, e);
  });
}

/** Parse the RPC error code/message produced by reserve_inventory. */
function parseReserveError(e: unknown): { reason: string; available?: number } {
  // Supabase throws plain PostgrestError objects (not Error instances), so we
  // must check for a .message property before falling back to String().
  const message =
    e instanceof Error
      ? e.message
      : e !== null && typeof e === "object" && "message" in e
        ? String((e as { message: unknown }).message ?? "")
        : String(e ?? "");
  // Server raises e.g. `insufficient_stock|available=2|requested=3`
  if (message.startsWith("insufficient_stock")) {
    const m = /available=(\d+)/.exec(message);
    return { reason: "insufficient_stock", available: m ? Number(m[1]) : 0 };
  }
  if (message.includes("product_not_found"))   return { reason: "product_not_found" };
  if (message.includes("invalid_quantity"))    return { reason: "invalid_quantity" };
  if (message.includes("not_authenticated"))   return { reason: "not_authenticated" };
  return { reason: "unknown" };
}

export const useCartStore = create<CartState>((set, get) => ({
  items:                 [],
  promoCode:             "",
  shippingFee:           0,
  isHydrated:            false,
  userId:                null,
  lastReservationError:  null,

  hydrate: async (userId) => {
    if (userId === null) {
      const saved = await storageGet<CartItem[]>(STORAGE_KEYS.cart);
      set({
        items:      Array.isArray(saved) ? saved : [],
        isHydrated: true,
        userId:     null,
      });
      return;
    }

    const localItems = get().items;
    try {
      const serverItems = await fetchUserCart(userId);
      const merged = mergeCartItems(localItems, serverItems);

      if (localItems.length > 0) {
        await replaceUserCart(userId, merged);
      }

      set({ items: merged, isHydrated: true, userId });
      void storageSet(STORAGE_KEYS.cart, merged);
    } catch (e) {
      if (__DEV__) console.warn("[cart.hydrate] failed, using local cache:", e);
      const saved = await storageGet<CartItem[]>(STORAGE_KEYS.cart);
      set({
        items:      Array.isArray(saved) ? saved : [],
        isHydrated: true,
        userId,
      });
    }
  },

  addItem: (product, qty = 1) => {
    let didChange = false;
    let prevReservationId: string | undefined;
    let nextQuantity = 0;

    set((s) => {
      const existing = s.items.find((i) => i.productId === product.id);
      const requested = existing ? existing.quantity + qty : qty;
      const clamped = clampQuantity(product, requested);
      if (clamped <= 0) return s;

      didChange         = true;
      prevReservationId = existing?.reservationId;
      nextQuantity      = clamped;

      // Quantity changed → existing reservation no longer matches; clear it
      // so the new reserve fires below. (Server-side release is fired in the
      // post-set block so we have the current id.)
      const next: CartItem[] = existing
        ? s.items.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: clamped, product, reservationId: undefined }
              : i,
          )
        : [...s.items, { productId: product.id, quantity: clamped, product, reservationId: undefined }];

      storageSet(STORAGE_KEYS.cart, next);
      track("product_added_to_cart", {
        product_id: product.id,
        qty_delta:  clamped - (existing?.quantity ?? 0),
        cart_size:  next.length,
      });

      if (s.userId) {
        const finalItem: CartItem = { productId: product.id, quantity: clamped, product };
        mirror("upsert", () => upsertCartItem(s.userId as string, finalItem));
      }

      return { items: next };
    });

    if (!didChange) return;

    const userId = get().userId;
    if (!userId) return; // anonymous: defer reservation until sign-in/checkout.
    if (!onlineManager.isOnline()) return; // offline: reservation deferred to ensureReservations() at checkout.

    // Release the previous reservation if quantity changed. Capture into a
    // non-nullable local so the closure below doesn't lose narrowing.
    if (prevReservationId) {
      const idToRelease: string = prevReservationId;
      mirror("release(qty-change)", () =>
        releaseInventory({
          reservationId:  idToRelease,
          reason:         "qty_change",
          idempotencyKey: newIdempotencyKey(),
        }),
      );
    }

    // Fire a fresh reserve in the background; pre-validate to avoid 400s.
    void (async () => {
      try {
        const validation = await validateInventory(product.id, nextQuantity);
        if (!validation || (validation.available ?? 0) < nextQuantity) {
          // Not enough stock — revert immediately and surface error.
          set((s) => {
            const item = s.items.find((i) => i.productId === product.id);
            if (!item) return s;
            const prevQty = item.quantity - qty;
            const realStock = validation?.available ?? 0;
            const next =
              prevQty <= 0
                ? s.items.filter((i) => i.productId !== product.id)
                : s.items.map((i) =>
                    i.productId === product.id
                      ? { ...i, quantity: prevQty, product: { ...i.product, stock: realStock > 0 ? realStock : prevQty } }
                      : i,
                  );
            storageSet(STORAGE_KEYS.cart, next);
            if (s.userId) {
              if (prevQty <= 0) {
                mirror("remove(oos)", () => removeCartItem(s.userId as string, product.id));
              } else {
                mirror("upsert(revert)", () => upsertCartItem(s.userId as string, { ...item, quantity: prevQty }));
              }
            }
            return {
              items: next,
              lastReservationError: {
                productId: product.id,
                message:
                  realStock > 0
                    ? `الكمية المتاحة فقط ${realStock}`
                    : "نفذ المخزون لهذا المنتج",
                ts: Date.now(),
              },
            };
          });
          return;
        }

        const res = await reserveInventory({
          productId:       product.id,
          quantity:        nextQuantity,
          reservationKind: "cart",
          reservationRef:  userId,
          idempotencyKey:  newIdempotencyKey(),
          expiresInSecs:   15 * 60,
        });
        set((s) => {
          const item = s.items.find((i) => i.productId === product.id);
          if (!item || item.quantity !== nextQuantity) return s; // user changed it again
          const next = s.items.map((i) =>
            i.productId === product.id ? { ...i, reservationId: res.reservation_id } : i,
          );
          storageSet(STORAGE_KEYS.cart, next);
          return { items: next };
        });
      } catch (e) {
        const parsed = parseReserveError(e);
        if (__DEV__) console.warn("[cart] reserve failed:", product.id, parsed.reason);

        // Out of stock → revert to the previous quantity (or remove entirely
        // if this was a fresh add). Surface error for the UI to show a toast.
        set((s) => {
          const item = s.items.find((i) => i.productId === product.id);
          if (!item) return s;
          const prevQty = item.quantity - qty;
          const realStock =
            parsed.reason === "insufficient_stock" && parsed.available != null
              ? parsed.available
              : prevQty;
          const next =
            prevQty <= 0
              ? s.items.filter((i) => i.productId !== product.id)
              : s.items.map((i) =>
                  i.productId === product.id
                    ? { ...i, quantity: prevQty, product: { ...i.product, stock: realStock } }
                    : i,
                );
          storageSet(STORAGE_KEYS.cart, next);

          if (s.userId) {
            if (prevQty <= 0) {
              mirror("remove(oos)", () => removeCartItem(s.userId as string, product.id));
            } else {
              mirror("upsert(revert)", () =>
                upsertCartItem(s.userId as string, { ...item, quantity: prevQty }),
              );
            }
          }

          return {
            items: next,
            lastReservationError: {
              productId: product.id,
              message:
                parsed.reason === "insufficient_stock"
                  ? parsed.available && parsed.available > 0
                    ? `الكمية المتاحة فقط ${parsed.available}`
                    : "نفذ المخزون لهذا المنتج"
                  : "تعذر حجز المخزون",
              ts: Date.now(),
            },
          };
        });
      }
    })();
  },

  removeItem: (productId) => {
    let removedReservationId: string | undefined;

    set((s) => {
      const removed = s.items.find((i) => i.productId === productId);
      removedReservationId = removed?.reservationId;
      const next = s.items.filter((i) => i.productId !== productId);
      storageSet(STORAGE_KEYS.cart, next);
      if (s.userId) {
        mirror("remove", () => removeCartItem(s.userId as string, productId));
      }
      return { items: next };
    });

    if (removedReservationId && get().userId && onlineManager.isOnline()) {
      const idToRelease: string = removedReservationId;
      mirror("release(remove)", () =>
        releaseInventory({
          reservationId:  idToRelease,
          reason:         "removed_from_cart",
          idempotencyKey: newIdempotencyKey(),
        }),
      );
    }
  },

  updateQty: (productId, qty) => {
    let prevReservationId: string | undefined;
    let nextQuantity      = 0;
    let removedEntirely   = false;
    let product: NativeProduct | undefined;

    set((s) => {
      const item = s.items.find((i) => i.productId === productId);
      const clamped = clampQuantity(item?.product, qty);

      prevReservationId = item?.reservationId;
      product           = item?.product;

      if (clamped <= 0) {
        removedEntirely = true;
        const next = s.items.filter((i) => i.productId !== productId);
        storageSet(STORAGE_KEYS.cart, next);
        if (s.userId) {
          mirror("remove(qty=0)", () => removeCartItem(s.userId as string, productId));
        }
        return { items: next };
      }

      nextQuantity = clamped;
      const next = s.items.map((i) =>
        i.productId === productId ? { ...i, quantity: clamped, reservationId: undefined } : i,
      );
      storageSet(STORAGE_KEYS.cart, next);
      if (s.userId && item) {
        mirror("upsert(qty)", () =>
          upsertCartItem(s.userId as string, { ...item, quantity: clamped }),
        );
      }
      return { items: next };
    });

    const userId = get().userId;
    if (!userId || !onlineManager.isOnline()) return;

    // Release the previous reservation regardless of next action.
    if (prevReservationId) {
      const idToRelease: string = prevReservationId;
      const reason = removedEntirely ? "qty_zero" : "qty_change";
      mirror("release(qty)", () =>
        releaseInventory({
          reservationId:  idToRelease,
          reason,
          idempotencyKey: newIdempotencyKey(),
        }),
      );
    }

    if (removedEntirely || !product) return;

    // Re-reserve the new quantity; pre-validate to reduce server 400s.
    void (async () => {
      try {
        const validation = await validateInventory(productId, nextQuantity);
        if (!validation || (validation.available ?? 0) < nextQuantity) {
          // clamp or remove immediately
          set((s) => {
            const item = s.items.find((i) => i.productId === productId);
            if (!item) return s;
            const clamp = validation?.available ?? 0;
            if (clamp <= 0) {
              const next = s.items.filter((i) => i.productId !== productId);
              storageSet(STORAGE_KEYS.cart, next);
              if (s.userId) {
                mirror("remove(oos)", () => removeCartItem(s.userId as string, productId));
              }
              return {
                items: next,
                lastReservationError: { productId, message: "نفذ المخزون لهذا المنتج", ts: Date.now() },
              };
            }
            // Write real stock ceiling back so + button is disabled correctly
            const next = s.items.map((i) =>
              i.productId === productId
                ? { ...i, quantity: clamp, product: { ...i.product, stock: clamp } }
                : i,
            );
            storageSet(STORAGE_KEYS.cart, next);
            if (s.userId) {
              mirror("upsert(clamp)", () => upsertCartItem(s.userId as string, { ...item, quantity: clamp }));
            }
            return {
              items: next,
              lastReservationError: {
                productId,
                message: `الكمية المتاحة فقط ${clamp}`,
                ts: Date.now(),
              },
            };
          });
          return;
        }

        const res = await reserveInventory({
          productId:       productId,
          quantity:        nextQuantity,
          reservationKind: "cart",
          reservationRef:  userId,
          idempotencyKey:  newIdempotencyKey(),
          expiresInSecs:   15 * 60,
        });
        set((s) => {
          const item = s.items.find((i) => i.productId === productId);
          if (!item || item.quantity !== nextQuantity) return s;
          const next = s.items.map((i) =>
            i.productId === productId ? { ...i, reservationId: res.reservation_id } : i,
          );
          storageSet(STORAGE_KEYS.cart, next);
          return { items: next };
        });
      } catch (e) {
        const parsed = parseReserveError(e);
        if (__DEV__) console.warn("[cart] re-reserve failed:", productId, parsed.reason);
        // Clamp local quantity to whatever's available, if known.
        set((s) => {
          const item = s.items.find((i) => i.productId === productId);
          if (!item) return s;
          const clamp = parsed.available ?? 0;
          if (clamp <= 0) {
            const next = s.items.filter((i) => i.productId !== productId);
            storageSet(STORAGE_KEYS.cart, next);
            if (s.userId) {
              mirror("remove(oos)", () => removeCartItem(s.userId as string, productId));
            }
            return {
              items: next,
              lastReservationError: { productId, message: "نفذ المخزون لهذا المنتج", ts: Date.now() },
            };
          }
          // Write clamp back into product.stock so isAtMax is correct going forward
          const next = s.items.map((i) =>
            i.productId === productId
              ? { ...i, quantity: clamp, product: { ...i.product, stock: clamp } }
              : i,
          );
          storageSet(STORAGE_KEYS.cart, next);
          if (s.userId) {
            mirror("upsert(clamp)", () => upsertCartItem(s.userId as string, { ...item, quantity: clamp }));
          }
          return {
            items: next,
            lastReservationError: {
              productId,
              message: `الكمية المتاحة فقط ${clamp}`,
              ts: Date.now(),
            },
          };
        });
      }
    })();
  },

  clearCart: () => {
    storageSet(STORAGE_KEYS.cart, []);
    set({ items: [], promoCode: "", userId: null });
  },

  setPromoCode:   (code) => set({ promoCode: code.trim() }),
  setShippingFee: (fee)  => set({ shippingFee: Math.max(0, fee) }),

  clearReservationError: () => set({ lastReservationError: null }),

  // ── Inventory integration ────────────────────────────────────────────────

  ensureReservations: async (): Promise<ReservationError[]> => {
    const { items, userId } = get();
    if (!userId) return []; // server-side commit_inventory will refuse anyway

    const failures: ReservationError[] = [];

    for (const item of items) {
      if (item.reservationId) continue; // already reserved during browsing

      try {
        // Pre-validate to avoid reserve_inventory 400s (insufficient_stock).
        const validation = await validateInventory(item.productId, item.quantity);
        if (!validation || (validation.available ?? 0) < item.quantity) {
          const parsedAvailable = validation?.available ?? 0;
          failures.push({
            productId: item.productId,
            message:
              parsedAvailable > 0
                ? `الكمية المتاحة فقط ${parsedAvailable}`
                : "نفذ المخزون لهذا المنتج",
            ts: Date.now(),
          });
          continue;
        }

        const res = await reserveInventory({
          productId:       item.productId,
          quantity:        item.quantity,
          reservationKind: "cart",
          reservationRef:  userId,
          idempotencyKey:  newIdempotencyKey(),
          expiresInSecs:   15 * 60,
        });
        // Patch the item with the new reservationId.
        set((s) => {
          const next = s.items.map((i) =>
            i.productId === item.productId ? { ...i, reservationId: res.reservation_id } : i,
          );
          storageSet(STORAGE_KEYS.cart, next);
          return { items: next };
        });
      } catch (e) {
        const parsed = parseReserveError(e);
        failures.push({
          productId: item.productId,
          message:
            parsed.reason === "insufficient_stock"
              ? parsed.available && parsed.available > 0
                ? `الكمية المتاحة فقط ${parsed.available}`
                : "نفذ المخزون لهذا المنتج"
              : "تعذر حجز المخزون",
          ts: Date.now(),
        });
      }
    }
    return failures;
  },

  commitReservations: async (orderId: string) => {
    const { items } = get();
    let committed = 0;
    let failed    = 0;

    for (const item of items) {
      if (!item.reservationId) {
        // Should be rare — ensureReservations() runs first. Log and continue.
        captureError(new Error("cart.commit: line lacks reservationId"), {
          surface:   "cart.commit",
          orderId,
          productId: item.productId,
          quantity:  item.quantity,
        });
        failed += 1;
        continue;
      }
      try {
        await commitInventory({
          reservationId:  item.reservationId,
          orderId,
          idempotencyKey: newIdempotencyKey(),
        });
        committed += 1;
      } catch (e) {
        failed += 1;
        captureError(e, {
          surface:        "cart.commit",
          orderId,
          productId:      item.productId,
          reservationId:  item.reservationId,
        });
      }
    }
    return { committed, failed };
  },

  itemCount: () => get().items.reduce((acc, i) => acc + i.quantity, 0),

  subtotal: () => get().pricing().subtotal,

  toCheckoutLines: () => itemsToLines(get().items),

  pricing: () => {
    const { items, promoCode, shippingFee } = get();
    return createCheckoutPricing(itemsToLines(items), {
      promoCode,
      shippingFee,
    });
  },
}));

// ─── Reactive selectors ─────────────────────────────────────────────────────

export const selectPricing = (s: CartState): CheckoutPricing =>
  createCheckoutPricing(itemsToLines(s.items), {
    promoCode:   s.promoCode,
    shippingFee: s.shippingFee,
  });

export const selectItemCount = (s: CartState): number =>
  s.items.reduce((acc, i) => acc + i.quantity, 0);

export const selectPromoApplied = (s: CartState): boolean =>
  isPromoCodeEligible(s.promoCode);

export const selectLastReservationError = (s: CartState): ReservationError | null =>
  s.lastReservationError;
