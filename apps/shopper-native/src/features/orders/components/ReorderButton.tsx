import React from "react";
import { Button } from "@pharmacy/ui-native";
import { useTranslation } from "react-i18next";
import { useReorder } from "../hooks/useReorder";
import type { OrderItem } from "@/stores/orders";

export function ReorderButton({ items, size = "lg", style }: { items: OrderItem[]; size?: "sm" | "md" | "lg"; style?: Record<string, unknown> }) {
  const { t } = useTranslation();
  const { reorder, isReordering } = useReorder();

  if (!items || items.length === 0) return null;

  return (
    <Button
      label={isReordering ? t("orders.reordering", "Adding to cart...") : t("orders.reorder", "Reorder")}
      icon="refresh-outline"
      variant="primary"
      size={size}
      disabled={isReordering}
      onPress={() => reorder(items)}
      style={style}
    />
  );
}
