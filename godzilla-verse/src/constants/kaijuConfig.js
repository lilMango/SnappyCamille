import { GROUND_Y } from './worldConfig';

// Kaiju tuning. 1 block = 1 m. Rigs are authored ~7 units tall and the root is scaled x10
// (so numbers in the rig files read like the sibling creatures') -> ~70 blocks.
//
// Yaw convention is the player's: forward = (-sin yaw, -cos yaw), so yaw 0 faces -z.

export const KAIJU = {
  scale: 10,

  godzilla: {
    name: 'Godzilla',
    hp: 1000,
    speed: 14, // m/s at full stride: ~18 m per footfall, a long stride for a 70 m body
    accel: 1.6, // smooth-time to the wanted speed (heavier than it looks)
    turnRate: 0.7, // rad/s
    stride: 0.38, // gait cycles per second at full speed (2 footfalls per cycle)
    radius: 7, // body footprint radius (carve + player pushback)
    bodyCarveRadius: 5.5,
    bodyCarveHeight: 46,
    bodyCarveInterval: 0.1,
    muzzle: { y: 6.2, fwd: 1.9 }, // jaw position in authoring units (x scale)
    spawn: { x: 197, z: 112, yaw: Math.PI }, // north of the park, walking south toward the spawn
  },

  ghidorah: {
    name: 'King Ghidorah',
    hp: 1400,
    speed: 16,
    accel: 1.2,
    turnRate: 0.55,
    hoverY: GROUND_Y + 66, // body height above the street (tower tops reach ~110)
    bob: 2.5,
    radius: 8,
    bodyCarveRadius: 7,
    bodyCarveHeight: 16,
    bodyCarveInterval: 0.12,
    spawn: { x: 120, z: 150, yaw: -Math.PI / 2 },
  },

  // atomic breath
  beam: {
    chargeTime: 1.6,
    fireTime: 2.5,
    cooldown: 7,
    range: 140,
    sweepDeg: 30, // the head yaws +-30 degrees across the fire time
    boreRadius: 2.5,
    boreDepth: 4,
    boreInterval: 0.07,
    playerRadius: 4, // how close the beam must pass to hurt the player
    playerDamage: 30,
  },

  // gravity lightning (one bolt per Ghidorah head)
  lightning: {
    heads: 3,
    chargeTime: 1.0,
    fireTime: 2.6,
    cooldown: 6,
    range: 120,
    strikeInterval: 0.3,
    strikeRadius: 3,
    playerRadius: 4,
    playerDamage: 25,
  },

  // footfalls
  stomp: {
    radius: 4,
    depth: 2,
    playerRadius: 10,
    playerDamage: 20,
  },

  // destruction
  destruction: {
    voxelsPerFrame: 1500, // hard cap; a bigger carve trails the beam by a few frames, which reads as the beam "eating" the building
    toppleThreshold: 0.35, // a building below this fraction of its voxels comes down
    toppleSeconds: 0.5,
    debrisPerFrame: 48,
    minY: GROUND_Y + 2, // body/beam carves never touch the street surface or below
  },
};

// the box the kaiju stay inside (the wall, the sea wall)
export const KAIJU_BOUNDS = { x0: 12, x1: 325, z0: 12, z1: 372 };
