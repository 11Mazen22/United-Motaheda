/**
 * prescriptionsStore — local source of truth for prescriptions + refill requests.
 *
 * Spec: HANDOFF.md §5.1.
 *
 * Architecture: this store is the offline-first, instantly-readable cache.
 * React Query hydrates it from Supabase (see src/features/prescriptions/hooks/
 * usePrescriptionsQuery.ts). All screens read from Zustand; writes go through
 * RQ mutations that also call into this store optimistically.
 *
 * Action set is intentionally minimal per Day 3 scope — getById, getActive,
 * getExpiring, hydrate, addPrescription, updateStatus, requestRefill,
 * cancelRefill, reset. Don't extend without asking.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ──────────────────────────────────────────────────────────────────

export type RxStatus       = "ready" | "active" | "expiring" | "expired";
export type RefillDelivery = "same_day" | "standard" | "pickup";
export type RefillStatus   =
  | "pending"
  | "preparing"
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export type ReviewStatus     = "pending_review" | "approved" | "rejected";
export type SubmissionSource = "manual" | "scan" | "whatsapp";

export interface Prescription {
  id:            string;
  userId:        string;
  dependentId?:  string;
  name:          string;
  dose:          string;
  refills:       number;
  nextRefill:    string;
  doctor:        string;
  status:        RxStatus;
  isControlled?: boolean;
  schedule?:     2 | 3 | 4 | 5;
  /** Pharmacy-issued Rx number (DB column rx_number). Optional client-side
   *  because not every entry path captures it (e.g., camera scan flow). */
  rxNumber?:     string;
  addedAt:       string;
  updatedAt:     string;
  /** Staff review workflow — defaults to 'approved' for rows that predate
   *  this system; every new submission starts at 'pending_review'. */
  reviewStatus?:      ReviewStatus;
  submissionSource?:  SubmissionSource;
  reviewedAt?:        string;
  adminNotes?:        string;
  rejectionReason?:   string;
  imagePath?:         string;
}

export interface RefillRequest {
  id:               string;
  prescriptionId:   string;
  delivery:         RefillDelivery;
  status:           RefillStatus;
  total:            number;
  copay:            number;
  insuranceApplied: number;
  pharmacyId:       string;
  trackingNumber?:  string;
  placedAt:         string;
  eta?:             string;
  /** Staff review audit trail — status itself (pending/preparing/cancelled)
   *  already carries the approve/reject workflow, these are supplementary. */
  reviewedAt?:      string;
  adminNotes?:      string;
  rejectionReason?: string;
}

// ── Store shape ────────────────────────────────────────────────────────────

interface PrescriptionsState {
  prescriptions: Prescription[];
  refills:       RefillRequest[];
  loading:       boolean;
  error?:        string;

  // Queries
  getById:     (id: string) => Prescription | undefined;
  getActive:   () => Prescription[];
  getExpiring: () => Prescription[];

  // Mutations
  hydrate:         (rxs: Prescription[], refills: RefillRequest[]) => void;
  addPrescription: (rx: Omit<Prescription, "id" | "addedAt" | "updatedAt">) => Prescription;
  updateStatus:    (id: string, status: RxStatus) => void;
  requestRefill:   (input: Pick<RefillRequest, "prescriptionId" | "delivery" | "pharmacyId">) => RefillRequest;
  cancelRefill:    (id: string) => void;

  reset: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const now  = (): string => new Date().toISOString();
const uid  = (): string => `rx-${Math.random().toString(36).slice(2, 10)}`;
const ruid = (): string => `rf-${Math.random().toString(36).slice(2, 10)}`;

// ── Implementation ─────────────────────────────────────────────────────────

export const usePrescriptionsStore = create<PrescriptionsState>()(
  persist(
    (set, get) => ({
      prescriptions: [],
      refills:       [],
      loading:       false,

      getById:     (id) => get().prescriptions.find((p) => p.id === id),
      getActive:   () => get().prescriptions.filter((p) => p.status !== "expired"),
      getExpiring: () => get().prescriptions.filter((p) => p.status === "expiring"),

      hydrate: (rxs, refills) => set({ prescriptions: rxs, refills }),

      addPrescription: (rx) => {
        const newRx: Prescription = {
          ...rx,
          id:        uid(),
          addedAt:   now(),
          updatedAt: now(),
        };
        set((s) => ({ prescriptions: [...s.prescriptions, newRx] }));
        return newRx;
      },

      updateStatus: (id, status) =>
        set((s) => ({
          prescriptions: s.prescriptions.map((p) =>
            p.id === id ? { ...p, status, updatedAt: now() } : p,
          ),
        })),

      requestRefill: (input) => {
        const req: RefillRequest = {
          ...input,
          id:               ruid(),
          status:           "pending",
          total:            0,
          copay:            0,
          insuranceApplied: 0,
          placedAt:         now(),
        };
        set((s) => ({ refills: [req, ...s.refills] }));
        return req;
      },

      cancelRefill: (id) =>
        set((s) => ({
          refills: s.refills.map((r) =>
            r.id === id ? { ...r, status: "cancelled" } : r,
          ),
        })),

      reset: () =>
        set({ prescriptions: [], refills: [], loading: false, error: undefined }),
    }),
    {
      name:    "up.prescriptions",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      // v1 → v2: purge dev mock-seed records (ids prefixed "seed-") that were
      // persisted by the removed PharmacyBootstrap dev seeding. Fake medical
      // records must never survive into user-visible state.
      migrate: (persisted: unknown, fromVersion: number) => {
        const state = persisted as Pick<PrescriptionsState, "prescriptions" | "refills">;
        if (fromVersion < 2 && state) {
          return {
            ...state,
            prescriptions: (state.prescriptions ?? []).filter((p) => !p.id.startsWith("seed-")),
            refills:       (state.refills ?? []).filter((r) => !r.id.startsWith("seed-")),
          };
        }
        return state;
      },
      // Persist only data — never functions or transient loading flags.
      partialize: (state) => ({
        prescriptions: state.prescriptions,
        refills:       state.refills,
      }),
    },
  ),
);
