import { useEffect } from 'react';
import { stats } from '../store';

/**
 * Click `element` to capture the mouse; while captured, `onMove(dx, dy)` receives raw
 * movement deltas. Esc (browser-handled) releases it. `onMove` should be stable (a ref
 * callback) — it is read inside the listener, not subscribed to.
 */
export function usePointerLock(element, onMove) {
  useEffect(() => {
    if (!element) return undefined;

    const request = () => {
      if (document.pointerLockElement === element) return;
      const p = element.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {}); // user cancelled / not allowed
    };
    const move = (e) => {
      if (document.pointerLockElement === element) onMove(e.movementX, e.movementY);
    };
    const change = () => {
      stats.locked = document.pointerLockElement === element;
    };

    element.addEventListener('click', request);
    document.addEventListener('mousemove', move);
    document.addEventListener('pointerlockchange', change);
    return () => {
      element.removeEventListener('click', request);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('pointerlockchange', change);
      if (document.pointerLockElement === element) document.exitPointerLock?.();
      stats.locked = false;
    };
  }, [element, onMove]);
}
