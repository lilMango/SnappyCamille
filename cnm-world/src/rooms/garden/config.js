import { outdoorRoom } from '../../engine/utils/mapUtils';

export const gardenConfig = {
  id: 'garden',
  displayName: 'Garden',
  gridCols: 40,
  gridRows: 28,
  tileMapFactory: outdoorRoom(20, 8),
  wallRules: () => false,
  defaultSpawn: [20, 20],
  furniture: [
    // Patio set (stone path area)
    { id: 'patio-table', sprite: '/sprites/round-table.png', x: 18, y: 16, width: 3, height: 3, collision: true },
    { id: 'patio-chair1', sprite: '/sprites/chair.png', x: 16, y: 15, width: 1, height: 1.5, collision: true },
    { id: 'patio-chair2', sprite: '/sprites/chair.png', x: 22, y: 15, width: 1, height: 1.5, collision: true },
    { id: 'patio-chair3', sprite: '/sprites/chair.png', x: 16, y: 19, width: 1, height: 1.5, collision: true },
    { id: 'patio-chair4', sprite: '/sprites/chair.png', x: 22, y: 19, width: 1, height: 1.5, collision: true },
    // BBQ grill area
    { id: 'stool-bbq', sprite: '/sprites/stool.png', x: 28, y: 18, width: 1, height: 1, collision: true },
    { id: 'bench-bbq', sprite: '/sprites/bench.png', x: 26, y: 20, width: 3, height: 1.5, collision: true },
    // Photo album on table
    { id: 'album-spot', sprite: '/sprites/display-pink.png', x: 8, y: 20, width: 2, height: 2, collision: false },
    // Lots of plants
    { id: 'tree-g1', sprite: '/sprites/plant-tall-tree.png', x: 1, y: 1, width: 2, height: 4, collision: true },
    { id: 'tree-g2', sprite: '/sprites/plant-tall-tree.png', x: 36, y: 1, width: 2, height: 4, collision: true },
    { id: 'tree-g3', sprite: '/sprites/plant-tall-tree.png', x: 1, y: 20, width: 2, height: 4, collision: true },
    { id: 'tree-g4', sprite: '/sprites/plant-tall-tree.png', x: 36, y: 20, width: 2, height: 4, collision: true },
    { id: 'plant-g1', sprite: '/sprites/plant-large.png', x: 4, y: 5, width: 2, height: 3, collision: true },
    { id: 'plant-g2', sprite: '/sprites/plant-large.png', x: 33, y: 5, width: 2, height: 3, collision: true },
    { id: 'plant-g3', sprite: '/sprites/plant-bench-1.png', x: 10, y: 10, width: 2, height: 2, collision: false },
    { id: 'plant-g4', sprite: '/sprites/plant-bench-2.png', x: 27, y: 10, width: 2, height: 2, collision: false },
    { id: 'plant-g5', sprite: '/sprites/plant-mid-3.png', x: 6, y: 15, width: 2, height: 3, collision: false },
    { id: 'plant-g6', sprite: '/sprites/plant-cactus.png', x: 31, y: 15, width: 1, height: 2, collision: false },
  ],
  doors: [
    // Back to bedroom (top center)
    {
      id: 'to-bedroom',
      targetRoomId: 'bedroom',
      targetSpawnPoint: [12, 20],
      triggerBounds: { minX: 17, maxX: 23, minY: 0, maxY: 3 },
      spritePosition: { x: 18, y: 0 },
      spriteSize: { w: 3, h: 3 },
      label: 'Bedroom',
      autoTrigger: false,
    },
  ],
  interactables: [
    {
      id: 'photo-album',
      anchorTile: { x: 9, y: 21 },
      proximityTiles: 2,
      promptText: 'Look at photo album',
    },
  ],
  zones: [
    {
      id: 'garden',
      name: 'Garden',
      audioPath: '/audio/garden/ambient.mp3',
      bounds: { minX: 0, maxX: 40, minY: 0, maxY: 28 },
      color: '#4ade80',
    },
  ],
};
