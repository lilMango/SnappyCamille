import { tileFloorRoom } from '../../engine/utils/mapUtils';

export const bathroomConfig = {
  id: 'bathroom',
  displayName: 'Bathroom',
  gridCols: 16,
  gridRows: 16,
  tileMapFactory: tileFloorRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [8, 10],
  furniture: [
    // Bathtub area (rubber duck lives here)
    { id: 'rug-bath', sprite: '/sprites/rug-cyan-tile.png', x: 1, y: 5, width: 4, height: 4, collision: false },
    { id: 'stool-bath', sprite: '/sprites/stool.png', x: 2, y: 5, width: 1, height: 1, collision: true },
    // Sink
    { id: 'sink-bath', sprite: '/sprites/sink-2.png', x: 12, y: 4, width: 2, height: 2, collision: true },
    // Plant
    { id: 'plant-bath', sprite: '/sprites/plant-cactus.png', x: 13, y: 10, width: 1, height: 2, collision: false },
    // Window
    { id: 'window-bath', sprite: '/sprites/window.png', x: 7, y: 4, width: 2, height: 2, collision: false },
  ],
  doors: [
    {
      id: 'to-hallway',
      targetRoomId: 'hallway',
      targetSpawnPoint: [30, 12],
      triggerBounds: { minX: 5, maxX: 11, minY: 13, maxY: 16 },
      spritePosition: { x: 6, y: 13 },
      spriteSize: { w: 3, h: 3 },
      label: 'Hallway',
      autoTrigger: false,
    },
  ],
  interactables: [
    {
      id: 'duck',
      anchorTile: { x: 3, y: 8 },
      proximityTiles: 2,
      promptText: 'Examine rubber duck',
    },
  ],
  zones: [
    {
      id: 'bathroom',
      name: 'Bathroom',
      audioPath: '/audio/bathroom/ambient.mp3',
      bounds: { minX: 0, maxX: 16, minY: 0, maxY: 16 },
      color: '#0ea5e9',
    },
  ],
};
