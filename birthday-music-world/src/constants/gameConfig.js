// Grid configuration matching sample4.png (32x32 tiles at 16px)
export const GRID_COLS = 32;
export const GRID_ROWS = 32;
export const TILE_SIZE = 16;
export const MAP_SIZE = GRID_COLS * TILE_SIZE; // 512px

// Mobile scaling
export const MOBILE_SCALE = 0.67;
export const SCALED_MAP_SIZE = MAP_SIZE * MOBILE_SCALE;

// Player sprite dimensions (180x240 source, scaled to 45x60)
export const SPRITE_WIDTH = 45;
export const SPRITE_HEIGHT = 60;

// Furniture scale factor
export const FURNITURE_SCALE = 2.25;

// Tile types (brick wall background throughout)
export const TILES = {
  EMPTY: 0,
  BRICK: 1,      // Brick floor/wall (default background)
  PINK_RUG: 2,   // Pink carpet area (bottom-left)
  BLUE_TILE: 3,  // Blue/turquoise counter tile (bottom-right)
  CREAM_TILE: 4, // Cream/peach tile (top-left Kitchen)
  GREEN_TILE: 5, // Green tile (top-right Dining)
  WALL: 6,       // Beige wall tile (north side)
};
