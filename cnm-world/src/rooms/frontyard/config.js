import { outdoorRoom } from '../../engine/utils/mapUtils';

export const frontyardConfig = {
  id: 'frontyard',
  displayName: 'Frontyard',
  gridCols: 32,
  gridRows: 20,
  tileMapFactory: outdoorRoom(16, 6),
  wallRules: () => false,
  defaultSpawn: [16, 14],
  furniture: [
    // Welcome mat at front door
    { id: 'welcome-mat', sprite: '/sprites/welcome-mat.png', x: 14.5, y: 17.5, width: 2, height: 1, collision: false },
    // Trees framing the yard
    { id: 'tree-tl', sprite: '/sprites/plant-tall-tree.png', x: 1, y: 1, width: 2, height: 4, collision: true },
    { id: 'tree-tr', sprite: '/sprites/plant-tall-tree.png', x: 28, y: 1, width: 2, height: 4, collision: true },
    { id: 'tree-ml', sprite: '/sprites/plant-large.png', x: 3, y: 8, width: 2, height: 3, collision: true },
    { id: 'tree-mr', sprite: '/sprites/plant-large.png', x: 26, y: 8, width: 2, height: 3, collision: true },
    // Plants along the sides
    { id: 'plant-l1', sprite: '/sprites/plant.png', x: 5, y: 5, width: 1, height: 2, collision: false },
    { id: 'plant-r1', sprite: '/sprites/plant.png', x: 25, y: 5, width: 1, height: 2, collision: false },
    { id: 'plant-l2', sprite: '/sprites/plant.png', x: 2, y: 13, width: 1, height: 2, collision: false },
    { id: 'plant-r2', sprite: '/sprites/plant.png', x: 28, y: 13, width: 1, height: 2, collision: false },
  ],
  doors: [
    {
      id: 'to-hallway',
      targetRoomId: 'hallway',
      targetSpawnPoint: [16, 12],
      triggerBounds: { minX: 13, maxX: 19, minY: 0, maxY: 3 },
      spritePosition: { x: 14, y: 0 },
      spriteSize: { w: 3, h: 3 },
      label: 'Enter House',
      autoTrigger: false,
    },
  ],
  interactables: [],
  zones: [
    {
      id: 'frontyard',
      name: 'Frontyard',
      audioPath: '/audio/frontyard/ambient.mp3',
      bounds: { minX: 0, maxX: 32, minY: 0, maxY: 20 },
      color: '#16a34a',
    },
  ],
};
