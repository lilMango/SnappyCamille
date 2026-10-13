import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { player, camState, useGame } from '../store';
import { input } from '../utils/input';
import { world } from '../utils/voxelWorld';
import { createHit, raycastVoxel } from '../utils/raycast';
import { CAMERA, CAMERA_MODES } from '../constants/playerConfig';

/**
 * Minecraft-style camera shell. F5 cycles THIRD_BACK -> FIRST -> THIRD_FRONT.
 *
 * Third person: a boom from the player's eye along the look direction. The boom is
 * pulled in by voxel ray casts (a hard snap — the camera may never end up inside a
 * building) and eased back out. The Spider-Man feel (speed-scaled lag, FOV, roll, shake)
 * is layered on in phase 5; this is the structure it plugs into.
 *
 * Also publishes the ray block targeting uses (camState): from the camera through the
 * crosshair in back/first person, from the eye in front view.
 */

const _hit = createHit();
const _look = new THREE.Vector3(); // unit look direction
const _dir = new THREE.Vector3(); // boom direction, pivot -> camera
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// offsets (right, up) of the rays that guard the near plane: centre + 4 corners
const GUARD = [
  [0, 0],
  [0.25, 0.25],
  [-0.25, 0.25],
  [0.25, -0.25],
  [-0.25, -0.25],
];

export default function CameraRig() {
  const { camera } = useThree();
  const rig = useRef({ boom: CAMERA.boom, pivotY: player.eyeY, init: false, lastMode: -1 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const r = rig.current;
    const modeIdx = useGame.getState().cameraMode;
    const mode = CAMERA_MODES[modeIdx];

    if (!r.init) {
      r.pivotY = player.eyeY;
      r.init = true;
    }
    if (r.lastMode !== modeIdx) {
      r.lastMode = modeIdx;
      r.boom = mode === 'FIRST' ? 0 : r.boom; // keep the current boom when leaving first person
    }

    // look direction from yaw/pitch (yaw 0 looks toward -z)
    const cp = Math.cos(input.pitch);
    _look.set(-Math.sin(input.yaw) * cp, Math.sin(input.pitch), -Math.cos(input.yaw) * cp);

    // pivot = the player's eye; its height is damped so a step-up doesn't pop the view
    easing.damp(r, 'pivotY', player.eyeY, CAMERA.pivotSmooth, dt);
    const px = player.eyeX;
    const pz = player.eyeZ;

    if (mode === 'FIRST') {
      camera.position.set(px, player.eyeY, pz); // exact: no lag in first person
      camera.lookAt(px + _look.x, player.eyeY + _look.y, pz + _look.z);
      r.boom = 0;
      _origin.set(px, player.eyeY, pz);
      _fwd.copy(_look);
    } else {
      _pivot.set(px, r.pivotY, pz);
      // boom points away from where we look (behind) or toward it (front view)
      _dir.copy(_look).multiplyScalar(mode === 'THIRD_BACK' ? -1 : 1);

      // how far the boom can extend before a wall: the nearest of 5 guard rays
      _right.crossVectors(_dir, UP);
      if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
      _right.normalize();
      _up.crossVectors(_right, _dir).normalize();
      let safe = CAMERA.boom;
      for (let i = 0; i < GUARD.length; i++) {
        const ox = _pivot.x + _right.x * GUARD[i][0] + _up.x * GUARD[i][1];
        const oy = _pivot.y + _right.y * GUARD[i][0] + _up.y * GUARD[i][1];
        const oz = _pivot.z + _right.z * GUARD[i][0] + _up.z * GUARD[i][1];
        if (raycastVoxel(world, ox, oy, oz, _dir.x, _dir.y, _dir.z, CAMERA.boom + CAMERA.collideMargin, _hit)) {
          safe = Math.min(safe, _hit.t - CAMERA.collideMargin);
        }
      }
      safe = Math.max(0.35, safe);

      // asymmetric: squeeze in instantly (never end up inside a wall), ease back out
      if (safe < r.boom) r.boom = safe;
      else easing.damp(r, 'boom', safe, CAMERA.pullOutSmooth, dt);

      camera.position.set(_pivot.x + _dir.x * r.boom, _pivot.y + _dir.y * r.boom, _pivot.z + _dir.z * r.boom);
      camera.lookAt(_pivot);

      if (mode === 'THIRD_BACK') {
        // crosshair ray: from the camera, through the eye, out into the world
        _origin.copy(camera.position);
        _fwd.copy(_look);
      } else {
        // front view: the crosshair would point back at the player, so interact from the eye
        _origin.set(px, player.eyeY, pz);
        _fwd.copy(_look);
      }
    }

    camState.ox = _origin.x;
    camState.oy = _origin.y;
    camState.oz = _origin.z;
    camState.dx = _fwd.x;
    camState.dy = _fwd.y;
    camState.dz = _fwd.z;

    if (camera.fov !== CAMERA.fov) {
      camera.fov = CAMERA.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
