import * as THREE from 'three';
import { mulberry32 } from './rng';
import { TILE, GUTTER, CELL, GRID, ATLAS_SIZE, TILES, cellOrigin } from './atlasLayout';

/**
 * Procedural Minecraft-style texture atlas, painted to a canvas at runtime —
 * no image assets to source, host or deploy. Where each tile lives (and the UV
 * math) is in atlasLayout.js so workers can use it without importing THREE.
 */

export { TILE, GUTTER, CELL, GRID, ATLAS_SIZE, TILES, TILE_INDEX, tileUV } from './atlasLayout';

// ---- painters -------------------------------------------------------------
// Each paints a TILE x TILE square at the context origin; the atlas builder
// translates the context to the right cell first.

const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function jitterColor(base, amount, rand) {
  const j = (rand() - 0.5) * 2 * amount;
  const r = Math.max(0, Math.min(255, ((base >> 16) & 255) + j));
  const g = Math.max(0, Math.min(255, ((base >> 8) & 255) + j));
  const b = Math.max(0, Math.min(255, (base & 255) + j));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// The Minecraft look: a flat colour with seeded per-pixel brightness jitter.
function noiseFill(ctx, base, amount, rand) {
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      ctx.fillStyle = jitterColor(base, amount, rand);
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

const PAINTERS = {
  concrete: (c, r) => noiseFill(c, 0x9a9a98, 9, r),
  concrete_dark: (c, r) => noiseFill(c, 0x62646a, 8, r),
  concrete_light: (c, r) => noiseFill(c, 0xc4c2bb, 8, r),

  brick(c, r) {
    noiseFill(c, 0x9c4a3a, 14, r);
    c.fillStyle = '#c9b8a6'; // mortar
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      c.fillRect(0, y + 3, TILE, 1);
      const off = row % 2 ? 4 : 0;
      for (let x = off; x < TILE + 8; x += 8) c.fillRect(x % TILE, y, 1, 3);
    }
  },

  asphalt: (c, r) => noiseFill(c, 0x2f3033, 7, r),

  asphalt_line(c, r) {
    noiseFill(c, 0x2f3033, 7, r);
    c.fillStyle = '#e8c547';
    c.fillRect(7, 0, 2, TILE);
  },

  sidewalk(c, r) {
    noiseFill(c, 0xb3b0a8, 6, r);
    c.fillStyle = 'rgba(70,70,70,0.45)';
    c.fillRect(0, 0, TILE, 1);
    c.fillRect(0, 0, 1, TILE);
  },

  glass(c, r) {
    noiseFill(c, 0x1d3a52, 6, r);
    c.fillStyle = 'rgba(160,210,240,0.35)'; // diagonal reflection streak
    for (let i = 0; i < TILE; i++) c.fillRect(i, TILE - 1 - i, 2, 1);
    c.fillStyle = '#10202e'; // mullion frame
    c.fillRect(0, 0, TILE, 1);
    c.fillRect(0, 0, 1, TILE);
  },

  glass_lit(c, r) {
    noiseFill(c, 0xe9b04a, 10, r);
    c.fillStyle = 'rgba(255,240,190,0.55)';
    c.fillRect(2, 2, TILE - 4, TILE - 4);
    c.fillStyle = 'rgba(90,60,20,0.8)'; // tiny occupant silhouette
    c.fillRect(7, 9, 2, 5);
    c.fillRect(7, 7, 2, 2);
    c.fillStyle = '#5a3d12';
    c.fillRect(0, 0, TILE, 1);
    c.fillRect(0, 0, 1, TILE);
  },

  steel(c, r) {
    noiseFill(c, 0x7b8794, 5, r);
    c.fillStyle = 'rgba(30,36,44,0.55)';
    c.fillRect(0, 0, TILE, 1);
    c.fillRect(0, TILE - 1, TILE, 1);
    c.fillStyle = 'rgba(220,228,236,0.5)'; // rivets
    for (const [x, y] of [[2, 3], [13, 3], [2, 12], [13, 12]]) c.fillRect(x, y, 1, 1);
  },

  rubble(c, r) {
    noiseFill(c, 0x77736c, 22, r);
    for (let i = 0; i < 9; i++) {
      c.fillStyle = jitterColor(0x4a4742, 20, r);
      c.fillRect((r() * 14) | 0, (r() * 14) | 0, 2 + ((r() * 2) | 0), 2);
    }
  },

  dirt: (c, r) => noiseFill(c, 0x6b4a2f, 12, r),
  stone: (c, r) => noiseFill(c, 0x7d7f83, 14, r),
  grass_top: (c, r) => noiseFill(c, 0x5aa13e, 14, r),

  grass_side(c, r) {
    noiseFill(c, 0x6b4a2f, 12, r);
    for (let x = 0; x < TILE; x++) {
      const d = 3 + ((r() * 3) | 0);
      for (let y = 0; y < d; y++) {
        c.fillStyle = jitterColor(0x5aa13e, 14, r);
        c.fillRect(x, y, 1, 1);
      }
    }
  },

  water: (c, r) => noiseFill(c, 0x2f6fb0, 10, r),

  dust(c) {
    // soft radial dot for dust/smoke particles
    const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, TILE, TILE);
  },
};

// ---- atlas ----------------------------------------------------------------

/** Paint every tile into a canvas, gutters included. Pure canvas, no THREE. */
export function paintAtlasCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;

  // Paint each tile on its own scratch canvas so the gutter can be built from it.
  const tileCanvas = document.createElement('canvas');
  tileCanvas.width = tileCanvas.height = TILE;
  const tctx = tileCanvas.getContext('2d');

  TILES.forEach((name, i) => {
    tctx.clearRect(0, 0, TILE, TILE);
    PAINTERS[name](tctx, mulberry32(0xc0ffee + i * 7919));
    const { x, y } = cellOrigin(i);
    // Gutter: stretch the edge row/column outward, then fill corners, then the tile.
    ctx.drawImage(tileCanvas, 0, 0, TILE, 1, x + GUTTER, y, TILE, GUTTER); // top
    ctx.drawImage(tileCanvas, 0, TILE - 1, TILE, 1, x + GUTTER, y + GUTTER + TILE, TILE, GUTTER); // bottom
    ctx.drawImage(tileCanvas, 0, 0, 1, TILE, x, y + GUTTER, GUTTER, TILE); // left
    ctx.drawImage(tileCanvas, TILE - 1, 0, 1, TILE, x + GUTTER + TILE, y + GUTTER, GUTTER, TILE); // right
    ctx.drawImage(tileCanvas, 0, 0, 1, 1, x, y, GUTTER, GUTTER);
    ctx.drawImage(tileCanvas, TILE - 1, 0, 1, 1, x + GUTTER + TILE, y, GUTTER, GUTTER);
    ctx.drawImage(tileCanvas, 0, TILE - 1, 1, 1, x, y + GUTTER + TILE, GUTTER, GUTTER);
    ctx.drawImage(tileCanvas, TILE - 1, TILE - 1, 1, 1, x + GUTTER + TILE, y + GUTTER + TILE, GUTTER, GUTTER);
    ctx.drawImage(tileCanvas, 0, 0, TILE, TILE, x + GUTTER, y + GUTTER, TILE, TILE);
  });
  return canvas;
}

let _texture = null;
export function atlasTexture() {
  if (!_texture) {
    _texture = new THREE.CanvasTexture(paintAtlasCanvas());
    _texture.magFilter = THREE.NearestFilter;
    _texture.minFilter = THREE.NearestMipmapNearestFilter;
    _texture.generateMipmaps = true;
    _texture.colorSpace = THREE.SRGBColorSpace;
    _texture.anisotropy = 4;
    _texture.needsUpdate = true;
  }
  return _texture;
}
