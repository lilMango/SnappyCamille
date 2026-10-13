import { create } from 'zustand';

// Two-tier state, same split as the sibling projects:
//  - plain mutable module objects for per-frame data (no React re-renders);
//  - a small zustand store for discrete UI state only.

// Live engine numbers for the debug panel. Written by in-canvas components every frame
// (or every few frames), polled by the DOM panel at ~4 Hz — never a zustand field, which
// would re-render React at 60 Hz.
export const stats = {
  fps: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  sections: 0, // non-empty sections in the world
  meshes: 0, // sections currently meshed
  quads: 0,
  dirty: 0, // sections waiting for a remesh
  meshMs: 0, // main-thread meshing time last frame
  wireframe: false,
  locked: false, // pointer locked
  speed: 0, // fly speed (m/s)
  x: 0,
  y: 0,
  z: 0,
};

export const useGame = create((set) => ({
  started: false,
  start: () => set({ started: true }),
  // Phase 0 pipeline probe results, shown on the HUD.
  probe: { worker: 'pending', atlas: 'pending', base: import.meta.env.BASE_URL },
  setProbe: (patch) => set((s) => ({ probe: { ...s.probe, ...patch } })),
}));
