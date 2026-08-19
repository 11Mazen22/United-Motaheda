import { useState, useCallback } from "react";
import { useCartStore } from "@/stores/cart";
import { fetchProductById } from "@/features/products/api/productsApi";
import type { OrderItem } from "@/stores/orders";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

export function useReorder() {
  const [isReordering, setIsReordering] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const router = useRouter();

  const reorder = useCallback(async (items: OrderItem[]) => {
    if (!items.length) return;
    setIsReordering(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      
      const promises = items.map(i => fetchProductById(i.productId));
      const products = await Promise.all(promises);
      
      let addedCount = 0;
      
      products.forEach((prod, i) => {
        if (prod && prod.inStock && prod.stock > 0) {
          const reqQty = Math.min(items[i].quantity, prod.stock);
          addItem(prod, reqQty);
          addedCount++;
        }
      });
      
      Haptics.notificationAsync(
        addedCount > 0 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Warning
      ).catch(() => {});
      
      if (addedCount > 0) {
        router.push("/(customer)/(tabs)/cart");
      }
    } catch (e) {
      console.error("Reorder failed", e);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsReordering(false);
    }
  }, [addItem, router]);

  return { reorder, isReordering };
}
