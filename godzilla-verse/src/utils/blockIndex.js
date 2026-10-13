import { CHUNK_X, CHUNK_Z, SECTION_H, SECTIONS } from '../constants/worldConfig';

// Index math shared by the world, the mesher and (later) the workers.
// Section voxel index: x | z<<4 | y<<8  (x,z in [0,16), y in [0,32)).
// X is the fastest-varying axis, so horizontal runs are contiguous and fillBox can use
// TypedArray.fill on whole rows.

export const secIndex = (lx, ly, lz) => lx | (lz << 4) | (ly << 8);

// Numeric column key (no strings in hot paths). cx/cz may be negative down to -1024.
export const colKey = (cx, cz) => ((cx + 1024) << 11) | (cz + 1024);
export const colKeyCx = (k) => (k >> 11) - 1024;
export const colKeyCz = (k) => (k & 2047) - 1024;

// Section key = column key * SECTIONS + section index.
export const sectionKey = (cx, cz, sy) => colKey(cx, cz) * SECTIONS + sy;
export const sectionKeySy = (k) => k % SECTIONS;
export const sectionKeyCol = (k) => Math.floor(k / SECTIONS);

// Padded-copy index for the mesher: (px,pz,py) each 0..PAD-1, with the section's own
// voxel (x,y,z) at (x+1, z+1, y+1).
export const PADX = CHUNK_X + 2;
export const PADZ = CHUNK_Z + 2;
export const PADY = SECTION_H + 2;
export const padIndex = (px, py, pz) => px + PADX * (pz + PADZ * py);
