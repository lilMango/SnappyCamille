import { woodFloorRoom } from '../../engine/utils/mapUtils';

export const hallwayConfig = {
  id: 'hallway',
  displayName: 'Hallway of Memories',
  gridCols: 32,
  gridRows: 16,
  tileMapFactory: woodFloorRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [16, 10],
  furniture: [
    // Photo frames on walls
    { id: 'frame-1', sprite: '/sprites/flower-frame.png', x: 6, y: 4, width: 1, height: 2, collision: false },
    { id: 'frame-2', sprite: '/sprites/flower-frame.png', x: 14, y: 4, width: 1, height: 2, collision: false },
    { id: 'frame-3', sprite: '/sprites/flower-frame.png', x: 22, y: 4, width: 1, height: 2, collision: false },
    // Shelf and plant as decor
    { id: 'shelf', sprite: '/sprites/shelf.png', x: 10, y: 4, width: 2, height: 1, collision: false },
    { id: 'plant-hall', sprite: '/sprites/plant.png', x: 16, y: 11, width: 1, height: 2, collision: false },
    // Floor lamp
    { id: 'lamp', sprite: '/sprites/floor-lamp.png', x: 29, y: 4, width: 1, height: 2, collision: true },
  ],
  doors: [
    // Front door back to frontyard (bottom of hallway)
    {
      id: 'to-frontyard',
      targetRoomId: 'frontyard',
      targetSpawnPoint: [16, 16],
      triggerBounds: { minX: 13, maxX: 19, minY: 13, maxY: 16 },
      spritePosition: { x: 14, y: 13 },
      spriteSize: { w: 3, h: 3 },
      label: 'Frontyard',
      autoTrigger: false,
    },
    // Kitchen — left wall, upper
    {
      id: 'to-kitchen',
      targetRoomId: 'kitchen',
      targetSpawnPoint: [24, 10],
      triggerBounds: { minX: 0, maxX: 3, minY: 4, maxY: 9 },
      spritePosition: { x: 0, y: 5 },
      spriteSize: { w: 2, h: 3 },
      label: 'Kitchen',
      autoTrigger: false,
    },
    // Study — left wall, lower
    {
      id: 'to-study',
      targetRoomId: 'study',
      targetSpawnPoint: [21, 10],
      triggerBounds: { minX: 0, maxX: 3, minY: 9, maxY: 14 },
      spritePosition: { x: 0, y: 10 },
      spriteSize: { w: 2, h: 3 },
      label: 'Study',
      autoTrigger: false,
    },
    // Music Room — right wall, upper
    {
      id: 'to-music-room',
      targetRoomId: 'music-room',
      targetSpawnPoint: [3, 10],
      triggerBounds: { minX: 29, maxX: 32, minY: 4, maxY: 9 },
      spritePosition: { x: 30, y: 5 },
      spriteSize: { w: 2, h: 3 },
      label: 'Music Room',
      autoTrigger: false,
    },
    // Bathroom — right wall, lower
    {
      id: 'to-bathroom',
      targetRoomId: 'bathroom',
      targetSpawnPoint: [8, 12],
      triggerBounds: { minX: 29, maxX: 32, minY: 9, maxY: 14 },
      spritePosition: { x: 30, y: 10 },
      spriteSize: { w: 2, h: 3 },
      label: 'Bathroom',
      autoTrigger: false,
    },
    // Living Room — center upper
    {
      id: 'to-living-room',
      targetRoomId: 'living-room',
      targetSpawnPoint: [16, 24],
      triggerBounds: { minX: 13, maxX: 19, minY: 4, maxY: 7 },
      spritePosition: { x: 14, y: 4 },
      spriteSize: { w: 3, h: 3 },
      label: 'Living Room',
      autoTrigger: false,
    },
  ],
  interactables: [],
  zones: [
    {
      id: 'hallway',
      name: 'Hallway of Memories',
      audioPath: '/audio/hallway/ambient.mp3',
      bounds: { minX: 0, maxX: 32, minY: 0, maxY: 16 },
      color: '#d97706',
    },
  ],
};
