import * as THREE from 'three';
import { PEAK_DIR } from './terrain';

/**
 * Two-hemisphere sky. The planet is split in half along the ocean <-> peak axis:
 *   - the Lanikai / lagoon half (around OCEAN_DIR) has a normal blue sunset sky,
 *   - the far half (around PEAK_DIR, past the Kualoa pali) has a purple / pink /
 *     orange cotton-candy sky,
 * and the two blend smoothly across the middle. The sky dome blends by VIEW
 * direction (so from the beach you see candy sky over the valley behind you);
 * the fog, lights and cloud tint use the same blend, sampled at the player /
 * the horizon she's looking at. The sun is fixed low over the lagoon (golden hour).
 *
 * `tickSky` is called once a frame by SkyDome (mounted first); Lighting, Water
 * and the clouds read the shared mutable `sky`.
 */

/** Unit vector toward the (fixed, low) sun: ~30 deg above the spawn's horizon, over the ocean. */
export const SUN_DIR = new THREE.Vector3(0.5, -0.866, 0.15).normalize();

/** Direction of the cotton-candy hemisphere's center. */
export const CANDY_AXIS = PEAK_DIR.clone();
/** Blend half-width in dot(dir, axis) — ~0.45 spans roughly 55 deg around the equator. */
export const BLEND = 0.45;

const c = (hex) => new THREE.Color(hex);

export const PALETTES = {
  blue: {
    zenith: c('#2f78e0'),
    mid: c('#66aef2'),
    horizon: c('#ffd9b0'),
    sun: c('#ffd9a8'),
    hemiSky: c('#e8f2ff'),
    hemiGround: c('#f3e2b8'),
    bounce: c('#d6ecff'),
    cloud: c('#fff6ee'),
  },
  candy: {
    zenith: c('#a07af0'),
    mid: c('#ff9ad8'),
    horizon: c('#ffc08a'),
    sun: c('#ffb0c8'),
    hemiSky: c('#f8d8f4'),
    hemiGround: c('#f0cfc0'),
    bounce: c('#e0c8ff'),
    cloud: c('#ffd2ee'),
  },
};

const FIELDS = ['zenith', 'mid', 'horizon', 'sun', 'hemiSky', 'hemiGround', 'bounce', 'cloud'];

/** Live state: `here` = blend at the player, `view` = blend at the horizon she faces. */
export const sky = { here: 0, view: 0 };
for (const f of FIELDS) sky[f] = new THREE.Color();
sky.fog = new THREE.Color();

const _h = new THREE.Vector3();

export function candyFactor(dir) {
  return THREE.MathUtils.smoothstep(dir.dot(CANDY_AXIS), -BLEND, BLEND);
}

/** Refresh `sky` for a player at unit vector `up` whose camera looks along `fwd`. */
export function tickSky(up, fwd) {
  sky.here = candyFactor(up);
  // Horizon point she is looking toward (camera forward flattened to the tangent plane).
  _h.copy(fwd).addScaledVector(up, -fwd.dot(up));
  sky.view = _h.lengthSq() > 1e-6 ? candyFactor(_h.normalize()) : sky.here;
  for (const f of FIELDS) sky[f].copy(PALETTES.blue[f]).lerp(PALETTES.candy[f], sky.here);
  sky.fog.copy(PALETTES.blue.horizon).lerp(PALETTES.candy.horizon, sky.view);
}
