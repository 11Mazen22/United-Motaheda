/**
 * Driver feature — barrel.
 *
 * Public surface: screens, mutation/query hooks, and the API types screens
 * need. Row-mapping internals stay in api.ts, deep-imported only from
 * within this feature.
 */

export { DriverManifest }         from "./screens/DriverManifest";
export { AssignmentOffersList }   from "./screens/AssignmentOffersList";
export { AssignmentOfferDetail }  from "./screens/AssignmentOfferDetail";
export { DeliveryExecutionScreen } from "./screens/DeliveryExecutionScreen";
export { IssueReportScreen }      from "./screens/IssueReportScreen";
export { DriverScreenHeader }      from "./components/DriverScreenHeader";

export {
  useDriverManifest,
  useDriverOffers,
  useDriverOffer,
  useMyAssignmentForOrder,
  useDriverOrderDetail,
  useMyIssuesForOrder,
  driverQueryKeys,
  invalidateDriverLists,
} from "./hooks/useDriverManifest";

export { useDriverMutations } from "./hooks/useDriverMutations";
export { useDriverRealtimeSync } from "./hooks/useDriverRealtimeSync";

export type {
  ManifestOrder,
  DeliveryAssignment,
  DeliveryIssue,
  IssueReasonCode,
  AssignmentResponseStatus,
} from "./api";
