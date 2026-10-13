// World geometry. 1 block = 1 m, Y is up.
//
// A column is CHUNK_X x CHUNK_Z blocks and WORLD_H tall, split vertically into
// SECTIONS sections of SECTION_H. Sections (not whole columns) are the unit that is
// stored, meshed and drawn: SECTION_H = 32 halves the draw calls of 16-high sections,
// and draw calls are the scarce resource for a city of flat facades.

export const CHUNK_X = 16;
export const CHUNK_Z = 16;
export const SECTION_H = 32;
export const SECTIONS = 4;
export const WORLD_H = SECTION_H * SECTIONS; // 128

export const SECTION_VOLUME = CHUNK_X * CHUNK_Z * SECTION_H; // 8192

// Street level: the surface block of the ground sits at y = GROUND_Y.
export const GROUND_Y = 20;

// Padded copy handed to the mesher: 1-voxel shell on every side (needed for face
// culling now and per-vertex AO in phase 2).
export const PAD_X = CHUNK_X + 2; // 18
export const PAD_Z = CHUNK_Z + 2; // 18
export const PAD_Y = SECTION_H + 2; // 34
export const PAD_VOLUME = PAD_X * PAD_Z * PAD_Y; // 11016

// How far (in chunks) around the camera sections are kept meshed (the single biggest
// performance knob: cost grows with its square). Fog is sized so the ring's edge fades
// out before pop-in is visible: 10 chunks = 160 m.
export const RENDER_DIST = 10;
export const FOG_NEAR = 70;
export const FOG_FAR = 155;
