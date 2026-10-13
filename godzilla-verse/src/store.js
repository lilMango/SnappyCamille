import { create } from 'zustand';
import { createBody } from './utils/physics';
import { createOdm, odmConstraint } from './utils/odm';
import { ODM } from './constants/odmConfig';
import { PLAYER, CAMERA_MODES, HOTBAR } from './constants/playerConfig';
import { SPAWN, START_FREE } from './utils/worldSelect';

// Two-tier state, same split as the sibling projects:
//  - plain mutable module objects for per-frame data (no React re-renders);
//  - a small zustand store for discrete UI state only.

// ---- per-frame, mutable ---------------------------------------------------------

export const player = {
  body: createBody({
    x: SPAWN.x,
    y: SPAWN.y,
    z: SPAWN.z,
    halfWidth: PLAYER.halfWidth,
    height: PLAYER.height,
    stepHeight: PLAYER.stepHeight,
    gravity: PLAYER.gravity,
    terminal: PLAYER.terminalVelocity,
  }),
  facing: SPAWN.yaw + Math.PI, // mesh yaw (the mesh is authored facing +z)
  speed: 0, // horizontal speed, for the walk animation
  eyeX: SPAWN.x,
  eyeY: SPAWN.y + PLAYER.eyeHeight,
  eyeZ: SPAWN.z,
  health: ODM.maxHealth,
  score: 0, // swing distance / 4 + bonuses (later phases add kaiju damage)
  bonus: 0,
  invulnerable: 0, // seconds of damage immunity (after a respawn)
  lean: 0, // body pitch while swinging, for the mesh
};

// ODM gear: ropes, gas, boost. The rope runs inside the physics substeps via body.constraint.
export const odm = createOdm();
player.body.constraint = (b) => odmConstraint(odm, b);

// The city: loading state while it generates, then its lot map / buildings / anchors.
//   state: idle | loading | generated | error     generated: voxel data is in (physics can run)
//   ready: generated AND the area around the camera is meshed (the loading screen can go)
export const city = {
  state: 'idle',
  generated: false,
  ready: false,
  pct: 0, // generation + streaming progress, 0..1
  label: '', // current generation phase
  via: '', // 'worker' | 'main thread'
  error: '',
  lotMap: null, // Uint16Array(SIZE*SIZE): building id per column, 0 = none
  buildings: [],
  anchors: null, // Int16Array of (x, y, z) roof corners, for the grapple assist (phase 5)
  stats: null,
};

// The kaiju (phase 6): each entry is { ctl: KaijuController, brain, events, view } and `destruction` is the
// shared damage seam (created once the city exists). Mutable; written by KaijuPair, read by effects + checks.
export const kaiju = {
  list: [],
  destruction: null,
  stats: { stomps: 0, bores: 0, strikes: 0, debris: 0, playerHits: 0 },
};

// The ray block targeting uses; written by CameraRig, read by BlockInteraction.
export const camState = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1 };

// The block under the crosshair; written by BlockInteraction, read by the HUD/highlight.
export const target = { valid: false, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, id: 0 };

// Live engine numbers for the debug panel. Written by in-canvas components every frame
// (or every few frames), polled by the DOM panel at ~4 Hz — never a zustand field, which
// would re-render React at 60 Hz.
export const stats = {
  fps: 0,
  calls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  world: '',
  genMs: 0, // time to generate the world
  sections: 0, // non-empty sections in the world
  meshes: 0, // sections currently meshed
  activeCols: 0, // columns inside the render-distance ring
  quads: 0,
  gpuMB: 0, // geometry buffer bytes held on the GPU
  dirty: 0, // sections waiting for a remesh
  inFlight: 0, // sections out at a worker
  workers: 0, // 0 = main-thread fallback
  latAvg: 0, // worker round trip (dispatch -> geometry applied), ms
  latMax: 0,
  uploads: 0, // geometries uploaded this frame
  meshedTotal: 0,
  meshMs: 0, // main-thread time spent in the mesh manager last frame
  wireframe: false,
  locked: false, // pointer locked
  grounded: false,
  hSpeed: 0, // player horizontal speed
  gas: 100,
  health: 100,
  score: 0,
  fov: 70,
  trauma: 0,
  target: '', // block under the crosshair
  speed: 0, // free-cam fly speed (m/s)
  x: 0, // camera position
  y: 0,
  z: 0,
};

// ---- discrete UI state ----------------------------------------------------------

export const useGame = create((set) => ({
  started: false,
  start: () => set({ started: true }),

  freeCam: START_FREE, // V toggles the debug free camera
  toggleFreeCam: () => set((s) => ({ freeCam: !s.freeCam })),

  cameraMode: 0, // index into CAMERA_MODES; F5 cycles
  cycleCamera: () => set((s) => ({ cameraMode: (s.cameraMode + 1) % CAMERA_MODES.length })),

  hotbarIndex: 0,
  selectHotbar: (i) => set({ hotbarIndex: ((i % HOTBAR.length) + HOTBAR.length) % HOTBAR.length }),
  scrollHotbar: (d) => set((s) => ({ hotbarIndex: (s.hotbarIndex + d + HOTBAR.length) % HOTBAR.length })),

  // Phase 0 pipeline probe results, shown on the HUD.
  probe: { worker: 'pending', atlas: 'pending', base: import.meta.env.BASE_URL },
  setProbe: (patch) => set((s) => ({ probe: { ...s.probe, ...patch } })),
}));
