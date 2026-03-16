import { useState, useEffect } from 'react';

// Returns the door the player is currently standing in (if any).
// Doors with requiresUnlock are hidden until that roomId is in unlockedRooms.
export const useDoorDetection = (playerPos, doors, unlockedRooms) => {
  const [activeDoor, setActiveDoor] = useState(null);

  useEffect(() => {
    const [x, y] = playerPos;
    const visibleDoors = (doors || []).filter((door) => {
      if (door.requiresUnlock && !unlockedRooms.has(door.requiresUnlock)) return false;
      return true;
    });
    const entered = visibleDoors.find((door) => {
      const { minX, maxX, minY, maxY } = door.triggerBounds;
      return x >= minX && x < maxX && y >= minY && y < maxY;
    });
    setActiveDoor(entered || null);
  }, [playerPos, doors, unlockedRooms]);

  return { activeDoor };
};
