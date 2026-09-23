import { Alert } from "react-native";
import { type Router } from "expo-router";
import type { AppNotification } from "./types";
import type { AuthUser } from "@/features/auth";

/**
 * Every real notification carries its destination as actionUrl -- a
 * role-correct path already computed server-side by whichever RPC/trigger
 * enqueued it (see enqueue_notification's callers across the SQL
 * migrations, e.g. "/(pharmacist)/order/<id>", "/(driver)/offer/<id>",
 * "/order/<id>"). The `type` column only ever holds one of the four
 * generic buckets ("order" | "offer" | "health" | "system" --
 * confirmed against live data), never the granular per-event strings
 * ("order.ready", "driver.assigned", etc.) a per-type switch here would
 * need to branch on -- so a type-based fallback could never actually
 * match a real row. services/pushNotificationManager.ts's push-tap handler
 * reads actionUrl the same way, so both surfaces agree on one source of truth.
 */
export function handleNotificationRoute(
  n: AppNotification,
  router: Router,
  user: AuthUser | null | undefined,
  t?: (key: string, defaultText: string) => string
) {
  const fallbackError = t ? t("notifications.webOnlyAction", "This notification cannot be opened here.") : "This notification cannot be opened here.";

  if (!n.actionUrl) {
    Alert.alert(fallbackError);
    return;
  }

  const url = n.actionUrl;
  if (url.startsWith("/admin/orders")) {
    const orderMatch = url.match(/order=([a-f0-9\-]+)/);
    const orderId = orderMatch ? orderMatch[1] : (n.data as any)?.orderId;

    if (orderId && (user?.role === "admin" || user?.role === "manager" || user?.role === "pharmacist")) {
      router.push(`/(pharmacist)/order/${orderId}` as never);
    } else {
      Alert.alert(fallbackError);
    }
    return;
  }

  try {
    router.push(url as never);
  } catch (e) {
    console.warn("Invalid route", url);
    Alert.alert(fallbackError);
  }
}
