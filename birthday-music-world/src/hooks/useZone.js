import { useState, useEffect, useCallback } from 'react';
import { zones } from '../constants/zoneConfig';

export const useZone = (playerPos) => {
  const [currentZone, setCurrentZone] = useState(null);

  // Determine which zone the player is in
  const getZone = useCallback((x, y) => {
    for (const [key, zone] of Object.entries(zones)) {
      if (x >= zone.bounds.minX && x < zone.bounds.maxX &&
          y >= zone.bounds.minY && y < zone.bounds.maxY) {
        return { key, ...zone };
      }
    }
    return null;
  }, []);

  // Update zone when player moves
  useEffect(() => {
    const zone = getZone(playerPos[0], playerPos[1]);
    if (zone && zone.key !== currentZone?.key) {
      setCurrentZone(zone);
    }
  }, [playerPos, getZone, currentZone]);

  return { currentZone };
};
