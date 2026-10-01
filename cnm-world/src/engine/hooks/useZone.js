import { useState, useEffect, useCallback } from 'react';

export const useZone = (playerPos, zones) => {
  const [currentZone, setCurrentZone] = useState(null);

  const getZone = useCallback(
    (x, y) => {
      for (const zone of zones) {
        const { minX, maxX, minY, maxY } = zone.bounds;
        if (x >= minX && x < maxX && y >= minY && y < maxY) return zone;
      }
      return null;
    },
    [zones]
  );

  useEffect(() => {
    const zone = getZone(playerPos[0], playerPos[1]);
    if (zone?.id !== currentZone?.id) setCurrentZone(zone);
  }, [playerPos, getZone, currentZone]);

  return { currentZone };
};
