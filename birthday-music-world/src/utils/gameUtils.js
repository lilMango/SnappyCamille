import { GRID_ROWS, GRID_COLS, TILES, FURNITURE_SCALE } from '../constants/gameConfig';
import { furniture } from '../constants/furnitureData';

// Create room map - consistent brown floor with beige wall on north side
export const createRoomMap = () => {
  const map = [];

  for (let row = 0; row < GRID_ROWS; row++) {
    const rowData = [];
    for (let col = 0; col < GRID_COLS; col++) {
      // Default: consistent brown/tan brick floor throughout (like sample4.png)
      let tile = TILES.BRICK;

      // Beige wall along the north side (top 6 rows - doubled height)
      if (row <= 5) {
        tile = TILES.WALL;
      }

      rowData.push(tile);
    }
    map.push(rowData);
  }

  return map;
};

// Pre-computed room map
export const roomMap = createRoomMap();

// Calculate volume based on distance from zone (closer = louder)
export const getVolumeFromDistance = (playerX, playerY, zone) => {
  const { minX, maxX, minY, maxY } = zone.bounds;

  // Check if player is inside the zone
  const insideX = playerX >= minX && playerX < maxX;
  const insideY = playerY >= minY && playerY < maxY;

  if (insideX && insideY) {
    // Inside the zone = full volume
    return 1.0;
  }

  // Calculate distance to nearest edge of zone
  let dx = 0;
  let dy = 0;

  if (playerX < minX) dx = minX - playerX;
  else if (playerX >= maxX) dx = playerX - maxX + 1;

  if (playerY < minY) dy = minY - playerY;
  else if (playerY >= maxY) dy = playerY - maxY + 1;

  const distance = Math.sqrt(dx * dx + dy * dy);

  // Fade out over ~10 tiles from the edge
  const fadeDistance = 10;
  const volume = Math.max(0, 1 - (distance / fadeDistance));

  // Apply easing for smoother fade
  return Math.pow(volume, 2);
};

// Check if position collides with furniture or walls
// Returns false for no collision, or { type, item? } for collision
// Objects are truthy so existing `if (checkCollision(...))` checks still work
export const checkCollision = (x, y) => {
  // Boundary check
  if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return { type: 'boundary' };

  // North wall collision (top 6 rows)
  if (y <= 5) return { type: 'wall' };

  // Furniture collision (scaled 2.25x)
  for (const item of furniture) {
    if (!item.collision) continue;
    const itemLeft = item.x;
    const itemRight = item.x + (item.width * FURNITURE_SCALE);
    const itemTop = item.y;
    const itemBottom = item.y + (item.height * FURNITURE_SCALE);

    if (x >= itemLeft && x < itemRight && y >= itemTop && y < itemBottom) {
      return { type: 'furniture', item };
    }
  }

  return false;
};
