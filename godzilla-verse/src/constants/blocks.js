import { TILE_INDEX, tileUV } from '../utils/atlasLayout';

// Block ids are one byte (<= 256 types). Orientation/variant is baked into distinct ids
// rather than a metadata byte. Pure data — no THREE — so it can be imported by workers.

export const B = {
  AIR: 0,
  BEDROCK: 1,
  STONE: 2,
  DIRT: 3,
  GRASS: 4,
  ASPHALT: 5,
  ASPHALT_LINE: 6,
  SIDEWALK: 7,
  CONCRETE: 8,
  CONCRETE_DARK: 9,
  CONCRETE_LIGHT: 10,
  BRICK: 11,
  GLASS: 12,
  GLASS_LIT: 13,
  STEEL: 14,
  RUBBLE: 15,
  FENCE: 16, // cutout: alpha-tested see-through lattice
};

// Face order everywhere in the engine: +x, -x, +y, -y, +z, -z.
export const FACE_PX = 0;
export const FACE_NX = 1;
export const FACE_PY = 2;
export const FACE_NY = 3;
export const FACE_PZ = 4;
export const FACE_NZ = 5;

// tiles: one tile name for all faces, or [top, side, bottom], or all six.
const DEFS = [
  { id: B.BEDROCK, name: 'bedrock', tiles: 'stone' },
  { id: B.STONE, name: 'stone', tiles: 'stone' },
  { id: B.DIRT, name: 'dirt', tiles: 'dirt' },
  { id: B.GRASS, name: 'grass', tiles: ['grass_top', 'grass_side', 'dirt'] },
  { id: B.ASPHALT, name: 'asphalt', tiles: ['asphalt', 'concrete_dark', 'concrete_dark'] },
  { id: B.ASPHALT_LINE, name: 'asphalt_line', tiles: ['asphalt_line', 'concrete_dark', 'concrete_dark'] },
  { id: B.SIDEWALK, name: 'sidewalk', tiles: ['sidewalk', 'concrete', 'concrete'] },
  { id: B.CONCRETE, name: 'concrete', tiles: 'concrete' },
  { id: B.CONCRETE_DARK, name: 'concrete_dark', tiles: 'concrete_dark' },
  { id: B.CONCRETE_LIGHT, name: 'concrete_light', tiles: 'concrete_light' },
  { id: B.BRICK, name: 'brick', tiles: 'brick' },
  // Glass is opaque for culling/sorting purposes: the whole city stays one opaque pass.
  { id: B.GLASS, name: 'glass', tiles: 'glass' },
  { id: B.GLASS_LIT, name: 'glass_lit', tiles: 'glass_lit' },
  { id: B.STEEL, name: 'steel', tiles: 'steel' },
  { id: B.RUBBLE, name: 'rubble', tiles: 'rubble' },
  { id: B.FENCE, name: 'fence', tiles: 'fence', cutout: true },
];

function expandTiles(t) {
  if (typeof t === 'string') return [t, t, t, t, t, t];
  if (t.length === 3) return [t[1], t[1], t[0], t[2], t[1], t[1]]; // top, side, bottom
  return t;
}

export const BLOCK_DEFS = [];
// Flat lookups for hot loops (index = block id).
export const SOLID = new Uint8Array(256); // blocks collision / is meshed
export const OPAQUE = new Uint8Array(256); // hides the faces of neighbours behind it
export const CUTOUT = new Uint8Array(256); // meshed in the alpha-tested pass, hides nothing
// Per block, per face: [u0, v0, u1, v1] as normalised Uint16 (0..65535).
export const BLOCK_UV = new Uint16Array(256 * 6 * 4);

for (const d of DEFS) {
  const tiles = expandTiles(d.tiles);
  BLOCK_DEFS[d.id] = { id: d.id, name: d.name, tiles };
  SOLID[d.id] = 1;
  OPAQUE[d.id] = d.cutout ? 0 : 1;
  CUTOUT[d.id] = d.cutout ? 1 : 0;
  for (let f = 0; f < 6; f++) {
    const uv = tileUV(TILE_INDEX[tiles[f]]);
    const o = (d.id * 6 + f) * 4;
    for (let k = 0; k < 4; k++) BLOCK_UV[o + k] = Math.round(uv[k] * 65535);
  }
}

// Baked "fake sun" brightness per face: top 1.0, N/S 0.86, E/W 0.72, bottom 0.55.
export const FACE_SHADE = [0.72, 0.72, 1.0, 0.55, 0.86, 0.86];
// Vertex colours are multiplied in *linear* space but the result is encoded to sRGB, so
// store the shade pre-converted to linear — a 0.55 face then reads as ~55% brightness.
export const FACE_SHADE_U8 = FACE_SHADE.map((s) => Math.round(Math.pow(s, 2.2) * 255));

// Ambient-occlusion multiplier per vertex, ao = 0 (boxed in) .. 3 (open). Pre-linearised for
// the same reason as FACE_SHADE_U8, then folded with the face shade: one byte per (face, ao).
export const AO_CURVE = [0.45, 0.65, 0.82, 1.0];
export const SHADE_AO = new Uint8Array(6 * 4);
for (let f = 0; f < 6; f++) {
  for (let ao = 0; ao < 4; ao++) {
    SHADE_AO[f * 4 + ao] = Math.round(FACE_SHADE_U8[f] * Math.pow(AO_CURVE[ao], 2.2));
  }
}

// Representative colour per block (sparks, hotbar swatches) — roughly each tile's average.
const COLORS = {
  bedrock: 0x3b3d40,
  stone: 0x7d7f83,
  dirt: 0x6b4a2f,
  grass: 0x5aa13e,
  asphalt: 0x2f3033,
  asphalt_line: 0x2f3033,
  sidewalk: 0xb3b0a8,
  concrete: 0x9a9a98,
  concrete_dark: 0x62646a,
  concrete_light: 0xc4c2bb,
  brick: 0x9c4a3a,
  glass: 0x1d3a52,
  glass_lit: 0xe9b04a,
  steel: 0x7b8794,
  rubble: 0x77736c,
  fence: 0x4a5260,
};
export const BLOCK_COLOR = new Uint32Array(256);
for (const d of DEFS) BLOCK_COLOR[d.id] = COLORS[d.name] ?? 0xff00ff;

// The world floor can't be dug through.
export const UNBREAKABLE = new Uint8Array(256);
UNBREAKABLE[B.BEDROCK] = 1;
