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
export { InventoryIntelligenceScreen }from "./screens/InventoryIntelligenceScreen";
export { BarcodeScannerScreen }       from "./screens/BarcodeScannerScreen";
export { AnalyticsDashboardScreen }   from "./screens/AnalyticsDashboardScreen";
export { PharmacistProfileScreen }    from "./screens/PharmacistProfileScreen";

// Components
export { PharmacistScreenHeader }     from "./components/PharmacistScreenHeader";
export { OrderQueueCard }             from "./components/OrderQueueCard";
export { OrderStatusChip }            from "./components/OrderStatusChip";
export { PharmacistActionDock }       from "./components/PharmacistActionDock";
