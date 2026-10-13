import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { stats } from '../store';
import { chunkMaterial } from '../utils/chunkMaterial';
import { usePointerLock } from '../hooks/usePointerLock';

// Phase-1 free-fly camera for inspecting the voxel engine. Replaced by the player
// controller + CameraRig in phase 3.
//   click: capture mouse · WASD move · Space/E up · C/Q down · Shift fast
//   wheel: fly speed · G: wireframe · Esc: release mouse

const DEFAULT_START = { x: 32, y: 52, z: 108, yaw: 0, pitch: -0.28 };

// Debug URL params, for reproducible shots: ?cam=x,y,z,yawDeg,pitchDeg  and  ?wire=1
function readStart() {
  const q = new URLSearchParams(window.location.search);
  const c = (q.get('cam') || '').split(',').map(Number);
  if (c.length === 5 && c.every(Number.isFinite)) {
    return { x: c[0], y: c[1], z: c[2], yaw: (c[3] * Math.PI) / 180, pitch: (c[4] * Math.PI) / 180 };
  }
  return DEFAULT_START;
}
const START = readStart();
const MIN_SPEED = 2;
const MAX_SPEED = 120;
const LOOK = 0.0022; // radians per pixel
const MAX_PITCH = Math.PI / 2 - 0.01;

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _want = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export default function FlyCamera() {
  const { gl, camera } = useThree();
  const state = useRef({
    keys: new Set(),
    yaw: START.yaw,
    pitch: START.pitch,
    speed: 14,
    vel: new THREE.Vector3(),
  });

  useEffect(() => {
    camera.position.set(START.x, START.y, START.z);
    if (new URLSearchParams(window.location.search).get('wire') === '1') chunkMaterial().wireframe = true;
  }, [camera]);

  const onLook = useCallback((dx, dy) => {
    const s = state.current;
    s.yaw -= dx * LOOK;
    s.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, s.pitch - dy * LOOK));
  }, []);
  usePointerLock(gl.domElement, onLook);

  useEffect(() => {
    const s = state.current;
    const down = (e) => {
      s.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyG' && !e.repeat) {
        const m = chunkMaterial();
        m.wireframe = !m.wireframe;
      }
    };
    const up = (e) => s.keys.delete(e.code);
    const blur = () => s.keys.clear();
    const wheel = (e) => {
      s.speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, s.speed * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('wheel', wheel, { passive: true });
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('wheel', wheel);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30); // a hitch must not teleport the camera
    const s = state.current;
    const k = s.keys;

    _euler.set(s.pitch, s.yaw, 0);
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
    stats.x = camera.position.x;
    stats.y = camera.position.y;
    stats.z = camera.position.z;
  });

  return null;
}
