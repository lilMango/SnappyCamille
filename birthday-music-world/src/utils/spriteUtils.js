import { TILES } from '../constants/gameConfig';

// Sprite tile size in the spritesheet
const SPRITE_TILE_SIZE = 32;
const COLS = 5;

// Get tile style based on tile type (using floorX2.png with larger tiles)
export const getTileStyle = (tileType) => {
  // Helper to get position for a tile at [col, row]
  const getTilePos = (col, row) => ({
    backgroundImage: `url(${import.meta.env.BASE_URL}sprites/floors2.png)`,
    backgroundSize: `${SPRITE_TILE_SIZE * COLS}px auto`,
    backgroundPosition: `-${col * SPRITE_TILE_SIZE}px -${row * SPRITE_TILE_SIZE}px`,
    imageRendering: 'pixelated',
  });

  // Beige wall tile (north side) - top beige section from wall1.png
  if (tileType === TILES.WALL) {
    return {
      backgroundImage: `url(${import.meta.env.BASE_URL}sprites/wall-tiles.png)`,
      backgroundSize: `${SPRITE_TILE_SIZE * COLS}px auto`,
      backgroundPosition: `0px 0px`, // Top beige wall section
      imageRendering: 'pixelated',
    };
  }

  // Pink rug accent (row 2, col 0)
  if (tileType === TILES.PINK_RUG) {
    return getTilePos(0, 2);
  }

  // Cyan tile accent (row 3, col 0)
  if (tileType === TILES.BLUE_TILE) {
    return getTilePos(0, 3);
  }

  // Default: Tan/beige brick throughout (like sample4.png) - row 0, col 3
  return getTilePos(3, 0);
};
