/**
 * customerNotify — fires the same customer-facing order-status notification
 * apps/shopper-web/src/services/orderNotificationsApi.ts's
 * notifyOrderStatusChange sends, but from the DRIVER's own native session.
 *
 * Why this exists as a separate path: when a driver confirms pickup or
 * marks a delivery complete from the native (driver) section, that write
 * goes straight to Supabase from this app — it never touches the web
 * admin's adminUpdateOrderStatus/updateManagedOrderStatus functions, which
 * are the only place notifyOrderStatusChange is currently wired in. Without
 * this, a driver-driven status change would silently never notify the
 * customer. RLS backs this: see database/20260710_driver_notify_customer.sql
 * — a driver may only insert a notification for the customer of an order
 * currently assigned to them, nothing broader.
 *
 * Copy is kept in exact sync with orderNotificationsApi.ts's Arabic strings
 * for the two buckets a driver can actually trigger (picked_up, delivered) —
 * this app can't import that web-only file directly (different Supabase
 * client, not a shared package), so the strings are intentionally
 * duplicated rather than abstracted across the two runtimes.
 */

import { supabase } from "@/lib/supabase";

const COPY: Record<"picked_up" | "delivered", { title: string; body: string }> = {
  picked_up: {
    title: "طلبك في الطريق إليك",
    body: "انطلق طلبك للتوصيل. تابع حالته من صفحة الطلب.",
  },
  delivered: {
    title: "تم توصيل طلبك",
    body: "نتمنى أن تكون قد استلمت طلبك بحالة جيدة.",
  },
};

/** Best-effort — a failed notification insert must never fail the pickup/
 * delivery confirmation itself (the order status update already succeeded). */
export function notifyCustomerOrderUpdate(orderId: string, status: "picked_up" | "delivered"): void {
  void (async () => {
    try {
      const { data } = await supabase.from("orders").select("user_id").eq("id", orderId).maybeSingle();
      const userId = (data as { user_id: string | null } | null)?.user_id;
      if (!userId) return;

      const copy = COPY[status];
      const { error } = await supabase.rpc("enqueue_notification", {
        p_recipient_id: userId,
        p_event_type: "order",
        p_category: "order_updates",
        p_title: copy.title,
        p_body: copy.body,
        p_data: { kind: "order_status", status, orderId },
        p_action_url: `/order/${orderId}`,
        p_idempotency_key: `order:${orderId}:status:${status}`,
      });
      if (error && __DEV__) {
        console.warn("[driver/customerNotify] insert failed:", error.message);
      }
    } catch (err) {
      if (__DEV__) console.warn("[driver/customerNotify] failed:", err);
    }
  })();
}
