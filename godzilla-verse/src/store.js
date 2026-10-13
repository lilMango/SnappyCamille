import { create } from 'zustand';

// Two-tier state, same split as the sibling projects:
//  - plain mutable module objects for per-frame data (no React re-renders), added per phase;
//  - a small zustand store for discrete UI state only.

export const useGame = create((set) => ({
  started: false,
  start: () => set({ started: true }),
  // Phase 0 pipeline probe results, shown on the HUD.
  probe: { worker: 'pending', atlas: 'pending', base: import.meta.env.BASE_URL },
  setProbe: (patch) => set((s) => ({ probe: { ...s.probe, ...patch } })),
}));
