/**
 * Prescriptions feature — barrel.
 *
 * Public surface: bootstrap component, read hooks, mutation hooks, interaction
 * stub. Screens import from here; internals (rowMappers) are deep-imported
 * only where genuinely needed.
 */

// Day 4 introduced PharmacyBootstrap in src/shared/components. The old
// PrescriptionsBootstrap shim has been removed; import from
// @/shared/components instead.

export {
  usePrescriptions,
  useActivePrescriptions,
  useExpiringPrescriptions,
  usePrescription,
  useRefills,
  useRefillsForPrescription,
} from "./hooks/usePrescriptions";

export { usePrescriptionsQuery }        from "./hooks/usePrescriptionsQuery";
export type { UsePrescriptionsQueryResult } from "./hooks/usePrescriptionsQuery";

export { useRequestRefill }             from "./hooks/useRequestRefill";
export type { RequestRefillInput }      from "./hooks/useRequestRefill";

export { useDrugInteractionCheck }      from "./hooks/useDrugInteractionCheck";
export type {
  InteractionMatch,
  UseDrugInteractionCheckResult,
} from "./hooks/useDrugInteractionCheck";

export { PrescriptionsList }            from "./screens/PrescriptionsList";
export { PrescriptionDetail }           from "./screens/PrescriptionDetail";
export { AddRxEntry }                   from "./screens/AddRxEntry";
export { AddRxManual }                  from "./screens/AddRxManual";
export { sortActiveByStatus }           from "./lib/statusSort";
export { lookupRxNumber }               from "./lib/manualLookup";
export type { RxLookupResult }          from "./lib/manualLookup";

export { parseRxText }                  from "./lib/parseRxText";
export type { OcrResult, ParsedRx }     from "./lib/parseRxText";
export { runParserTests }               from "./lib/parseRxText.devUtils";
export type { ParserTestSummary }       from "./lib/parseRxText.devUtils";

export { OcrReviewForm }                from "./components/OcrReviewForm";
export type {
  OcrReviewFormProps,
  OcrReviewFormSubmit,
} from "./components/OcrReviewForm";
