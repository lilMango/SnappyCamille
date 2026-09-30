import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { player, useGame } from '../store';
import { latLonToDir, angularDistance } from '../utils/sphere';

/**
 * Fires when the player walks within `radius` (radians of arc) of a point at
 * (lat, lon). Shows `note` while near; clears it on leave. Optionally calls
 * onEnter once per approach (e.g. to trigger the birthday surprise).
 */
export function useProximityNote(lat, lon, note, { radius = 0.11, onEnter } = {}) {
  const dir = useRef(latLonToDir(lat, lon));
  const inside = useRef(false);

  useFrame(() => {
    const near = angularDistance(player.posDir, dir.current) < radius;
    if (near && !inside.current) {
      inside.current = true;
      if (note) useGame.getState().setNote(note);
      onEnter?.();
    } else if (!near && inside.current) {
      inside.current = false;
      // Only clear if this note is still the one showing.
      const g = useGame.getState();
      if (g.activeNote === note) g.clearNote();
    }
  });
}
