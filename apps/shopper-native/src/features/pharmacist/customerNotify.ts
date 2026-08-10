/**
 * Pharmacist customer notification helper.
 *
 * Some workflow transitions happen from the native pharmacist session and
 * therefore bypass the shared web admin notification body that normally runs
 * in the admin app. This helper uses a dedicated server-side RPC so pharmacists
 * can notify customers without broad notification-insert privileges.
 */

import { supabase } from "@/lib/supabase";

type OrderNotificationStatus = "payment_approved" | "preparing" | "ready" | "cancelled";
type PrescriptionReviewDecision = "approved" | "rejected";

const ORDER_COPY: Record<OrderNotificationStatus, { title: string; body: string }> = {
  payment_approved: {
    title: "تم اعتماد الدفع",
    body: "تمت الموافقة على الدفع وسيبدأ تجهيز طلبك قريبًا.",
  },
  preparing: {
    title: "طلبك قيد التجهيز",
    body: "بدأنا في تجهيز طلبك وسيتم إرساله قريبًا.",
  },
  ready: {
    title: "طلبك جاهز للاستلام",
    body: "تم تجهيز طلبك وانتظار السائق. يمكنك متابعة حالته من صفحة الطلب.",
  },
  cancelled: {
    title: "تم إلغاء طلبك",
    body: "تم إلغاء الطلب. تواصل معنا إذا كان لديك أي استفسار.",
  },
};

const PRESCRIPTION_COPY: Record<PrescriptionReviewDecision, { title: string; body: string }> = {
  approved: {
    title: "تمت الموافقة على وصفتك الطبية",
    body: "يمكنك الآن متابعة تفاصيلها من التطبيق.",
  },
  rejected: {
    title: "تعذّرت الموافقة على وصفتك الطبية",
    body: "يرجى التواصل مع الصيدلية لمزيد من التفاصيل.",
  },
};

export function notifyCustomerOrderUpdate(orderId: string, status: OrderNotificationStatus): void {
  const copy = ORDER_COPY[status];
  void (async () => {
    try {
      await supabase.rpc("notify_pharmacist_customer_order_update", {
        p_order_id:       orderId,
        p_event_type:     "order",
        p_category:       "order_updates",
        p_title:          copy.title,
        p_body:           copy.body,
        p_data:           { kind: "order_status", status, orderId },
        p_action_url:     `/order/${orderId}`,
        p_idempotency_key: `order:${orderId}:status:${status}`,
      });
    } catch (err) {
      if (__DEV__) {
        console.warn("[pharmacist/customerNotify] failed to enqueue notification:", err);
      }
    }
  })();
}

export function notifyCustomerPrescriptionReview(
  prescriptionId: string,
  decision: PrescriptionReviewDecision,
): void {
  const copy = PRESCRIPTION_COPY[decision];
  void (async () => {
    try {
      await supabase.rpc("notify_pharmacist_customer_prescription_review", {
        p_prescription_id: prescriptionId,
        p_decision:        decision,
        p_event_type:      "health",
        p_category:        "health_reminders",
        p_title:           copy.title,
        p_body:            copy.body,
        p_action_url:      `/prescriptions/${prescriptionId}`,
        p_idempotency_key: `prescription:${prescriptionId}:review:${decision}`,
      });
    } catch (err) {
      if (__DEV__) {
        console.warn("[pharmacist/customerNotify] failed to enqueue prescription notification:", err);
      }
    }
  })();
}
