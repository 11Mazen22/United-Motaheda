import type { DeliveryStage, StageAction } from "../lib/deliveryStage";

export type {
  ManifestOrder,
  DeliveryAssignment,
  AssignmentOffer,
  DeliveryIssue,
  DriverProfileRecord,
  DriverEarningRecord,
  IssueReasonCode,
  AssignmentResponseStatus,
  DriverApplicationStatus,
  DriverApplicationInput,
  DriverDocumentType,
} from "../api";

export type { AssignmentMilestones } from "../lib/deliveryStage";

/** Snapshot of the driver's key performance indicators for the dashboard header. */
export interface DashboardMetrics {
  earningsToday: number;
  completedToday: number;
  acceptanceRate: number | null;
  activeOrdersCount: number;
  weeklyEarnings: DailyEarning[];
  streakDays: number;
}

/** One day's aggregated earnings, used in weekly breakdowns. */
export interface DailyEarning {
  date: string;
  total: number;
}

/** Flattened representation of a ManifestOrder tailored for queue list rendering. */
export interface DeliverySummary {
  id: string;
  customerName: string;
  customerAddress: string;
  total: number;
  status: string;
  assignmentKind?: string;
  stage: DeliveryStage;
  nextAction: StageAction;
  updatedAt: string;
}

/** Current online/offline state with optional last-known location metadata. */
export interface DriverStatus {
  isOnline: boolean;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: string | null;
}
