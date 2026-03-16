import { woodFloorRoom } from '../../engine/utils/mapUtils';

export const livingRoomConfig = {
  id: 'living-room',
  displayName: 'Living Room',
  gridCols: 32,
  gridRows: 28,
  tileMapFactory: woodFloorRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [16, 14],
  furniture: [
    // Couch area
    { id: 'lounge-back', sprite: '/sprites/lounge-back.png', x: 10, y: 8, width: 4, height: 2, collision: true },
    { id: 'lounge-front', sprite: '/sprites/lounge-front.png', x: 10, y: 10, width: 4, height: 2, collision: true },
    { id: 'lounge-chair', sprite: '/sprites/lounge-chair-front.png', x: 16, y: 9, width: 2, height: 2, collision: true },
    { id: 'coffee-table', sprite: '/sprites/coffee-table-red.png', x: 11, y: 12, width: 2, height: 2, collision: true },
    // TV area
    { id: 'shelf-tv', sprite: '/sprites/shelf.png', x: 13, y: 5, width: 4, height: 1, collision: false },
    { id: 'window-lr', sprite: '/sprites/window.png', x: 6, y: 4, width: 2, height: 2, collision: false },
    { id: 'window-lr2', sprite: '/sprites/window.png', x: 23, y: 4, width: 2, height: 2, collision: false },
    // Plants
    { id: 'plant-lr1', sprite: '/sprites/plant-large.png', x: 3, y: 6, width: 2, height: 3, collision: true },
    { id: 'plant-lr2', sprite: '/sprites/plant-large.png', x: 26, y: 6, width: 2, height: 3, collision: true },
    // Pink rug
    { id: 'rug-lr', sprite: '/sprites/pink-rug.png', x: 8, y: 8, width: 6, height: 5, collision: false },
    // Floor lamp
    { id: 'lamp-lr', sprite: '/sprites/floor-lamp.png', x: 20, y: 8, width: 1, height: 2, collision: true },
  ],
  doors: [
    // Back to hallway (top)
    {
      id: 'to-hallway',
      targetRoomId: 'hallway',
      targetSpawnPoint: [16, 5],
      triggerBounds: { minX: 13, maxX: 19, minY: 4, maxY: 7 },
      spritePosition: { x: 14, y: 4 },
      spriteSize: { w: 3, h: 3 },
      label: 'Hallway',
      autoTrigger: false,
    },
    // Bedroom (bottom)
    {
      id: 'to-bedroom',
      targetRoomId: 'bedroom',
      targetSpawnPoint: [12, 5],
      triggerBounds: { minX: 13, maxX: 19, minY: 24, maxY: 28 },
      spritePosition: { x: 14, y: 24 },
      spriteSize: { w: 3, h: 3 },
      label: 'Bedroom',
      autoTrigger: false,
    },
  ],
  interactables: [],
  zones: [
    {
      id: 'living-room',
      name: 'Living Room',
      audioPath: '/audio/living-room/ambient.mp3',
      bounds: { minX: 0, maxX: 32, minY: 0, maxY: 28 },
      color: '#ec4899',
    },
  ],
};
