/**
 * Pharmacist TanStack Query key factory.
 *
 * Follows the same pattern as driverQueryKeys in features/driver/hooks/useDriverManifest.ts:
 * typed const-tuples so invalidateQueries narrows correctly.
 */

export const pharmacistQueryKeys = {
  dashboard:          ()         => ["pharmacist", "dashboard"]         as const,
  orderQueue:         ()         => ["pharmacist", "orders", "queue"]   as const,
  order:              (id: string) => ["pharmacist", "orders", id]      as const,
  prescriptionQueue:  ()         => ["pharmacist", "prescriptions", "queue"] as const,
  prescriptions:      (status?: string) =>
    status
      ? ["pharmacist", "prescriptions", "list", status] as const
      : ["pharmacist", "prescriptions", "list"]         as const,
  prescription:       (id: string) => ["pharmacist", "prescriptions", id]  as const,
  products:           (query: string) => ["pharmacist", "products", query] as const,
  lowStock:           ()         => ["pharmacist", "products", "lowstock"] as const,
};
