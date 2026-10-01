import { FURNITURE_SCALE } from '../constants/engineConfig';

// Build room tile map from roomConfig.tileMapFactory
export const createRoomMap = (roomConfig) => {
  const { gridCols, gridRows, tileMapFactory } = roomConfig;
  const map = [];
  for (let row = 0; row < gridRows; row++) {
    const rowData = [];
    for (let col = 0; col < gridCols; col++) {
      rowData.push(tileMapFactory(row, col));
    }
    map.push(rowData);
  }
  return map;
};

// Volume based on player distance from zone (full inside, fades over 10 tiles)
export const getVolumeFromDistance = (playerX, playerY, zone) => {
  const { minX, maxX, minY, maxY } = zone.bounds;
  const insideX = playerX >= minX && playerX < maxX;
  const insideY = playerY >= minY && playerY < maxY;
  if (insideX && insideY) return 1.0;

  let dx = 0;
  let dy = 0;
  if (playerX < minX) dx = minX - playerX;
  else if (playerX >= maxX) dx = playerX - maxX + 1;
  if (playerY < minY) dy = minY - playerY;
  else if (playerY >= maxY) dy = playerY - maxY + 1;

  const distance = Math.sqrt(dx * dx + dy * dy);
  const fadeDistance = 10;
  const volume = Math.max(0, 1 - distance / fadeDistance);
  return Math.pow(volume, 2);
};

// Parameterized collision check against roomConfig boundaries, wallRules, and furniture
export const checkCollision = (x, y, roomConfig) => {
  const { gridCols, gridRows, wallRules, furniture } = roomConfig;

  if (x < 0 || x >= gridCols || y < 0 || y >= gridRows) return { type: 'boundary' };
  if (wallRules && wallRules(x, y)) return { type: 'wall' };

  for (const item of furniture || []) {
    if (!item.collision) continue;
    const itemLeft = item.x;
    const itemRight = item.x + item.width * FURNITURE_SCALE;
    const itemTop = item.y;
    const itemBottom = item.y + item.height * FURNITURE_SCALE;
    if (x >= itemLeft && x < itemRight && y >= itemTop && y < itemBottom) {
      return { type: 'furniture', item };
    }
  }

  return false;
};
