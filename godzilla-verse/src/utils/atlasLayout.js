/**
 * Pure atlas geometry — no THREE, no DOM — so the mesher (and later its Web Worker)
 * can compute UVs without pulling the renderer or a canvas into the worker bundle.
 * `atlas.js` paints the pixels; this file only knows where each tile lives.
 *
 * Layout: TILE px of content inside a CELL px cell. The extra GUTTER px on every
 * side replicate the tile's edge pixels so mipmapping never bleeds a neighbouring
 * tile across a block edge (the classic voxel-atlas bug, very visible on distant
 * facades). UVs are additionally inset half a texel.
 */

export const TILE = 16;
export const GUTTER = 2;
export const CELL = TILE + GUTTER * 2; // 20
export const GRID = 16; // 16 x 16 cells
export const ATLAS_SIZE = CELL * GRID; // 320

// Tile names, in atlas order. Index = tile id used by BLOCK_DEFS.
export const TILES = [
  'concrete',
  'concrete_dark',
  'concrete_light',
  'brick',
  'asphalt',
  'asphalt_line',
  'sidewalk',
  'glass',
  'glass_lit',
  'steel',
  'rubble',
  'dirt',
  'stone',
  'grass_top',
  'grass_side',
  'water',
  'dust',
  'fence',
];
export const TILE_INDEX = Object.fromEntries(TILES.map((n, i) => [n, i]));

export function cellOrigin(index) {
  return { x: (index % GRID) * CELL, y: Math.floor(index / GRID) * CELL };
}

/**
 * UV rectangle of a tile's *content* (gutter excluded), inset half a texel.
 * Returns [u0, v0, u1, v1] with v up (three.js convention, canvas y flipped).
 */
export function tileUV(name) {
  const i = typeof name === 'number' ? name : TILE_INDEX[name];
  const { x, y } = cellOrigin(i);
  const half = 0.5;
  const u0 = (x + GUTTER + half) / ATLAS_SIZE;
  const u1 = (x + GUTTER + TILE - half) / ATLAS_SIZE;
  const vTop = 1 - (y + GUTTER + half) / ATLAS_SIZE;
  const vBot = 1 - (y + GUTTER + TILE - half) / ATLAS_SIZE;
  return [u0, vBot, u1, vTop];
}
