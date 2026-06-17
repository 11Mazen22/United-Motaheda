export function mapOrderStatus(status: string) {
  return { label: status, tone: "neutral" } as const;
}

export type OrderTone = "neutral" | "info" | "success" | "danger";
