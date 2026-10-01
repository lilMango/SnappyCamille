import { carpetRoom } from '../../engine/utils/mapUtils';

export const secretRoomConfig = {
  id: 'secret-room',
  displayName: '✨ Secret Room',
  gridCols: 20,
  gridRows: 16,
  tileMapFactory: carpetRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [10, 10],
  furniture: [
    // Cozy intimate space
    { id: 'secret-rug', sprite: '/sprites/rug-pink-tile.png', x: 4, y: 6, width: 6, height: 5, collision: false },
    { id: 'secret-cushion1', sprite: '/sprites/floor-cushion.png', x: 5, y: 8, width: 1, height: 1, collision: false },
    { id: 'secret-cushion2', sprite: '/sprites/floor-cushion-dark.png', x: 7, y: 9, width: 1, height: 1, collision: false },
    { id: 'secret-lamp', sprite: '/sprites/floor-lamp.png', x: 15, y: 5, width: 1, height: 2, collision: true },
    { id: 'secret-plant1', sprite: '/sprites/plant-bonsai.png', x: 1, y: 5, width: 1, height: 2, collision: false },
    { id: 'secret-plant2', sprite: '/sprites/plant-snake.png', x: 17, y: 8, width: 1, height: 2, collision: false },
    { id: 'secret-table', sprite: '/sprites/table.png', x: 9, y: 6, width: 2, height: 1.5, collision: true },
    { id: 'secret-lights', sprite: '/sprites/lights-3.png', x: 4, y: 4, width: 3, height: 1, collision: false },
    { id: 'secret-chandelier', sprite: '/sprites/chandelier.png', x: 8, y: 4, width: 3, height: 2, collision: false },
  ],
  doors: [
    {
      id: 'to-bedroom',
      targetRoomId: 'bedroom',
      targetSpawnPoint: [20, 11],
      triggerBounds: { minX: 0, maxX: 3, minY: 6, maxY: 12 },
      spritePosition: { x: 0, y: 7 },
      spriteSize: { w: 2, h: 3 },
      label: 'Back to Bedroom',
      autoTrigger: false,
    },
  ],
  interactables: [],
  zones: [
    {
      id: 'secret-room',
      name: '✨ Secret Room',
      audioPath: '/audio/secret-room/ambient.mp3',
      bounds: { minX: 0, maxX: 20, minY: 0, maxY: 16 },
      color: '#ec4899',
    },
  ],
};
