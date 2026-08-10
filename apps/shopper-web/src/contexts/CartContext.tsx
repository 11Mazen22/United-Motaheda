import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { emitWorkflowEvent } from "@pharmacy/domain-core";
import type { CatalogProduct } from "../app/catalog";
import { createCheckoutPricing } from "../app/checkout/pricing";
import { useCatalogOptional } from "./CatalogContext";
import { useAuth } from "./AuthContext";
import { fetchProductsByIds } from "../services/shopperCatalogApi";
import {
  parseReserveError,
  releaseInventory,
  reserveInventory,
} from "../services/shopperInventoryApi";

export type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  lineTotal: number;
  product: CatalogProduct;
  reservationId?: string;
  reservationExpiresAt?: string;
};

export type CartSummary = {
  itemCount: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
};

export type ReservationError = {
  productId: string;
  message: string;
};

type StoredCartEntry = {
  product_id: string;
  quantity: number;
  reservationId?: string;
  reservationExpiresAt?: string;
};

type CartContextType = {
  cart: CartItem[];
  summary: CartSummary;
  /** Pass the full product object — no ID lookup needed at add time. */
  addToCart: (product: CatalogProduct, quantity?: number) => Promise<void>;
  removeFromCart: (cartItemId: string) => Promise<void>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  setCartReservation: (productId: string, reservationId?: string, reservationExpiresAt?: string) => void;
  isLoading: boolean;
};

const LOCAL_CART_KEY = "united-pharmacies-cart-v3";

const CartContext = createContext<CartContextType>({
  cart: [],
  summary: { itemCount: 0, subtotal: 0, discount: 0, tax: 0, shipping: 0, total: 0 },
  addToCart:      async () => {},
  removeFromCart: async () => {},
  updateQuantity: async () => {},
  clearCart:      async () => {},
  setCartReservation: () => {},
  isLoading: false,
});

function readLocalCart() {
  if (typeof window === "undefined") {
    return [] as StoredCartEntry[];
  }

  try {
    const rawValue = window.localStorage.getItem(LOCAL_CART_KEY);

    if (!rawValue) {
      return [] as StoredCartEntry[];
    }

    const parsed = JSON.parse(rawValue) as StoredCartEntry[];

    return Array.isArray(parsed)
      ? parsed.filter((entry) =>
          entry &&
          typeof entry.product_id === "string" &&
          typeof entry.quantity === "number" &&
          (entry.reservationId === undefined || typeof entry.reservationId === "string") &&
          (entry.reservationExpiresAt === undefined || typeof entry.reservationExpiresAt === "string"),
        )
      : [];
  } catch {
    return [] as StoredCartEntry[];
  }
}

function writeLocalCart(entries: StoredCartEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(entries));
}

function normalizeEntries(entries: StoredCartEntry[]) {
  const merged = new Map<string, StoredCartEntry>();

  entries.forEach((entry) => {
    if (!entry?.product_id || typeof entry.quantity !== "number" || entry.quantity <= 0) {
      return;
    }

    const existing = merged.get(entry.product_id);
    if (!existing) {
      merged.set(entry.product_id, { ...entry });
      return;
    }

    merged.set(entry.product_id, {
      product_id: entry.product_id,
      quantity: existing.quantity + entry.quantity,
      reservationId: existing.reservationId ?? entry.reservationId,
      reservationExpiresAt: existing.reservationExpiresAt ?? entry.reservationExpiresAt,
    });
  });

  return Array.from(merged.values());
}

function clampQuantity(product: CatalogProduct | undefined, quantity: number) {
  if (!product) {
    return 0;
  }

  const normalizedQuantity = Math.max(0, Math.floor(quantity));

  if (!product.inStock) {
    return 0;
  }

  if (product.stock <= 0) {
    return 0;
  }

  return Math.min(normalizedQuantity, Math.max(1, Math.ceil(product.stock)));
}

function replaceEntry(entries: StoredCartEntry[], productId: string, quantity: number) {
  const currentItem = entries.find((entry) => entry.product_id === productId);
  const nextEntries = entries.filter((entry) => entry.product_id !== productId);

  if (quantity > 0) {
    const nextEntry: StoredCartEntry = { product_id: productId, quantity };
    if (currentItem && currentItem.quantity === quantity) {
      nextEntry.reservationId = currentItem.reservationId;
      nextEntry.reservationExpiresAt = currentItem.reservationExpiresAt;
    }
    nextEntries.push(nextEntry);
  }

  return normalizeEntries(nextEntries);
}

function inflateEntries(entries: StoredCartEntry[], productsById: Record<string, CatalogProduct>) {
  return normalizeEntries(entries)
    .map((entry) => {
      const product = productsById[entry.product_id];

      if (!product || !product.inStock) {
        return null;
      }

      const clampedQuantity = clampQuantity(product, entry.quantity);
      if (clampedQuantity <= 0) {
        return null;
      }

      const isExpired = entry.reservationExpiresAt
        ? Date.parse(entry.reservationExpiresAt) <= Date.now()
        : false;

      return {
        id: entry.product_id,
        product_id: entry.product_id,
        quantity: clampedQuantity,
        lineTotal: Number((product.price * clampedQuantity).toFixed(2)),
        product,
        reservationId: clampedQuantity === entry.quantity && !isExpired ? entry.reservationId : undefined,
        reservationExpiresAt:
          clampedQuantity === entry.quantity && !isExpired ? entry.reservationExpiresAt : undefined,
      } satisfies CartItem;
    })
    .filter(Boolean) as CartItem[];
}

export function CartProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalogOptional();
  const productsById = catalog?.productsById ?? {};

  if (process.env.NODE_ENV !== "production" && !catalog) {
    console.warn(
      "[CartContext] CartProvider rendered without a CatalogProvider. " +
      "Cart hydration will continue once catalog data is available.",
    );
  }

  const [entries, setEntries] = useState<StoredCartEntry[]>(() => readLocalCart());

  // Products fetched from Supabase for cart entries whose IDs are not in the
  // page-1 cache (e.g. items added from page 2+, then reloaded).
  const [fetchedProducts, setFetchedProducts] = useState<Record<string, CatalogProduct>>({});
  const fetchedRef = useRef<Record<string, CatalogProduct>>({});

  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : false,
  );
  const pendingReservationProductIds = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const missingIds = entries
      .map((e) => e.product_id)
      .filter((id) => !productsById[id] && !fetchedRef.current[id]);

    if (missingIds.length === 0) return;

    void fetchProductsByIds(missingIds).then((fetched) => {
      if (fetched.length === 0) return;
      fetched.forEach((p) => { fetchedRef.current[p.id] = p; });
      setFetchedProducts({ ...fetchedRef.current });
    });
  }, [entries, productsById]);

  useEffect(() => {
    if (!user?.id || !isOnline) return;

    entries.forEach((entry) => {
      if (entry.quantity <= 0) return;
      if (entry.reservationId && !isReservationExpired(entry)) return;
      void reserveCartEntry(entry);
    });
  }, [entries, user?.id, isOnline]);

  const mergedProductsById = useMemo(
    () => ({ ...fetchedProducts, ...productsById }),
    [productsById, fetchedProducts],
  );

  const cart = useMemo(() => inflateEntries(entries, mergedProductsById), [entries, mergedProductsById]);

  function isReservationExpired(entry: StoredCartEntry) {
    return Boolean(
      entry.reservationExpiresAt && Date.parse(entry.reservationExpiresAt) <= Date.now(),
    );
  }

  async function reserveCartEntry(entry: StoredCartEntry) {
    if (!user?.id || !isOnline) return;
    if (entry.quantity <= 0) return;
    if (entry.reservationId && !isReservationExpired(entry)) return;
    if (pendingReservationProductIds.current[entry.product_id]) return;

    pendingReservationProductIds.current[entry.product_id] = true;
    const reservationProductId = entry.product_id;
    const reservationQuantity = entry.quantity;

    try {
      const res = await reserveInventory({
        productId:       reservationProductId,
        quantity:        reservationQuantity,
        reservationKind: "cart",
        reservationRef:  user.id,
        idempotencyKey:  crypto.randomUUID(),
        expiresInSecs:   15 * 60,
      });

      setEntries((current) =>
        current.map((item) =>
          item.product_id === reservationProductId && item.quantity === reservationQuantity
            ? {
                ...item,
                reservationId:       res.reservation_id,
                reservationExpiresAt: res.expires_at,
              }
            : item,
        ),
      );
    } catch (e) {
      const parsed = parseReserveError(e);
      if (process.env.NODE_ENV !== "production") {
        console.warn("[CartContext] reserveInventory failed:", reservationProductId, parsed);
      }

      setEntries((current) => {
        const currentItem = current.find((item) => item.product_id === reservationProductId);
        if (!currentItem || currentItem.quantity !== reservationQuantity) return current;

        if (parsed.reason === "insufficient_stock") {
          const available = parsed.available ?? 0;
          if (available <= 0) {
            return current.filter((item) => item.product_id !== reservationProductId);
          }
          return current.map((item) =>
            item.product_id === reservationProductId
              ? {
                  ...item,
                  quantity: available,
                  reservationId: undefined,
                  reservationExpiresAt: undefined,
                }
              : item,
          );
        }

        if (parsed.reason === "product_not_found" || parsed.reason === "invalid_quantity") {
          return current.filter((item) => item.product_id !== reservationProductId);
        }

        return current;
      });
    } finally {
      delete pendingReservationProductIds.current[reservationProductId];
    }
  }

  function releaseReservation(reservationId: string, reason: string) {
    if (!reservationId || !user?.id || !isOnline) return;

    void (async () => {
      try {
        await releaseInventory({
          reservationId,
          reason,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[CartContext] releaseInventory failed:", reservationId, e);
        }
      }
    })();
  }

  // TRUE once we have loaded at least one product from the catalog or a
  // direct fetch. Used to gate the entry-sync effect below.
  const hasProductData = Object.keys(mergedProductsById).length > 0;

  useEffect(() => {
    // ─── Guard: never wipe stored entries before product data has loaded. ───
    // On a hard reload, `entries` comes from localStorage but `mergedProductsById`
    // is empty because the catalog hasn't hydrated yet.  Without this guard the
    // inflated `cart` is [] (no products found), which overwrites localStorage
    // with an empty array and permanently loses the user's cart.
    if (!hasProductData) return;

    const normalizedCartEntries = cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      reservationId: item.reservationId,
      reservationExpiresAt: item.reservationExpiresAt,
    }));

    setEntries((current) => {
      const currentSerialized = JSON.stringify(normalizeEntries(current));
      const nextSerialized = JSON.stringify(normalizedCartEntries);
      return currentSerialized === nextSerialized ? current : normalizedCartEntries;
    });
  }, [cart, hasProductData]);

  useEffect(() => {
    writeLocalCart(entries);
  }, [entries]);

  const summary = useMemo<CartSummary>(() => {
    const pricing = createCheckoutPricing(
      cart.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.product.price,
        name: item.product.name,
        code: item.product.code || undefined,
      })),
      {
        shippingFee: 0,
      },
    );

    return {
      itemCount: pricing.itemCount,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      tax: pricing.tax,
      shipping: pricing.shipping,
      total: pricing.total,
    };
  }, [cart]);

  const addToCart = async (product: CatalogProduct, quantity = 1) => {
    if (!product.inStock) return;

    // Cache the product immediately so inflateEntries can resolve it on next
    // render — critical for products from page 2+ that aren't in productsById.
    if (!fetchedRef.current[product.id]) {
      fetchedRef.current[product.id] = product;
      setFetchedProducts((prev) => ({ ...prev, [product.id]: product }));
    }

    let prevReservationId: string | undefined;
    let nextQuantity = 0;
    let quantityUnchanged = false;

    setEntries((current) => {
      const currentItem = current.find((entry) => entry.product_id === product.id);
      prevReservationId = currentItem?.reservationId;
      nextQuantity = clampQuantity(product, (currentItem?.quantity ?? 0) + quantity);
      if (currentItem && currentItem.quantity === nextQuantity) {
        quantityUnchanged = true;
        return current;
      }
      return replaceEntry(current, product.id, nextQuantity);
    });

    if (quantityUnchanged) {
      emitWorkflowEvent("CartUpdated", { mutation: "add", productId: product.id, quantity });
      return;
    }

    if (prevReservationId && user?.id && isOnline) {
      releaseReservation(prevReservationId, "qty_change");
    }

    if (user?.id && isOnline && nextQuantity > 0) {
      void reserveCartEntry({
        product_id: product.id,
        quantity: nextQuantity,
      });
    }

    emitWorkflowEvent("CartUpdated", { mutation: "add", productId: product.id, quantity });
  };

  const removeFromCart = async (cartItemId: string) => {
    let removedReservationId: string | undefined;

    setEntries((current) => {
      const removed = current.find((entry) => entry.product_id === cartItemId);
      removedReservationId = removed?.reservationId;
      return replaceEntry(current, cartItemId, 0);
    });

    if (removedReservationId && user?.id && isOnline) {
      releaseReservation(removedReservationId, "removed_from_cart");
    }

    emitWorkflowEvent("CartUpdated", { mutation: "remove", productId: cartItemId });
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    const product = mergedProductsById[cartItemId];
    const nextQuantity = clampQuantity(product, quantity);

    let prevReservationId: string | undefined;
    let removedEntirely = false;

    setEntries((current) => {
      const currentItem = current.find((entry) => entry.product_id === cartItemId);
      if (!currentItem) return current;

      if (currentItem.quantity === nextQuantity) {
        return current;
      }

      prevReservationId = currentItem.reservationId;
      if (nextQuantity <= 0) {
        removedEntirely = true;
        return replaceEntry(current, cartItemId, 0);
      }

      return replaceEntry(current, cartItemId, nextQuantity);
    });

    if (prevReservationId && user?.id && isOnline) {
      releaseReservation(prevReservationId, removedEntirely ? "qty_zero" : "qty_change");
    }

    if (user?.id && isOnline && !removedEntirely && nextQuantity > 0) {
      void reserveCartEntry({
        product_id: cartItemId,
        quantity: nextQuantity,
      });
    }

    emitWorkflowEvent("CartUpdated", { mutation: "update", productId: cartItemId, quantity: nextQuantity });
  };

  const clearCart = async () => {
    let reservationIds: string[] = [];

    setEntries((current) => {
      reservationIds = current.map((entry) => entry.reservationId).filter(Boolean) as string[];
      return [];
    });

    if (reservationIds.length > 0 && user?.id && isOnline) {
      reservationIds.forEach((reservationId) =>
        releaseReservation(reservationId, "cart_cleared"),
      );
    }

    emitWorkflowEvent("CartUpdated", { mutation: "clear" });
  };

  const setCartReservation = (productId: string, reservationId?: string, reservationExpiresAt?: string) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.product_id === productId
          ? { ...entry, reservationId, reservationExpiresAt }
          : entry,
      ),
    );
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        summary,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        setCartReservation,
        isLoading: false,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
