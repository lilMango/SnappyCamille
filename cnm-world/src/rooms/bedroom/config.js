import { carpetRoom } from '../../engine/utils/mapUtils';

export const bedroomConfig = {
  id: 'bedroom',
  displayName: 'Bedroom',
  gridCols: 24,
  gridRows: 22,
  tileMapFactory: carpetRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [12, 13],
  furniture: [
    // Bed (top area)
    { id: 'lounge-bed-back', sprite: '/sprites/lounge-back.png', x: 3, y: 5, width: 4, height: 2, collision: true },
    { id: 'lounge-bed-front', sprite: '/sprites/lounge-front.png', x: 3, y: 7, width: 4, height: 2, collision: true },
    // Desk and journal
    { id: 'table-desk', sprite: '/sprites/table-wood.png', x: 16, y: 5, width: 3, height: 2, collision: true },
    { id: 'chair-desk', sprite: '/sprites/chair-wood.png', x: 17, y: 8, width: 1, height: 1.5, collision: true },
    // Bookshelf
    { id: 'shelf-bed', sprite: '/sprites/shelf.png', x: 1, y: 4, width: 2, height: 1, collision: false },
    // Plants
    { id: 'plant-bed1', sprite: '/sprites/plant-bonsai.png', x: 20, y: 4, width: 1, height: 2, collision: false },
    { id: 'plant-bed2', sprite: '/sprites/plant-snake.png', x: 1, y: 14, width: 1, height: 2, collision: false },
    // Rug
    { id: 'rug-bed', sprite: '/sprites/pink-rug.png', x: 3, y: 5, width: 4, height: 4, collision: false },
    // Window
    { id: 'window-bed', sprite: '/sprites/window.png', x: 10, y: 4, width: 2, height: 2, collision: false },
    // Floor lamp
    { id: 'lamp-bed', sprite: '/sprites/floor-lamp.png', x: 21, y: 8, width: 1, height: 2, collision: true },
  ],
  doors: [
    // Back to living room (top)
    {
      id: 'to-living-room',
      targetRoomId: 'living-room',
      targetSpawnPoint: [16, 23],
      triggerBounds: { minX: 9, maxX: 15, minY: 4, maxY: 7 },
      spritePosition: { x: 10, y: 4 },
      spriteSize: { w: 3, h: 3 },
      label: 'Living Room',
      autoTrigger: false,
    },
    // Garden (bottom)
    {
      id: 'to-garden',
      targetRoomId: 'garden',
      targetSpawnPoint: [20, 5],
      triggerBounds: { minX: 9, maxX: 15, minY: 19, maxY: 22 },
      spritePosition: { x: 10, y: 19 },
      spriteSize: { w: 3, h: 3 },
      label: 'Garden',
      autoTrigger: false,
    },
    // Secret Room (right wall, hidden — requires unlock)
    {
      id: 'to-secret-room',
      targetRoomId: 'secret-room',
      targetSpawnPoint: [3, 8],
      triggerBounds: { minX: 21, maxX: 24, minY: 8, maxY: 14 },
      spritePosition: { x: 22, y: 9 },
      spriteSize: { w: 2, h: 3 },
      label: 'Secret Room',
      requiresUnlock: 'secret-room',
      autoTrigger: false,
    },
  ],
  interactables: [
    {
      // Desk collision bottom ≈ y=9.5 (y:5 + height:2 * scale:2.25)
      // Anchor is just below the desk where the player can stand
      id: 'journal',
      anchorTile: { x: 18, y: 10 },
      proximityTiles: 2,
      promptText: 'Read journal',
    },
  ],
  zones: [
    {
      id: 'bedroom',
      name: 'Bedroom',
      audioPath: '/audio/bedroom/ambient.mp3',
      bounds: { minX: 0, maxX: 24, minY: 0, maxY: 22 },
      color: '#a78bfa',
    },
  ],
};
