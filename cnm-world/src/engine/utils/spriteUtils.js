import { TILES } from '../constants/tileTypes';

const SPRITE_TILE_SIZE = 32;
const COLS = 5;

export const getTileStyle = (tileType) => {
  const getTilePos = (col, row) => ({
    backgroundImage: `url(${import.meta.env.BASE_URL}sprites/floors2.png)`,
    backgroundSize: `${SPRITE_TILE_SIZE * COLS}px auto`,
    backgroundPosition: `-${col * SPRITE_TILE_SIZE}px -${row * SPRITE_TILE_SIZE}px`,
    imageRendering: 'pixelated',
  });

  if (tileType === TILES.WALL) {
    return {
      backgroundImage: `url(${import.meta.env.BASE_URL}sprites/wall-tiles.png)`,
      backgroundSize: `${SPRITE_TILE_SIZE * COLS}px auto`,
      backgroundPosition: '0px 0px',
      imageRendering: 'pixelated',
    };
  }
  if (tileType === TILES.FLOOR_CARPET) return getTilePos(0, 2);
  if (tileType === TILES.FLOOR_TILE) return getTilePos(0, 3);
  if (tileType === TILES.FLOOR_GRASS) return getTilePos(2, 0);
  if (tileType === TILES.FLOOR_STONE) return getTilePos(1, 3);
  // Default: wood/brick floor
  return getTilePos(3, 0);
};
