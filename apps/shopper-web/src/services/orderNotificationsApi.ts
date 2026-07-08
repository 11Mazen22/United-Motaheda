/**
 * orderNotificationsApi.ts — automated customer/driver notifications for
 * order & delivery lifecycle events.
 *
 * Mirrors the fire-and-forget pattern already established in
 * adminPrescriptionsApi.ts's notifyCustomer(): a failed notification insert
 * must never block or fail the underlying order/payment mutation, since the
 * DB write it's reporting on has already succeeded by the time this runs.
 *
 * The order-status vocabulary is not unified across the codebase yet
 * (OrdersManager.tsx writes pending/processing/shipped/delivered/cancelled,
 * while the Operations Hub / logistics board writes the canonical
 * pending/confirmed/preparing/ready/picked_up/delivered/cancelled via
 * mapLegacyToCanonicalOrderStatus) — classifyOrderStatus() below absorbs
 * that split so both call sites produce the correct customer-facing message.
 */

import { getSupabaseClient } from "../lib/supabaseClient";
import { sendExpoPushToUser } from "./pushNotifications";

type OrderNotifBucket = "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

function classifyOrderStatus(status: string): OrderNotifBucket | null {
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "processing":
    case "preparing":
      return "preparing";
    case "shipped":
    case "picked_up":
      return "out_for_delivery";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
    default:
      // pending / pending_payment / ready / anything else: not a moment
      // worth interrupting the customer for.
      return null;
  }
}

const STATUS_COPY: Record<OrderNotifBucket, { title: string; body: string }> = {
  confirmed: {
    title: "تم تأكيد طلبك",
    body: "جارٍ تجهيز طلبك الآن.",
  },
  preparing: {
    title: "طلبك قيد التجهيز",
    body: "بدأنا في تجهيز طلبك وسيتم إرساله قريبًا.",
  },
  out_for_delivery: {
    title: "طلبك في الطريق إليك",
    body: "انطلق طلبك للتوصيل. تابع حالته من صفحة الطلب.",
  },
  delivered: {
    title: "تم توصيل طلبك",
    body: "نتمنى أن تكون قد استلمت طلبك بحالة جيدة.",
  },
  cancelled: {
    title: "تم إلغاء طلبك",
    body: "تم إلغاء الطلب. تواصل معنا إذا كان لديك أي استفسار.",
  },
};

async function fetchOrderUserId(orderId: string): Promise<string | null> {
  const { data } = await getSupabaseClient()
    .from("orders")
    .select("user_id")
    .eq("id", orderId)
    .maybeSingle();
  return (data as { user_id: string | null } | null)?.user_id ?? null;
}

async function insertNotification(params: {
  userId: string;
  title: string;
  body: string;
  actionUrl: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const { data: inserted, error } = await getSupabaseClient()
    .from("notifications")
    .insert({
      user_id: params.userId,
      type: "order",
      category: "order_updates",
      title: params.title,
      body: params.body,
      data: params.data,
      action_url: params.actionUrl,
      is_read: false,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[orderNotificationsApi] notification insert failed:", error.message);
  }

  // Forward to the OS notification tray. This used to only happen for
  // admin-composed broadcasts (NotificationsManager) — every automated
  // trigger below only wrote a DB row, invisible unless the app was already
  // open. Routing all of them through this one shared insertNotification()
  // chokepoint means fixing it here covers all six call sites at once.
  //
  // notification_id rides along so the native tap handler can mark this
  // exact row read without an extra round-trip to look it up.
  try {
    await sendExpoPushToUser(params.userId, {
      title: params.title,
      body: params.body,
      data: {
        ...params.data,
        action_url: params.actionUrl,
        notification_id: (inserted as { id?: string } | null)?.id,
      },
    });
  } catch (err) {
    console.error("[orderNotificationsApi] push forward failed:", err);
  }
}

/** Best-effort: notify the customer their order's status changed. No-op for
 * internal-only statuses (pending, ready, etc.) or orders with no user_id. */
export function notifyOrderStatusChange(orderId: string, status: string): void {
  const bucket = classifyOrderStatus(status);
  if (!bucket) return;

  void (async () => {
    try {
      const userId = await fetchOrderUserId(orderId);
      if (!userId) return;

      const copy = STATUS_COPY[bucket];
      await insertNotification({
        userId,
        title: copy.title,
        body: copy.body,
        actionUrl: `/order/${orderId}`,
        data: { kind: "order_status", status: bucket, orderId },
      });
    } catch (err) {
      console.error("[orderNotificationsApi] notifyOrderStatusChange failed:", err);
    }
  })();
}

/** Best-effort: notify the customer their manual-payment proof was reviewed. */
export function notifyPaymentStatusChange(
  orderId: string,
  decision: "verified" | "rejected",
  reason?: string,
): void {
  void (async () => {
    try {
      const userId = await fetchOrderUserId(orderId);
      if (!userId) return;

      const title = decision === "verified" ? "تم تأكيد الدفع" : "مشكلة في عملية الدفع";
      const body = decision === "verified"
        ? "تم التحقق من عملية الدفع الخاصة بطلبك بنجاح."
        : (reason?.trim() || "تعذّر التحقق من إثبات الدفع. يرجى إعادة رفع الإيصال أو التواصل معنا.");

      await insertNotification({
        userId,
        title,
        body,
        actionUrl: `/order/${orderId}`,
        data: { kind: "payment_status", decision, orderId },
      });
    } catch (err) {
      console.error("[orderNotificationsApi] notifyPaymentStatusChange failed:", err);
    }
  })();
}

/** Best-effort: notify the assigned driver they have a new delivery.
 * Drivers are profiles (auth users) with role='driver', so driverId IS a
 * notifications.user_id — same table, same realtime channel as customers. */
export function notifyDriverAssigned(orderId: string, driverId: string): void {
  void (async () => {
    try {
      await insertNotification({
        userId: driverId,
        title: "تم تعيين طلب جديد لك",
        body: "تم تعيينك لتوصيل طلب جديد. راجع قائمة المهام الخاصة بك.",
        // Native app route group (app/(driver)/) — the richer driver
        // experience drivers actually use day-to-day; expo-router resolves
        // this route-group path the same way Redirect href="/(tabs)" does
        // elsewhere in that app. The legacy web driver tool at /driver has
        // no notification bell of its own, so nothing there consumes this.
        actionUrl: "/(driver)",
        data: { kind: "driver_assignment", orderId },
      });
    } catch (err) {
      console.error("[orderNotificationsApi] notifyDriverAssigned failed:", err);
    }
  })();
}

/** Best-effort: notify a driver that an order they had (or were offered) has
 * been reassigned to someone else — fires when staff manually reassigns. */
export function notifyDriverUnassigned(orderId: string, previousDriverId: string): void {
  void (async () => {
    try {
      await insertNotification({
        userId: previousDriverId,
        title: "تم سحب طلب منك",
        body: "تم إسناد هذا الطلب لسائق آخر. يمكنك متابعة باقي مهامك.",
        // Native app route group (app/(driver)/) — the richer driver
        // experience drivers actually use day-to-day; expo-router resolves
        // this route-group path the same way Redirect href="/(tabs)" does
        // elsewhere in that app. The legacy web driver tool at /driver has
        // no notification bell of its own, so nothing there consumes this.
        actionUrl: "/(driver)",
        data: { kind: "driver_unassigned", orderId },
      });
    } catch (err) {
      console.error("[orderNotificationsApi] notifyDriverUnassigned failed:", err);
    }
  })();
}

/** Best-effort: notify a driver that staff reviewed the delivery issue they
 * reported. */
export function notifyIssueResolved(orderId: string, driverId: string): void {
  void (async () => {
    try {
      await insertNotification({
        userId: driverId,
        title: "تم مراجعة المشكلة المُبلغ عنها",
        body: "راجع فريق العمليات مشكلتك الخاصة بالطلب. تحقق من التفاصيل.",
        // Native app route group (app/(driver)/) — the richer driver
        // experience drivers actually use day-to-day; expo-router resolves
        // this route-group path the same way Redirect href="/(tabs)" does
        // elsewhere in that app. The legacy web driver tool at /driver has
        // no notification bell of its own, so nothing there consumes this.
        actionUrl: "/(driver)",
        data: { kind: "issue_resolved", orderId },
      });
    } catch (err) {
      console.error("[orderNotificationsApi] notifyIssueResolved failed:", err);
    }
  })();
}
