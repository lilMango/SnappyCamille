import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { stats } from '../store';
import { input } from '../utils/input';
import { FREE_CAM_START, START_FREE, SPAWN } from '../utils/worldSelect';

// Debug free camera (V toggles it). It does not own any input: look direction and key state
// come from InputController, so toggling hands over seamlessly in both directions — the
// free camera starts where the player camera was, and the player resumes where they stood.
//   WASD move · Space/E up · C/Q down · Shift fast · wheel: fly speed
// Mounted only while free-cam is on.

const MIN_SPEED = 2;
const MAX_SPEED = 120;

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _want = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

let placed = false; // the very first free-cam mount may place the camera (URL pose)

export default function FlyCamera() {
  const st = useRef({ speed: 14, vel: new THREE.Vector3() });

  useEffect(() => {
    const s = st.current;
    const wheel = (e) => {
      s.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, s.speed * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    };
    window.addEventListener('wheel', wheel, { passive: true });
    return () => window.removeEventListener('wheel', wheel);
  }, []);

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30); // a hitch must not teleport the camera
    const s = st.current;
    const k = input.keys;

    // First frame only: place the camera at the URL pose. (Done here, not in an effect:
    // drei swaps in its own default camera after mount, so an effect would move the old one.)
    if (!placed) {
      placed = true;
      if (START_FREE) {
        if (FREE_CAM_START) {
          camera.position.set(FREE_CAM_START.x, FREE_CAM_START.y, FREE_CAM_START.z);
          input.yaw = FREE_CAM_START.yaw;
          input.pitch = FREE_CAM_START.pitch;
        } else {
          camera.position.set(SPAWN.x, SPAWN.y + 7, SPAWN.z + 9); // ?free=1: above and behind the spawn
        }
      }
    }

    _euler.set(input.pitch, input.yaw, 0);
    camera.quaternion.setFromEuler(_euler);

    camera.getWorldDirection(_fwd);
    _right.crossVectors(_fwd, _up).normalize();

    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const u = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyC') || k.has('KeyQ') ? 1 : 0);
    _want.set(0, 0, 0).addScaledVector(_fwd, f).addScaledVector(_right, r).addScaledVector(_up, u);
    if (_want.lengthSq() > 0) _want.normalize();
    const fast = k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1;
    _want.multiplyScalar(s.speed * fast);

    easing.damp3(s.vel, _want, 0.08, dt); // frame-rate-independent acceleration
    camera.position.addScaledVector(s.vel, dt);
    stats.speed = s.speed * fast;
  });

  return null;
}
