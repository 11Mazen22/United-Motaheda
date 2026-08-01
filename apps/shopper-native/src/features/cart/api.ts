/**
 * Cart sync API — Supabase-backed `cart_items` table.
 *
 * The cart store treats its in-memory list as the live view and uses these
 * functions to mirror mutations server-side in the background. On sign-in,
 * `fetchUserCart` returns the server's view; the caller merges with any
 * local pre-sign-in items and pushes the merged result back via `replaceUserCart`.
 */

import { supabase } from "@/lib/supabase";
import { timed } from "@/lib/devTiming";
import type { NativeProduct } from "@/services/productsApi";
import type { CartItem } from "@/stores/cart";

interface CartItemRow {
  id:               string;
  user_id:          string;
  product_id:       string;
  quantity:         number;
  product_snapshot: NativeProduct;
  updated_at:       string;
}

function rowToCartItem(row: CartItemRow): CartItem {
  return {
    productId: row.product_id,
    quantity:  row.quantity,
    product:   row.product_snapshot,
  };
}

export async function fetchUserCart(userId: string): Promise<CartItem[]> {
  const { data, error } = await timed(
    "cart:fetchUserCart",
    () =>
      supabase
        .from("cart_items")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
  );
  if (error) throw error;
  return (data as CartItemRow[] | null ?? []).map(rowToCartItem);
}

/** Insert or update a single line. Uses the unique(user_id, product_id)
 *  constraint to upsert. */
export async function upsertCartItem(
  userId: string,
  item:   CartItem,
): Promise<void> {
  const { error } = await timed(
    "cart:upsertCartItem",
    () =>
      supabase
        .from("cart_items")
        .upsert(
          {
            user_id:          userId,
            product_id:       item.productId,
            quantity:         item.quantity,
            product_snapshot: item.product,
            updated_at:       new Date().toISOString(),
          },
          { onConflict: "user_id,product_id" },
        ),
  );
  if (error) throw error;
}

export async function removeCartItem(userId: string, productId: string): Promise<void> {
  const { error } = await timed(
    "cart:removeCartItem",
    () =>
      supabase
        .from("cart_items")
        .delete()
        .eq("user_id",    userId)
        .eq("product_id", productId),
  );
  if (error) throw error;
}

/** Wipe the user's server cart. Used by sign-out flow (NOT the wipe — server
 *  data should normally survive sign-out so re-sign-in restores it) and by
 *  checkout success (cart is "consumed" by the placed order). */
export async function clearUserCart(userId: string): Promise<void> {
  const { error } = await timed(
    "cart:clearUserCart",
    () =>
      supabase
        .from("cart_items")
        .delete()
        .eq("user_id", userId),
  );
  if (error) throw error;
}

/**
 * Replace the user's entire cart with a new set of items.
 *
 * Implementation: bulk UPSERT then delete any product_ids not in the new set.
 * This is safer than delete-then-insert: if the "new rows" write fails the
 * old cart still exists server-side, so nothing is lost.
 *
 * The unique(user_id, product_id) constraint on cart_items makes the upsert
 * idempotent — re-running after a partial failure produces the same result.
 */
export async function replaceUserCart(userId: string, items: CartItem[]): Promise<void> {
  if (items.length === 0) {
    await clearUserCart(userId);
    return;
  }

  const rows = items.map((item) => ({
    user_id:          userId,
    product_id:       item.productId,
    quantity:         item.quantity,
    product_snapshot: item.product,
    updated_at:       new Date().toISOString(),
  }));

  // 1. Upsert new rows — safe, idempotent
  const { error: upsertError } = await timed(
    "cart:replaceUserCart upsert",
    () =>
      supabase
        .from("cart_items")
        .upsert(rows, { onConflict: "user_id,product_id" }),
  );
  if (upsertError) throw upsertError;

  // 2. Delete product_ids that are no longer in the cart
  const keepIds = items.map((i) => i.productId);
  const { error: deleteError } = await timed(
    "cart:replaceUserCart prune",
    () =>
      supabase
        .from("cart_items")
        .delete()
        .eq("user_id", userId)
        .not("product_id", "in", `(${keepIds.map((id) => `"${id}"`).join(",")})`),
  );
  if (deleteError) throw deleteError;
}

/**
 * Merge two cart lists by productId.
 *
 * Strategy (updated from sum to max):
 *   - The server snapshot wins on product data (it may have fresher pricing)
 *   - Quantity is the MAXIMUM of the two sides, capped at product.stock
 *
 * Rationale: summing quantities was a bug — a user browsing anonymously who
 * added 2 units, then signed in and had 2 on their server cart, ended up with
 * 4 units regardless of stock. Taking the max is the correct behaviour:
 * "the user wanted at least this many" without exceeding what was intended.
 */
export function mergeCartItems(local: CartItem[], server: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();

  // Seed with server items first so their product snapshot takes priority.
  for (const it of server) map.set(it.productId, { ...it });

  for (const it of local) {
    const existing = map.get(it.productId);
    if (existing) {
      // Take the higher quantity of the two sides, but never exceed stock.
      const stock    = existing.product?.stock ?? it.product?.stock ?? Infinity;
      const merged   = Math.min(Math.max(existing.quantity, it.quantity), stock);
      map.set(it.productId, { ...existing, quantity: merged });
    } else {
      map.set(it.productId, { ...it });
    }
  }

  return Array.from(map.values());
}
