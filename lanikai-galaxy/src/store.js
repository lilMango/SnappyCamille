import { create } from 'zustand';
import * as THREE from 'three';
import { PLANET_RADIUS, CHARACTER_HEIGHT, SPAWN_LAT, SPAWN_LON } from './constants/worldConfig';
import { latLonToDir } from './utils/sphere';

/**
 * Shared, mutable per-frame character state. Written by useSphereWalker every
 * frame and read by the camera / audio / discovery systems. Kept OUT of React
 * state to avoid re-rendering 60x/second — components read these live vectors.
 */
export const player = {
  posDir: latLonToDir(SPAWN_LAT, SPAWN_LON), // unit vector center->character (local up)
  up: latLonToDir(SPAWN_LAT, SPAWN_LON).clone(),
  forward: new THREE.Vector3(0, 0, -1),
  worldPos: new THREE.Vector3(), // mesh position (includes jump height)
  groundPos: new THREE.Vector3(), // surface position under the character (camera target)
  heading: Math.PI, // face south, out over the water, at spawn
  height: 0, // current hop height above the surface (world units)
  vertV: 0, // vertical velocity for jumping
  grounded: true,
  camFlipSeq: 0, // incremented on each turn-around, so the camera can orbit around

  speed: 0, // 0..1 normalized, for walk-anim blending
};

// Dev aid: lets automated tests / the console inspect live player state.
if (typeof window !== 'undefined') window.__player = player;

export function footRadius() {
  return PLANET_RADIUS + CHARACTER_HEIGHT * 0; // character origin sits on surface; mesh drawn upward
}

/** Discrete UI / game state (re-renders on change — use sparingly). */
export const useGame = create((set) => ({
  started: false,
  musicOn: true,
  activeNote: null, // { title, body, photo? } | null
  activeZone: null, // name of the current music zone | null
  surpriseUnlocked: false,

  start: () => set({ started: true }),
  toggleMusic: () => set((s) => ({ musicOn: !s.musicOn })),
  setNote: (note) => set({ activeNote: note }),
  clearNote: () => set({ activeNote: null }),
  unlockSurprise: () => set({ surpriseUnlocked: true }),
}));
