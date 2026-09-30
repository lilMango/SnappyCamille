// Global tuning constants for the little island planet.

// Same scale as camille-galaxy: small enough to read as a "little planet" with
// strong horizon curvature, big enough that the Kualoa-style cliff walls and
// the Lanikai beach band both fit (see utils/terrain.js for the geography).
export const PLANET_RADIUS = 30;

// Character
export const WALK_SPEED = 8; // world units / second along the surface
export const TURN_SPEED = 2.6; // radians / second
export const CHARACTER_HEIGHT = 1.7; // approx, for foot offset
export const ORIENT_DECAY = 12; // slerp decay for character facing

// Jump (hop straight up along the local surface normal)
export const JUMP_SPEED = 9; // initial upward velocity (units/s)
export const GRAVITY = 26; // downward accel toward the surface (units/s^2)

// Camera (Mario Galaxy / abeto over-the-shoulder) — close and low so the
// character reads large in frame.
export const CAM_BACK = 6.5; // distance behind the character
export const CAM_HEIGHT = 3.2; // lift along surface normal
export const CAM_LOOK_HEIGHT = 1.7; // look target above feet
export const CAM_POS_SMOOTH = 0.18; // damp3 smoothTime for position
export const CAM_UP_SMOOTH = 0.35; // damp3 smoothTime for the up-vector (horizon roll)
export const CAM_ROT_DECAY = 9; // slerp decay for camera orientation
export const CAM_AZIM_DECAY = 14; // how fast the camera azimuth chases "behind" during normal play
export const CAM_SWEEP_SPEED = 2.1; // rad/s the camera orbits around on a turn-around (~1.5s for 180°)

// Spawn (lat/lon in degrees): near the front of the Lanikai sand band, ~1.5m
// from the water's edge. Heading starts at PI (= south, set in store.js), so the
// first view looks out over the turquoise lagoon toward the offshore islets;
// turning around (S) reveals the Kualoa valley and its cliff walls to the north.
// The ocean is centered due south of here — see OCEAN in utils/terrain.js.
export const SPAWN_LAT = 0;
export const SPAWN_LON = 0;
