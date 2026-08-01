/**
 * Pharmacist feature barrel — public exports.
 * Import from here in route files and (pharmacist)/_layout.tsx.
 */

// Hook mounted at the layout level — one realtime subscription for the session
export { usePharmacistRealtimeSync } from "./hooks/usePharmacistRealtimeSync";

// Screens
export { WorkbenchScreen }            from "./screens/WorkbenchScreen";
export { PharmacistOrderDetailScreen }from "./screens/OrderDetailScreen";
export { PrescriptionQueueScreen }    from "./screens/PrescriptionQueueScreen";
export { PrescriptionDetailScreen }   from "./screens/PrescriptionDetailScreen";
export { InventoryScreen }            from "./screens/InventoryScreen";
export { InventoryIntelligenceScreen }from "./screens/InventoryIntelligenceScreen";
export { BarcodeScannerScreen }       from "./screens/BarcodeScannerScreen";
export { AnalyticsDashboardScreen }   from "./screens/AnalyticsDashboardScreen";
export { PharmacistProfileScreen }    from "./screens/PharmacistProfileScreen";
