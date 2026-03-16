// Furniture/sprite data with exact positions matching sample4.png
export const furniture = [
  // Window embedded in the wall (centered with left edge at half width left of middle)
  { id: 'window-wall', sprite: `${import.meta.env.BASE_URL}sprites/window-large.png`, x: 15.1, y: 1.5, width: 1.8, height: 1.8, collision: false },

  // Fridge in top left quadrant (Kitchen area) - half on wall, half on tile
  { id: 'fridge', sprite: `${import.meta.env.BASE_URL}sprites/fridge.png`, x: 0.7, y: 2, width: 1.5, height: 3, collision: true },

  // Cabinets to the right of fridge against north wall
  { id: 'cabinet-1', sprite: `${import.meta.env.BASE_URL}sprites/cabinet.png`, x: 4, y: 3.5, width: 2, height: 2, collision: true },
  { id: 'cabinet-2', sprite: `${import.meta.env.BASE_URL}sprites/cabinet.png`, x: 8.5, y: 3.5, width: 2, height: 2, collision: true },

  // Flower frame above kitchen cabinet
  { id: 'flower-frame', sprite: `${import.meta.env.BASE_URL}sprites/flower-frame.png`, x: 6, y: 1.2, width: 0.75, height: 0.75, collision: false },

  // Sink on top of cabinet 2
  { id: 'sink', sprite: `${import.meta.env.BASE_URL}sprites/sink.png`, x: 9, y: 2.7, width: 1.5, height: 1.5, collision: false },

  // Kitchen islands
  { id: 'counter-base-1', sprite: `${import.meta.env.BASE_URL}sprites/counter-base.png`, x: 4, y: 10.5, width: 3.5, height: 2, collision: true },

  // Welcome mat at the entrance (bottom middle) - scaled to 33% (66% * 50%)
  { id: 'welcome-mat', sprite: `${import.meta.env.BASE_URL}sprites/welcome-mat.png`, x: 14, y: 30, width: 1.32, height: 0.66, collision: false },

  // Pink rug in the bottom-left lounge area (with padding from edges)
  { id: 'pink-rug', sprite: `${import.meta.env.BASE_URL}sprites/pink-rug.png`, x: 3, y: 19, width: 4.44, height: 4.89, collision: false },

  // Floor cushions on the red/pink rug (R&B lounge seating) - organic, uneven spacing
  // Left side cluster (original 4)
  { id: 'cushion-1', sprite: `${import.meta.env.BASE_URL}sprites/floor-cushion.png`, x: 3.2, y: 19.3, width: 1, height: 1, collision: false },
  { id: 'cushion-2', sprite: `${import.meta.env.BASE_URL}sprites/floor-cushion-dark.png`, x: 3.7, y: 20.5, width: 1, height: 1, collision: false },
  { id: 'cushion-3', sprite: `${import.meta.env.BASE_URL}sprites/floor-cushion.png`, x: 4.3, y: 21.2, width: 1, height: 1, collision: false },
  { id: 'cushion-4', sprite: `${import.meta.env.BASE_URL}sprites/floor-cushion-dark.png`, x: 3.7, y: 22.8, width: 1, height: 1, collision: false },
  // Right side cluster (new 3) - shifted more to the right
  { id: 'cushion-5', sprite: `${import.meta.env.BASE_URL}sprites/floor-cushion.png`, x: 6.2, y: 19.6, width: 1, height: 1, collision: false },
  { id: 'cushion-6', sprite: `${import.meta.env.BASE_URL}sprites/floor-cushion-dark.png`, x: 7.9, y: 20.5, width: 1, height: 1, collision: false },
  { id: 'cushion-7', sprite: `${import.meta.env.BASE_URL}sprites/floor-cushion.png`, x: 10.0, y: 22.4, width: 1, height: 1, collision: false },

  // Coffee table on red carpet (R&B lounge) - to the right of cushions
  { id: 'coffee-table-lounge', sprite: `${import.meta.env.BASE_URL}sprites/coffee-table-red.png`, x: 6.8, y: 22, width: 1.5, height: 1.2, collision: true },

  // Plants between lounge cushions and kitchen counter
  { id: 'plant-mid-1', sprite: `${import.meta.env.BASE_URL}sprites/plant-mid-1.png`, x: 3, y: 14, width: 1, height: 2.2, collision: false },
  { id: 'plant-mid-2', sprite: `${import.meta.env.BASE_URL}sprites/plant-mid-2.png`, x: 6, y: 15.9, width: 1, height: 1.2, collision: false },
  { id: 'plant-mid-3', sprite: `${import.meta.env.BASE_URL}sprites/plant-mid-3.png`, x: 9, y: 15.5, width: 1, height: 1.3, collision: false },

  // Floor lamp on top right corner of red rug
  { id: 'floor-lamp', sprite: `${import.meta.env.BASE_URL}sprites/floor-lamp.png`, x: 10, y: 16, width: 1, height: 2, collision: false },
  // Blue rug in the bottom-right counter area (with padding from edges)
  { id: 'blue-rug', sprite: `${import.meta.env.BASE_URL}sprites/blue-rug-new.png`, x: 17, y: 21, width: 5.78, height: 4.0, collision: false },

  // Bench between dining table and loveseat
  { id: 'bench', sprite: `${import.meta.env.BASE_URL}sprites/bench.png`, x: 20, y: 18, width: 3, height: 1, collision: true },

  // Plants on the bench
  { id: 'plant-bench-1', sprite: `${import.meta.env.BASE_URL}sprites/plant-bench-1.png`, x: 20.5, y: 15.9, width: 1, height: 1.5, collision: false },
  { id: 'plant-bench-2', sprite: `${import.meta.env.BASE_URL}sprites/plant-cactus.png`, x: 22.7, y: 16.8, width: 1.5, height: 1, collision: false },

  // Loveseat on the top edge of the cyan/blue rug
  { id: 'loveseat', sprite: `${import.meta.env.BASE_URL}sprites/loveseat.png`, x: 18.5, y: 20.5, width: 3.5, height: 2, collision: true },

  // Coffee table in the bottom right quadrant
  { id: 'coffee-table', sprite: `${import.meta.env.BASE_URL}sprites/table.png`, x: 19.65, y: 25.5, width: 2.5, height: 1.5, collision: true },

  // Dining set in the top right quadrant (Hawaiian Haven / Dining area)
  // Top and left chairs (rendered first so they appear below the table)
  { id: 'dining-chair-left', sprite: `${import.meta.env.BASE_URL}sprites/chair-1.png`, x: 19.0, y: 10.9, width: 1.2, height: 1.2, collision: true },
  { id: 'dining-chair-top', sprite: `${import.meta.env.BASE_URL}sprites/chair-2.png`, x: 21.4, y: 9, width: 1.2, height: 1.2, collision: true },
  // Round table
  { id: 'round-table', sprite: `${import.meta.env.BASE_URL}sprites/round-table.png`, x: 20.5, y: 10.5, width: 2, height: 2, collision: true },
  // Bottom chair (rendered last so it appears on top of the table)
  { id: 'dining-chair-bottom', sprite: `${import.meta.env.BASE_URL}sprites/chair-3.png`, x: 21.4, y: 12.8, width: 1.2, height: 1.2, collision: true },

  // Plants for decoration
  // Small plant on the bottom (near center-left)
  { id: 'plant-bottom', sprite: `${import.meta.env.BASE_URL}sprites/plant-small.png`, x: 9, y: 28, width: 1, height: 1, collision: true },

  // Shelf on north wall (between window and corner plant)
  { id: 'shelf', sprite: `${import.meta.env.BASE_URL}sprites/shelf.png`, x: 21, y: 4, width: 3, height: 1.5, collision: true },

  // Plant on north wall (between window and shelf)
  { id: 'plant-wall', sprite: `${import.meta.env.BASE_URL}sprites/plant-wall.png`, x: 18, y: 4, width: 1.5, height: 1.5, collision: true },

  // Plants along the east (right) wall
  { id: 'plant-east-1', sprite: `${import.meta.env.BASE_URL}sprites/plant-tall-tree.png`, x: 28.5, y: 3, width: 1.5, height: 2.5, collision: true },
  { id: 'plant-east-2', sprite: `${import.meta.env.BASE_URL}sprites/plant-snake.png`, x: 28.5, y: 15, width: 1.2, height: 2, collision: true },
  { id: 'plant-east-3', sprite: `${import.meta.env.BASE_URL}sprites/plant-bonsai.png`, x: 27., y: 25, width: 2, height: 2, collision: true },
];
