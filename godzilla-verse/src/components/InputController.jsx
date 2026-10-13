import { useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { input, releaseAll } from '../utils/input';
import { usePointerLock } from '../hooks/usePointerLock';
import { useGame } from '../store';
import { CAMERA } from '../constants/playerConfig';
import { chunkWireframe, setChunkWireframe } from '../utils/chunkMaterial';
import { START_WIREFRAME } from '../utils/worldSelect';

/**
 * Owns every DOM input listener and the look direction. Mount it FIRST in the scene so
 * yaw/pitch are up to date before the player, camera and interaction read them.
 *
 *   click canvas: capture mouse      Esc: release
 *   WASD / arrows move · Shift sprint · Space jump
 *   LMB break · RMB place · 1-9 or wheel: hotbar
 *   F5 camera (third / first / front) · V free camera · G wireframe
 */
export default function InputController() {
  const { gl } = useThree();

  // mouse look (only while the pointer is captured)
  const onLook = useCallback((dx, dy) => {
    input.lookDX += dx;
    input.lookDY += dy;
  }, []);
  usePointerLock(gl.domElement, onLook);

  useEffect(() => {
    const canvas = gl.domElement;
    const locked = () => document.pointerLockElement === canvas;
    if (START_WIREFRAME) setChunkWireframe(true);

    const keydown = (e) => {
      if (e.code === 'F5') {
        e.preventDefault(); // don't reload the page
        if (!e.repeat) useGame.getState().cycleCamera();
        return;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      input.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyV') useGame.getState().toggleFreeCam();
      else if (e.code === 'KeyG') setChunkWireframe(!chunkWireframe());
      else if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) useGame.getState().selectHotbar(n - 1);
      }
    };
    const keyup = (e) => input.keys.delete(e.code);

    const mousedown = (e) => {
      if (!locked()) return; // the first click only captures the mouse
      if (e.button === 0) input.breakHeld = true;
      if (e.button === 2) input.placeHeld = true;
    };
    const mouseup = (e) => {
      if (e.button === 0) input.breakHeld = false;
      if (e.button === 2) input.placeHeld = false;
    };
    const wheel = (e) => {
      if (useGame.getState().freeCam) return; // the free camera uses the wheel for speed
      useGame.getState().scrollHotbar(e.deltaY > 0 ? 1 : -1);
    };
    const contextmenu = (e) => e.preventDefault();
    const lockChange = () => {
      if (!locked()) releaseAll(); // Esc while holding W must not leave you running
    };

    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', releaseAll);
    window.addEventListener('mousedown', mousedown);
    window.addEventListener('mouseup', mouseup);
    window.addEventListener('wheel', wheel, { passive: true });
    canvas.addEventListener('contextmenu', contextmenu);
    document.addEventListener('pointerlockchange', lockChange);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('mousedown', mousedown);
      window.removeEventListener('mouseup', mouseup);
      window.removeEventListener('wheel', wheel);
      canvas.removeEventListener('contextmenu', contextmenu);
      document.removeEventListener('pointerlockchange', lockChange);
    };
  }, [gl]);

  // integrate the accumulated look deltas into yaw/pitch, once per frame
  useFrame(() => {
    input.yaw -= input.lookDX * CAMERA.lookSpeed;
    input.pitch = Math.max(-CAMERA.maxPitch, Math.min(CAMERA.maxPitch, input.pitch - input.lookDY * CAMERA.lookSpeed));
    input.lookDX = 0;
    input.lookDY = 0;
  });

  return null;
}
