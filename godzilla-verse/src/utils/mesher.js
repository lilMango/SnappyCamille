import { CHUNK_X, CHUNK_Z, SECTION_H, SECTION_VOLUME, PAD_X, PAD_Z } from '../constants/worldConfig';
import { OPAQUE, BLOCK_UV, FACE_SHADE_U8 } from '../constants/blocks';
import { padIndex } from './blockIndex';

/**
 * Culled-quad mesher. Pure function of a padded voxel copy (see VoxelWorld.buildPadded):
 * no THREE, no DOM, no world access — so phase 2 moves it into a Web Worker unchanged.
 *
 * A face is emitted for every solid voxel whose neighbour in that direction does not hide
 * it. (Greedy meshing is deliberately not used: per-vertex AO breaks up merge runs and an
 * atlas cannot repeat UVs across a merged quad.)
 *
 * Output is already in the packed vertex layout the renderer uploads as-is, ~10 B/vertex:
 *   position  Uint8  x3   section-local coordinates (0..16 on x/z, 0..32 on y)
 *   uv        Uint16 x2   normalised atlas UVs
 *   color     Uint8  x3   baked face brightness (AO joins it in phase 2)
 *   index     Uint16 | Uint32 (Uint32 only when a section exceeds 65 535 vertices)
 */

const MAX_QUADS = SECTION_VOLUME * 6; // hard upper bound; real sections are a small fraction
const MAX_VERTS = MAX_QUADS * 4;

// Scratch buffers, allocated once; the result is a sliced copy of the used prefix.
let S_POS = null;
let S_UV = null;
let S_COL = null;
let S_IDX = null;

function ensureScratch() {
  if (S_POS) return;
  S_POS = new Uint8Array(MAX_VERTS * 3);
  S_UV = new Uint16Array(MAX_VERTS * 2);
  S_COL = new Uint8Array(MAX_VERTS * 3);
  S_IDX = new Uint32Array(MAX_QUADS * 6);
}

// Offsets into the padded array for the neighbour in each face direction.
// Face order: +x, -x, +y, -y, +z, -z.
const NEIGHBOUR = [1, -1, PAD_X * PAD_Z, -PAD_X * PAD_Z, PAD_X, -PAD_X];

// Quad corners per face, counter-clockwise seen from outside, starting bottom-left.
// UVs for corners 0..3 are (u0,v0) (u1,v0) (u1,v1) (u0,v1); on the side faces "up" on the
// texture is +y, on the top face it is -z (north), on the bottom face +z.
// prettier-ignore
const CORNERS = [
  /* +x */ [1,0,1,  1,0,0,  1,1,0,  1,1,1],
  /* -x */ [0,0,0,  0,0,1,  0,1,1,  0,1,0],
  /* +y */ [0,1,1,  1,1,1,  1,1,0,  0,1,0],
  /* -y */ [0,0,0,  1,0,0,  1,0,1,  0,0,1],
  /* +z */ [0,0,1,  1,0,1,  1,1,1,  0,1,1],
  /* -z */ [1,0,0,  0,0,0,  0,1,0,  1,1,0],
];

/**
 * @param {Uint8Array} pad padded voxel copy, length PAD_VOLUME
 * @returns {null | {position:Uint8Array, uv:Uint16Array, color:Uint8Array,
 *                   index:Uint16Array|Uint32Array, vertexCount:number, quadCount:number}}
 */
export function meshSection(pad) {
  ensureScratch();
  let vc = 0; // vertices written
  let ic = 0; // indices written

  for (let y = 0; y < SECTION_H; y++) {
    for (let z = 0; z < CHUNK_Z; z++) {
      for (let x = 0; x < CHUNK_X; x++) {
        const pi = padIndex(x + 1, y + 1, z + 1);
        const id = pad[pi];
        if (id === 0) continue;

        for (let f = 0; f < 6; f++) {
          if (OPAQUE[pad[pi + NEIGHBOUR[f]]]) continue; // hidden by an opaque neighbour

          const c = f * 12;
          const uvo = (id * 6 + f) * 4;
          const u0 = BLOCK_UV[uvo];
          const v0 = BLOCK_UV[uvo + 1];
          const u1 = BLOCK_UV[uvo + 2];
          const v1 = BLOCK_UV[uvo + 3];
          const shade = FACE_SHADE_U8[f];

          for (let k = 0; k < 4; k++) {
            const v = vc + k;
            S_POS[v * 3] = x + CORNERS[f][k * 3];
            S_POS[v * 3 + 1] = y + CORNERS[f][k * 3 + 1];
            S_POS[v * 3 + 2] = z + CORNERS[f][k * 3 + 2];
            S_COL[v * 3] = shade;
            S_COL[v * 3 + 1] = shade;
            S_COL[v * 3 + 2] = shade;
          }
          S_UV[vc * 2] = u0;
          S_UV[vc * 2 + 1] = v0;
          S_UV[(vc + 1) * 2] = u1;
          S_UV[(vc + 1) * 2 + 1] = v0;
          S_UV[(vc + 2) * 2] = u1;
          S_UV[(vc + 2) * 2 + 1] = v1;
          S_UV[(vc + 3) * 2] = u0;
          S_UV[(vc + 3) * 2 + 1] = v1;

          S_IDX[ic++] = vc;
          S_IDX[ic++] = vc + 1;
          S_IDX[ic++] = vc + 2;
          S_IDX[ic++] = vc;
          S_IDX[ic++] = vc + 2;
          S_IDX[ic++] = vc + 3;
          vc += 4;
        }
      }
    }
  }

  if (vc === 0) return null;

  return {
    position: S_POS.slice(0, vc * 3),
    uv: S_UV.slice(0, vc * 2),
    color: S_COL.slice(0, vc * 3),
    index: vc > 65535 ? S_IDX.slice(0, ic) : Uint16Array.from(S_IDX.subarray(0, ic)),
    vertexCount: vc,
    quadCount: vc / 4,
  };
}
