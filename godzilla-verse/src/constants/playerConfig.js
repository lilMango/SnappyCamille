import { B } from './blocks';

// Player body + feel. 1 block = 1 m.
export const PLAYER = {
  halfWidth: 0.3, // AABB is 0.6 x 1.8 x 0.6
  height: 1.8,
  eyeHeight: 1.62,
  // Auto-step height. One full block, so kerbs and sidewalks are walked over rather than
  // jumped (a Minecraft-style 0.6 can't climb a 1-block curb; this is a city game).
  stepHeight: 1.0,
  walkSpeed: 6,
  sprintSpeed: 10,
  groundAccel: 0.06, // smooth-time (s) toward the wanted velocity on the ground
  airAccel: 0.35, // (unused now: airborne control is acceleration-limited, see airControl)
  airControl: 25, // m/s^2 you can steer in the air, up to your walk/sprint speed along the wish direction
  swingControl: 0.35, // ...and this fraction of it while roped, so steering doesn't fight the pendulum
  gravity: 28,
  terminalVelocity: 60,
  jumpSpeed: 8.6, // apex ~1.3 blocks: clears a 1-block ledge with room to spare
  reach: 6, // block interaction distance from the eye
  respawnY: -30, // fell out of the world
};

// Third-person boom and camera shell (the Spider-Man feel — lag, FOV, roll — is phase 5).
export const CAMERA = {
  fov: 70,
  boom: 4.5, // metres behind the player
  pivotSmooth: 0.07, // damp the eye height so step-ups don't pop the view
  collideMargin: 0.35,
  pullOutSmooth: 0.3, // ease back out after a wall squeezed the boom in (snap in is instant)
  maxPitch: (85 * Math.PI) / 180,
  lookSpeed: 0.0022, // radians per mouse pixel
  touchLookSpeed: 0.005,
};
export const CAMERA_MODES = ['THIRD_BACK', 'FIRST', 'THIRD_FRONT']; // F5 cycles in this order

// Block interaction.
export const EDIT = {
  breakCooldown: 0.18, // s between blocks while the button is held
  placeCooldown: 0.2,
};

// Hotbar: block ids for slots 1..9.
export const HOTBAR = [
  B.BRICK,
  B.CONCRETE,
  B.CONCRETE_LIGHT,
  B.CONCRETE_DARK,
  B.GLASS,
  B.GLASS_LIT,
  B.STEEL,
  B.FENCE,
  B.RUBBLE,
];
