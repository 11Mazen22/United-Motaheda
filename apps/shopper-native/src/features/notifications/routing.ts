import { Alert } from "react-native";
import { type Router } from "expo-router";
import type { AppNotification } from "./types";
import type { User } from "@supabase/supabase-js";

export function handleNotificationRoute(
  n: AppNotification,
  router: Router,
  user: User | null | undefined,
  t?: (key: string, defaultText: string) => string
) {
  const fallbackError = t ? t("notifications.webOnlyAction", "This notification cannot be opened here.") : "This notification cannot be opened here.";

  if (n.actionUrl) {
    let url = n.actionUrl;
    if (url.startsWith("/admin/orders")) {
      const orderMatch = url.match(/order=([a-f0-9\-]+)/);
      const orderId = orderMatch ? orderMatch[1] : (n.data as any)?.orderId;
      
      if (orderId && (user?.role === "admin" || user?.role === "manager" || user?.role === "pharmacist")) {
        router.push(`/(pharmacist)/orders/${orderId}` as never);
        return;
      } else {
        Alert.alert(fallbackError);
        return;
      }
    }
    try {
      router.push(url as never);
    } catch (e) {
      console.warn("Invalid route", url);
    }
    return;
  }

  const { type, data } = n;
  switch (type) {
    case "order.ready":
    case "order.accepted":
    case "order.out_for_delivery":
    case "order.delivered":
    case "order.cancelled":
      if (data?.orderId) {
        router.push(`/(customer)/order-tracking/${data.orderId}` as never);
        return;
      }
      break;
    case "payment.success":
    case "payment.failed":
      if (data?.orderId) {
        router.push(`/(customer)/orders/${data.orderId}` as never);
        return;
      }
      break;
    case "system.announcement":
      router.push("/(customer)/announcements" as never);
      return;
    case "promo.offer":
      if (typeof data?.link === "string") {
        router.push(data.link as never);
        return;
      }
      break;
    case "order.no_driver":
    case "order.new":
      if (data?.orderId && (user?.role === "admin" || user?.role === "manager" || user?.role === "pharmacist")) {
        router.push(`/(pharmacist)/orders/${data.orderId}` as never);
        return;
      }
      break;
  }
  Alert.alert(fallbackError);
}
