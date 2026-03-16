import { tileFloorRoom } from '../../engine/utils/mapUtils';

export const kitchenConfig = {
  id: 'kitchen',
  displayName: 'Kitchen',
  gridCols: 28,
  gridRows: 24,
  tileMapFactory: tileFloorRoom(4),
  wallRules: (x, y) => y <= 3,
  defaultSpawn: [14, 12],
  furniture: [
    // Fridge (top-left corner)
    { id: 'fridge', sprite: '/sprites/fridge.png', x: 1, y: 4, width: 1.5, height: 3, collision: true },
    // Cabinets
    { id: 'cabinet-1', sprite: '/sprites/cabinet.png', x: 3, y: 4, width: 1.5, height: 2, collision: true },
    { id: 'cabinet-2', sprite: '/sprites/cabinet.png', x: 5, y: 4, width: 1.5, height: 2, collision: true },
    // Sink and stove
    { id: 'sink', sprite: '/sprites/sink.png', x: 7, y: 4, width: 1.5, height: 2, collision: true },
    { id: 'stove', sprite: '/sprites/stove.png', x: 9, y: 4, width: 2, height: 2, collision: true },
    // Counter base
    { id: 'counter', sprite: '/sprites/counter-base.png', x: 11, y: 4, width: 2, height: 2, collision: true },
    // Coffee machine
    { id: 'coffee-machine', sprite: '/sprites/coffee-machine.png', x: 14, y: 4, width: 1, height: 1, collision: false },
    // Dining table + chairs
    { id: 'dining-table', sprite: '/sprites/round-table.png', x: 8, y: 14, width: 3, height: 3, collision: true },
    { id: 'chair-1', sprite: '/sprites/chair.png', x: 7, y: 13, width: 1, height: 1.5, collision: true },
    { id: 'chair-2', sprite: '/sprites/chair.png', x: 12, y: 13, width: 1, height: 1.5, collision: true },
    { id: 'chair-3', sprite: '/sprites/chair.png', x: 7, y: 17, width: 1, height: 1.5, collision: true },
    { id: 'chair-4', sprite: '/sprites/chair.png', x: 12, y: 17, width: 1, height: 1.5, collision: true },
    // Plants
    { id: 'plant-k1', sprite: '/sprites/plant.png', x: 24, y: 5, width: 1, height: 2, collision: false },
    { id: 'plant-k2', sprite: '/sprites/plant-small.png', x: 2, y: 18, width: 1, height: 1, collision: false },
    // Window
    { id: 'window-k', sprite: '/sprites/window.png', x: 20, y: 4, width: 2, height: 2, collision: false },
    // Blue rug under dining
    { id: 'rug-k', sprite: '/sprites/blue-rug.png', x: 6, y: 13, width: 7, height: 6, collision: false },
  ],
  doors: [
    {
      id: 'to-hallway',
      targetRoomId: 'hallway',
      targetSpawnPoint: [2, 7],
      triggerBounds: { minX: 24, maxX: 28, minY: 9, maxY: 15 },
      spritePosition: { x: 25, y: 10 },
      spriteSize: { w: 2, h: 3 },
      label: 'Hallway',
      autoTrigger: false,
    },
  ],
  interactables: [
    {
      // Fridge collision bottom ≈ y=10.75 (y:4 + height:3 * scale:2.25)
      // Anchor is below the fridge where the player can stand
      id: 'fridge',
      anchorTile: { x: 2, y: 11 },
      proximityTiles: 2,
      promptText: 'Open Fridge',
    },
  ],
  zones: [
    {
      id: 'kitchen',
      name: 'Kitchen',
      audioPath: '/audio/kitchen/ambient.mp3',
      bounds: { minX: 0, maxX: 28, minY: 0, maxY: 24 },
      color: '#f97316',
    },
  ],
};
