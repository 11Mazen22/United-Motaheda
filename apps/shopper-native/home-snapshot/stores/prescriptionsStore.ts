/**
 * prescriptionsStore — snapshot copy.
 */
import { create } from "zustand";

export const usePrescriptionsStore = create(() => ({
  prescriptions: [],
  refills: [],
  loading: false,
  getById: (id) => undefined,
  getActive: () => [],
  getExpiring: () => [],
  hydrate: (rxs, refills) => {},
  addPrescription: (rx) => ({ ...rx, id: `rx-${Math.random()}` }),
  updateStatus: (id, status) => {},
  requestRefill: (input) => ({ ...input, id: `rf-${Math.random()}`, status: "pending", placedAt: new Date().toISOString() }),
  cancelRefill: (id) => {},
  reset: () => {},
}));
