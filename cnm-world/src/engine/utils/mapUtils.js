import { TILES } from '../constants/tileTypes';

// Standard wood-floor indoor room with wall rows at top
export const woodFloorRoom = (wallRows = 4) => (row, col) => {
  if (row <= wallRows - 1) return TILES.WALL;
  return TILES.FLOOR_WOOD;
};

// Outdoor room with grass and an optional stone path
export const outdoorRoom =
  (pathCenterX, pathWidth = 6) =>
  (row, col) => {
    if (pathCenterX !== undefined) {
      const half = Math.floor(pathWidth / 2);
      if (col >= pathCenterX - half && col <= pathCenterX + half) {
        return TILES.FLOOR_STONE;
      }
    }
    return TILES.FLOOR_GRASS;
  };

// Tile-floor room (kitchen / bathroom)
export const tileFloorRoom = (wallRows = 4) => (row, col) => {
  if (row <= wallRows - 1) return TILES.WALL;
  return TILES.FLOOR_TILE;
};

// Carpet room (bedroom / study)
export const carpetRoom = (wallRows = 4) => (row, col) => {
  if (row <= wallRows - 1) return TILES.WALL;
  return TILES.FLOOR_CARPET;
};
