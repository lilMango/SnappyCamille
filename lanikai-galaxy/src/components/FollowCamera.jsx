import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { easing } from 'maath';
import { player } from '../store';
import { tangentFrame } from '../utils/sphere';
import {
  CAM_BACK,
  CAM_HEIGHT,
  CAM_LOOK_HEIGHT,
  CAM_POS_SMOOTH,
  CAM_UP_SMOOTH,
  CAM_ROT_DECAY,
  CAM_AZIM_DECAY,
  CAM_SWEEP_SPEED,
} from '../constants/worldConfig';

const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _targetQuat = new THREE.Quaternion();

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Super Mario Galaxy / abeto-style follow camera. Instead of snapping to a
 * position, it ORBITS the character at a fixed radius via an azimuth angle
 * (`camAngle`), so it never lerps through her. Normally the azimuth chases
 * "directly behind"; on a turn-around it sweeps a slow 180° so her face is
 * visible for a moment before the camera wraps back behind her head.
 * Orientation uses a smoothed surface-normal "up" so the horizon never flips.
 */
export default function FollowCamera() {
  const camera = useThree((s) => s.camera);
  const smoothedUp = useRef(player.up.clone());
  const camAngle = useRef(player.heading + Math.PI);
  const lastSeq = useRef(player.camFlipSeq);
  const sweep = useRef(0); // remaining radians of a slow orbit (0 = normal chase)
  const started = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const up = player.up;
    const pos = player.groundPos; // follow the surface, not the jump arc
    tangentFrame(up, _east, _north);

    const target = player.heading + Math.PI; // "directly behind" azimuth

    // A turn-around bumps camFlipSeq — begin a slow 180° orbit.
    if (player.camFlipSeq !== lastSeq.current) {
      lastSeq.current = player.camFlipSeq;
      sweep.current = Math.PI;
    }

    if (sweep.current > 0) {
      const step = Math.min(sweep.current, CAM_SWEEP_SPEED * dt);
      camAngle.current -= step; // consistent orbit direction (face -> side -> back)
      sweep.current -= step;
    } else {
      // Normal play: chase "behind" along the shortest arc.
      camAngle.current += wrap(target - camAngle.current) * (1 - Math.exp(-CAM_AZIM_DECAY * dt));
    }

    // Horizontal offset direction at camAngle: north*cos - east*sin (matches the
    // heading basis, so camAngle = heading+π puts the camera behind the character).
    const a = camAngle.current;
    _offset.copy(_north).multiplyScalar(Math.cos(a)).addScaledVector(_east, -Math.sin(a));
    _desired.copy(pos).addScaledVector(_offset, CAM_BACK).addScaledVector(up, CAM_HEIGHT);

    _look.copy(pos).addScaledVector(up, CAM_LOOK_HEIGHT);

    if (!started.current) {
      camera.position.copy(_desired);
      smoothedUp.current.copy(up);
      started.current = true;
    } else {
      easing.damp3(camera.position, _desired, CAM_POS_SMOOTH, dt);
      easing.damp3(smoothedUp.current, up, CAM_UP_SMOOTH, dt);
    }

    smoothedUp.current.normalize();
    _m.lookAt(camera.position, _look, smoothedUp.current);
    _targetQuat.setFromRotationMatrix(_m);
    camera.quaternion.slerp(_targetQuat, 1 - Math.exp(-CAM_ROT_DECAY * dt));
  });

  return null;
}
