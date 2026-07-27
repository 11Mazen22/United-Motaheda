import { create } from 'zustand';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  altitude: number | null;
  isTracking: boolean;
  lastUpdated: number | null;
}

interface LocationStore extends LocationState {
  setLocation: (loc: Partial<LocationState>) => void;
  startTracking: () => void;
  stopTracking: () => void;
  reset: () => void;
}

const initialState: LocationState = {
  latitude: null,
  longitude: null,
  heading: null,
  speed: null,
  accuracy: null,
  altitude: null,
  isTracking: false,
  lastUpdated: null,
};

export const useLocationStore = create<LocationStore>((set) => ({
  ...initialState,

  setLocation: (loc) =>
    set((s) => ({ ...s, ...loc, lastUpdated: Date.now() })),

  startTracking: () => set({ isTracking: true }),

  stopTracking: () => set({ isTracking: false }),

  reset: () => set(initialState),
}));
