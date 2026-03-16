import { woodFloorRoom } from '../../engine/utils/mapUtils';

export const musicRoomConfig = {
  id: 'music-room',
  displayName: 'Music Room',
  gridCols: 28,
  gridRows: 24,
  tileMapFactory: woodFloorRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [14, 14],
  furniture: [
    // Left zone instruments / cushions
    { id: 'cushion-1', sprite: '/sprites/floor-cushion.png', x: 3, y: 12, width: 1, height: 1, collision: false },
    { id: 'cushion-2', sprite: '/sprites/floor-cushion.png', x: 5, y: 14, width: 1, height: 1, collision: false },
    { id: 'cushion-3', sprite: '/sprites/floor-cushion-dark.png', x: 4, y: 16, width: 1, height: 1, collision: false },
    { id: 'rug-music-l', sprite: '/sprites/rug-pink.png', x: 2, y: 11, width: 5, height: 7, collision: false },
    // Right zone (more formal)
    { id: 'bench-music', sprite: '/sprites/bench.png', x: 18, y: 12, width: 3, height: 1.5, collision: true },
    { id: 'table-music', sprite: '/sprites/coffee-table-red.png', x: 19, y: 15, width: 2, height: 2, collision: true },
    { id: 'rug-music-r', sprite: '/sprites/anchor-rug.png', x: 16, y: 10, width: 6, height: 8, collision: false },
    // Shared decor
    { id: 'plant-music1', sprite: '/sprites/plant-tall-tree.png', x: 1, y: 5, width: 2, height: 4, collision: true },
    { id: 'plant-music2', sprite: '/sprites/plant-tall-tree.png', x: 24, y: 5, width: 2, height: 4, collision: true },
    { id: 'window-music1', sprite: '/sprites/window.png', x: 8, y: 4, width: 2, height: 2, collision: false },
    { id: 'window-music2', sprite: '/sprites/window.png', x: 18, y: 4, width: 2, height: 2, collision: false },
    { id: 'lights-1', sprite: '/sprites/lights-1.png', x: 5, y: 4, width: 2, height: 1, collision: false },
    { id: 'lights-2', sprite: '/sprites/lights-2.png', x: 20, y: 4, width: 2, height: 1, collision: false },
  ],
  doors: [
    {
      id: 'to-hallway',
      targetRoomId: 'hallway',
      targetSpawnPoint: [30, 7],
      triggerBounds: { minX: 0, maxX: 3, minY: 9, maxY: 15 },
      spritePosition: { x: 0, y: 10 },
      spriteSize: { w: 2, h: 3 },
      label: 'Hallway',
      autoTrigger: false,
    },
  ],
  interactables: [],
  zones: [
    {
      id: 'music-chill',
      name: 'Chill Vibes',
      audioPath: '/audio/music-room/chill.mp3',
      bounds: { minX: 0, maxX: 14, minY: 4, maxY: 24 },
      color: '#f472b6',
    },
    {
      id: 'music-energy',
      name: 'Good Energy',
      audioPath: '/audio/music-room/energy.mp3',
      bounds: { minX: 14, maxX: 28, minY: 4, maxY: 24 },
      color: '#c084fc',
    },
  ],
};
