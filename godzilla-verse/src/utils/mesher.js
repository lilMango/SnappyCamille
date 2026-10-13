import { CHUNK_X, CHUNK_Z, SECTION_H, PAD_X, PAD_Z } from '../constants/worldConfig';
import { OPAQUE, CUTOUT, BLOCK_UV, SHADE_AO } from '../constants/blocks';
import { padIndex } from './blockIndex';

/**
 * Culled-quad mesher with per-vertex ambient occlusion. Pure function of a padded voxel
 * copy (see VoxelWorld.buildPadded): no THREE, no DOM, no world access — it runs inside
 * the mesh Web Workers and in the unit tests unchanged.
 *
 * A face is emitted for every voxel whose neighbour in that direction does not hide it.
 * (Greedy meshing is deliberately not used: per-vertex AO breaks up merge runs and an
 * atlas cannot repeat UVs across a merged quad.)
 *
 * Two outputs per section: `opaque`, and `cutout` for alpha-tested blocks (fences, later
 * leaves) that hide nothing behind them. Each is already in the packed vertex layout the
 * renderer uploads as-is, ~10 B/vertex:
 *   position  Uint8  x3   section-local coordinates (0..16 on x/z, 0..32 on y)
 *   uv        Uint16 x2   normalised atlas UVs
 *   color     Uint8  x3   baked face brightness x ambient occlusion
 *   index     Uint16 | Uint32 (Uint32 only when a part exceeds 65 535 vertices)
 */

// ---- growable output buffers -------------------------------------------------

class Builder {
  constructor(quads) {
    this.alloc(quads);
    this.vc = 0; // vertices written
    this.ic = 0; // indices written
  }

  alloc(quads) {
    this.cap = quads;
    this.pos = new Uint8Array(quads * 12);
    this.uv = new Uint16Array(quads * 8);
    this.col = new Uint8Array(quads * 12);
    this.idx = new Uint32Array(quads * 6);
  }

  reset() {
    this.vc = 0;
    this.ic = 0;
  }

  // Make room for one more quad, doubling when full. Scratch persists across calls, so
  // steady state is allocation-free.
  reserve() {
    if (this.vc / 4 < this.cap) return;
    const { pos, uv, col, idx } = this;
    this.alloc(this.cap * 2);
    this.pos.set(pos);
    this.uv.set(uv);
    this.col.set(col);
    this.idx.set(idx);
  }

  finish() {
    const { vc, ic } = this;
    if (vc === 0) return null;
    return {
      position: this.pos.slice(0, vc * 3),
      uv: this.uv.slice(0, vc * 2),
      color: this.col.slice(0, vc * 3),
      index: vc > 65535 ? this.idx.slice(0, ic) : Uint16Array.from(this.idx.subarray(0, ic)),
      vertexCount: vc,
      quadCount: vc / 4,
    };
  }
}

const OPAQUE_OUT = new Builder(2048);
const CUTOUT_OUT = new Builder(256);

// ---- face tables -------------------------------------------------------------

// Strides through the padded array, and the neighbour offset for each face direction.
const STRIDE = [1, PAD_X * PAD_Z, PAD_X]; // x, y, z
// Face order: +x, -x, +y, -y, +z, -z.
const NORMAL = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const NEIGHBOUR = NORMAL.map((n) => n[0] * STRIDE[0] + n[1] * STRIDE[1] + n[2] * STRIDE[2]);

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

// Ambient occlusion sample offsets. For a face corner, look at the three cells in the
// layer *in front of* the face that touch that corner: the two edge neighbours (side1,
// side2) and the diagonal (corner). Offsets are padded-array deltas from the voxel, laid
// out [side1, side2, corner] per corner. They only ever step along the face's two
// tangent axes (plus the one cell out along the normal), so they always stay inside the
// 1-voxel padding.
const AO_OFF = new Int32Array(6 * 4 * 3);
for (let f = 0; f < 6; f++) {
  const na = NORMAL[f].findIndex((v) => v !== 0);
  const [a, b] = [0, 1, 2].filter((ax) => ax !== na);
  for (let k = 0; k < 4; k++) {
    const sa = CORNERS[f][k * 3 + a] ? 1 : -1;
    const sb = CORNERS[f][k * 3 + b] ? 1 : -1;
    const o = (f * 4 + k) * 3;
    AO_OFF[o] = NEIGHBOUR[f] + sa * STRIDE[a];
    AO_OFF[o + 1] = NEIGHBOUR[f] + sb * STRIDE[b];
    AO_OFF[o + 2] = NEIGHBOUR[f] + sa * STRIDE[a] + sb * STRIDE[b];
  }
}

const _ao = [0, 0, 0, 0];

function emitQuad(out, pad, f, id, x, y, z, pi) {
  out.reserve();

  // per-vertex AO (classic 3-neighbour rule): 0 = boxed in .. 3 = fully open
  for (let k = 0; k < 4; k++) {
    const o = (f * 4 + k) * 3;
    const s1 = OPAQUE[pad[pi + AO_OFF[o]]];
    const s2 = OPAQUE[pad[pi + AO_OFF[o + 1]]];
    const c = OPAQUE[pad[pi + AO_OFF[o + 2]]];
    _ao[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + c);
  }

  const vc = out.vc;
  const cf = f * 12;
  const uvo = (id * 6 + f) * 4;
  const u0 = BLOCK_UV[uvo];
  const v0 = BLOCK_UV[uvo + 1];
  const u1 = BLOCK_UV[uvo + 2];
  const v1 = BLOCK_UV[uvo + 3];

  for (let k = 0; k < 4; k++) {
    const v = (vc + k) * 3;
    out.pos[v] = x + CORNERS[f][k * 3];
    out.pos[v + 1] = y + CORNERS[f][k * 3 + 1];
    out.pos[v + 2] = z + CORNERS[f][k * 3 + 2];
    const shade = SHADE_AO[f * 4 + _ao[k]];
    out.col[v] = shade;
    out.col[v + 1] = shade;
    out.col[v + 2] = shade;
  }
  const t = vc * 2;
  out.uv[t] = u0;
  out.uv[t + 1] = v0;
  out.uv[t + 2] = u1;
  out.uv[t + 3] = v0;
  out.uv[t + 4] = u1;
  out.uv[t + 5] = v1;
  out.uv[t + 6] = u0;
  out.uv[t + 7] = v1;

  // Split the quad along the diagonal joining the two *brighter* corners. With the other
  // split, AO interpolates across the wrong diagonal and a dark inside corner smears over
  // the whole face (visible as an anisotropic seam along building edges).
  const i = out.ic;
  if (_ao[0] + _ao[2] < _ao[1] + _ao[3]) {
    out.idx[i] = vc + 1;
    out.idx[i + 1] = vc + 2;
    out.idx[i + 2] = vc + 3;
    out.idx[i + 3] = vc + 1;
    out.idx[i + 4] = vc + 3;
    out.idx[i + 5] = vc;
  } else {
    out.idx[i] = vc;
    out.idx[i + 1] = vc + 1;
    out.idx[i + 2] = vc + 2;
    out.idx[i + 3] = vc;
    out.idx[i + 4] = vc + 2;
    out.idx[i + 5] = vc + 3;
  }
  out.vc = vc + 4;
  out.ic = i + 6;
}

/**
 * @param {Uint8Array} pad padded voxel copy, length PAD_VOLUME
 * @returns {{opaque: MeshPart|null, cutout: MeshPart|null}}
 *   MeshPart = {position:Uint8Array, uv:Uint16Array, color:Uint8Array,
 *               index:Uint16Array|Uint32Array, vertexCount:number, quadCount:number}
 */
export function meshSection(pad) {
  OPAQUE_OUT.reset();
  CUTOUT_OUT.reset();

  for (let y = 0; y < SECTION_H; y++) {
    for (let z = 0; z < CHUNK_Z; z++) {
      for (let x = 0; x < CHUNK_X; x++) {
        const pi = padIndex(x + 1, y + 1, z + 1);
        const id = pad[pi];
        if (id === 0) continue;

        if (CUTOUT[id]) {
          for (let f = 0; f < 6; f++) {
            const nb = pad[pi + NEIGHBOUR[f]];
            // hidden by an opaque neighbour, or by a neighbouring block of the same kind
            if (OPAQUE[nb] || nb === id) continue;
            emitQuad(CUTOUT_OUT, pad, f, id, x, y, z, pi);
          }
        } else {
          for (let f = 0; f < 6; f++) {
            if (OPAQUE[pad[pi + NEIGHBOUR[f]]]) continue;
            emitQuad(OPAQUE_OUT, pad, f, id, x, y, z, pi);
          }
        }
      }
    }
  }

  return { opaque: OPAQUE_OUT.finish(), cutout: CUTOUT_OUT.finish() };
}
