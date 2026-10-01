import { carpetRoom } from '../../engine/utils/mapUtils';

export const studyConfig = {
  id: 'study',
  displayName: 'Study',
  gridCols: 24,
  gridRows: 22,
  tileMapFactory: carpetRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [12, 12],
  furniture: [
    // Bookcase (left wall)
    { id: 'bookcase-1', sprite: '/sprites/display-brown.png', x: 1, y: 4, width: 2, height: 3, collision: true },
    { id: 'bookcase-2', sprite: '/sprites/display-brown.png', x: 1, y: 7, width: 2, height: 3, collision: true },
    // Desk setup
    { id: 'desk', sprite: '/sprites/table-cream.png', x: 14, y: 6, width: 3, height: 2, collision: true },
    { id: 'desk-chair', sprite: '/sprites/chair-purple.png', x: 15, y: 9, width: 1, height: 1.5, collision: true },
    // Cozy reading chair
    { id: 'reading-chair', sprite: '/sprites/round-chair.png', x: 8, y: 14, width: 2, height: 2, collision: true },
    { id: 'side-table', sprite: '/sprites/table.png', x: 11, y: 15, width: 1, height: 1, collision: true },
    // Plants
    { id: 'plant-study1', sprite: '/sprites/plant-mid-1.png', x: 20, y: 5, width: 2, height: 3, collision: false },
    { id: 'plant-study2', sprite: '/sprites/plant-mid-2.png', x: 1, y: 16, width: 2, height: 3, collision: false },
    // Window
    { id: 'window-study', sprite: '/sprites/window.png', x: 10, y: 4, width: 2, height: 2, collision: false },
    // Rug
    { id: 'rug-study', sprite: '/sprites/rug-whale.png', x: 5, y: 13, width: 5, height: 4, collision: false },
    // Floor lamp
    { id: 'lamp-study', sprite: '/sprites/floor-lamp.png', x: 21, y: 14, width: 1, height: 2, collision: true },
  ],
  doors: [
    {
      id: 'to-hallway',
      targetRoomId: 'hallway',
      targetSpawnPoint: [2, 12],
      triggerBounds: { minX: 21, maxX: 24, minY: 9, maxY: 15 },
      spritePosition: { x: 22, y: 10 },
      spriteSize: { w: 2, h: 3 },
      label: 'Hallway',
      autoTrigger: false,
    },
  ],
  interactables: [
    {
      // Bookcase-2 bottom ≈ y=13.75 (y:7 + height:3 * scale:2.25)
      // Right edge ≈ x=5.5. Anchor to the right of the bookcase.
      id: 'bookcase',
      anchorTile: { x: 6, y: 8 },
      proximityTiles: 2,
      promptText: 'Browse bookcase',
    },
  ],
  zones: [
    {
      id: 'study',
      name: 'Study',
      audioPath: '/audio/study/ambient.mp3',
      bounds: { minX: 0, maxX: 24, minY: 0, maxY: 22 },
      color: '#475569',
    },
  ],
};
