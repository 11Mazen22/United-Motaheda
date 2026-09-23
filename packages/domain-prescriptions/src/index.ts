export type PrescriptionWorkflowStep =
  | "uploaded"
  | "under_review"
  | "approved"
  | "rejected"
  | "processed";

export {
  PRESCRIPTION_IMAGE_BUCKET,
  normalizePrescriptionStoragePath,
} from "./storagePath";
