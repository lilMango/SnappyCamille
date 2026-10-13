import { SPAWN } from './worldSelect';

/**
 * The single, mutable input state. Desktop (InputController) and touch (MobileControls)
 * both write into it; the player controller, camera and block interaction read from it.
 * Plain object, not React state: it changes every frame.
 */
export const input = {
  keys: new Set(), // KeyboardEvent.code of held keys
  // touch joystick, -1..1 (mz +1 = forward)
  touchMx: 0,
  touchMz: 0,
  touchSprint: false,
  touchJump: false,
  touchHookL: false,
  touchHookR: false,
  touchReel: false,
  dashPressed: false, // edge: set on key/touch press, consumed by the player controller
  lastLookT: 0, // when the user last moved the view (seconds), so the camera can auto-follow when idle
  breakHeld: false,
  placeHeld: false,
  // raw look deltas (pixels-equivalent) accumulated since the last frame
  lookDX: 0,
  lookDY: 0,
  // integrated look direction, owned by InputController (so the player camera and the free
  // camera share it and hand over seamlessly). yaw 0 looks toward -z.
  yaw: SPAWN.yaw,
  pitch: -0.15,
};

/**
 * Movement intent from keyboard + touch: out.x = strafe right (+1), out.z = forward (+1),
 * clamped to the unit circle. Returns out.
 */
export function moveIntent(out) {
  const k = input.keys;
  let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + input.touchMx;
  let z = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + input.touchMz;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  out.x = x;
  out.z = z;
  return out;
}

export const isSprinting = () => input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || input.touchSprint;
export const isJumping = () => input.keys.has('Space') || input.touchJump;
// ODM gear: Q / E hold the left / right hook, Ctrl or R reels in, F dashes (Space boosts while roped)
export const hookHeld = (i) => (i === 0 ? input.keys.has('KeyQ') || input.touchHookL : input.keys.has('KeyE') || input.touchHookR);
export const isReeling = () => input.keys.has('ControlLeft') || input.keys.has('ControlRight') || input.keys.has('KeyR') || input.touchReel;

/** Drop every held input (window blur, pointer-lock loss, mode switches). */
export function releaseAll() {
  input.keys.clear();
  input.breakHeld = false;
  input.placeHeld = false;
  input.touchMx = 0;
  input.touchMz = 0;
  input.touchSprint = false;
  input.touchJump = false;
  input.touchHookL = false;
  input.touchHookR = false;
  input.touchReel = false;
  input.dashPressed = false;
}
