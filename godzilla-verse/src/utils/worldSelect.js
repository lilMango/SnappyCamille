// Which world the URL selects, plus its spawn point and free-camera start. One place, so
// the renderer, the player and the fly camera can't disagree.
//
//   (default)        the real city (phase 4): generated in a worker, dusk
//   ?world=test      the 64x64 engine test world (daytime)
//   ?world=synthetic the 384x384 box-tower world used as the phase-2 perf gate
//   ?time=day|dusk|night   time of day (dusk for the city, day for the others)
//   ?cam=x,y,z,yawDeg,pitchDeg   start in the free camera at that pose (also: ?free=1)
//   ?workers=0    mesh and generate on the main thread      ?rd=N   render distance in chunks

import { CITY_SPAWN } from '../constants/cityConfig';

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

const w = params.get('world');
export const WORLD_KIND = w === 'test' ? 'test' : w === 'synthetic' ? 'synthetic' : 'city';
// kaiju (phase 6): on in the real city, off in the engine test worlds; ?kaiju=0|1 overrides
export const KAIJU_ON = params.get('kaiju') ? params.get('kaiju') !== '0' : WORLD_KIND === 'city';
export const USE_WORKERS = params.get('workers') !== '0';
export const RENDER_DIST_OVERRIDE = Number(params.get('rd')) || undefined;

// feet position, and the yaw the player starts facing (radians; 0 looks toward -z)
export const SPAWN =
  WORLD_KIND === 'city'
    ? CITY_SPAWN // the park path, facing the fountain
    : WORLD_KIND === 'synthetic'
      ? { x: 196.5, y: 21.01, z: 196.5, yaw: 0 } // avenue/street crossing mid-city
      : { x: 31.5, y: 21.01, z: 46.5, yaw: 0 }; // test world: on the road, south of the junction

const t = params.get('time');
export const TIME_OF_DAY = t === 'day' || t === 'dusk' || t === 'night' ? t : WORLD_KIND === 'city' ? 'dusk' : 'day';

const cam = (params.get('cam') || '').split(',').map(Number);
export const FREE_CAM_START =
  cam.length === 5 && cam.every(Number.isFinite)
    ? { x: cam[0], y: cam[1], z: cam[2], yaw: (cam[3] * Math.PI) / 180, pitch: (cam[4] * Math.PI) / 180 }
    : null;

// start in the free camera when a pose was given (screenshots) or ?free=1
export const START_FREE = FREE_CAM_START !== null || params.get('free') === '1';
export const START_WIREFRAME = params.get('wire') === '1';

// Touch devices get the on-screen controls and no debug overlays (they would cover the
// buttons). ?debug=1 forces them on, ?debug=0 forces them off.
export const IS_TOUCH =
  typeof window !== 'undefined' && ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);
export const SHOW_DEBUG = params.get('debug') === '1' || (params.get('debug') !== '0' && !IS_TOUCH);
