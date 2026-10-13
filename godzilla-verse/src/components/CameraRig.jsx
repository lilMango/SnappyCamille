import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import { player, odm, camState, useGame, stats } from '../store';
import { input } from '../utils/input';
import { world } from '../utils/voxelWorld';
import { createHit, raycastVoxel } from '../utils/raycast';
import { tickShake, traumaNow } from '../utils/shake';
import { CAMERA, CAMERA_MODES } from '../constants/playerConfig';
import { ODM } from '../constants/odmConfig';

/**
 * The camera: a Minecraft shell (F5 cycles third-back -> first -> third-front) with the
 * PS5-Spider-Man layers on top, all driven by how fast you are moving:
 *
 *  - lagging pivot: the point the boom hangs from trails the player, more the faster you go,
 *    and leads along the velocity a little, so the camera chases you through a swing;
 *  - FOV opens up with speed (and punches on a dash);
 *  - the view banks into turns (roll from the rate of change of heading);
 *  - the boom lengthens at speed and is still pulled in by voxel ray casts (a hard snap — the
 *    camera may never end up inside a building — eased back out);
 *  - when you are swinging and not touching the mouse, it slowly swings round behind the motion;
 *  - trauma shake, applied last so it never pollutes the damped state.
 *
 * It also publishes the ray block targeting and the hooks fire along (camState): from the
 * camera through the crosshair in back/first person, from the eye in front view.
 */

const _hit = createHit();
const _look = new THREE.Vector3(); // unit look direction
const _dir = new THREE.Vector3(); // boom direction, pivot -> camera
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _target = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _shake = { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, z: 0 };

// offsets (right, up) of the rays that guard the near plane: centre + 4 corners
const GUARD = [
  [0, 0],
  [0.25, 0.25],
  [-0.25, 0.25],
  [0.25, -0.25],
  [-0.25, -0.25],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export default function CameraRig() {
  const { camera } = useThree();
  const rig = useRef({
    boom: CAMERA.boom,
    pivot: new THREE.Vector3(player.eyeX, player.eyeY, player.eyeZ),
    init: false,
    roll: 0,
    lastHeading: 0,
    fovPunch: 0,
    lastMode: -1,
  });

  useEffect(() => {
    if (window.__gv) window.__gv.camera = camera; // for the automated checks
  }, [camera]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const r = rig.current;
    const b = player.body;
    const modeIdx = useGame.getState().cameraMode;
    const mode = CAMERA_MODES[modeIdx];
    const first = mode === 'FIRST';

    if (!r.init || player.snapCam) {
      r.pivot.set(player.eyeX, player.eyeY, player.eyeZ);
      r.boom = CAMERA.boom;
      r.roll = 0;
      r.init = true;
      player.snapCam = false;
    }
    if (r.lastMode !== modeIdx) {
      r.lastMode = modeIdx;
      if (first) r.boom = 0;
    }

    const speed = Math.hypot(b.vx, b.vy, b.vz);
    const hSpeed = Math.hypot(b.vx, b.vz);
    const swinging = odm.swinging;

    // ---- one-shot kicks from the gear ----
    for (const e of odm.events) {
      if (e.type === 'dash') r.fovPunch = 14;
      else if (e.type === 'pop') r.fovPunch = Math.max(r.fovPunch, 6);
    }
    r.fovPunch *= Math.exp(-6 * dt);

    // ---- auto-follow: swinging fast with no mouse input swings the view round behind the motion ----
    const idle = performance.now() / 1000 - input.lastLookT > 0.8;
    if (swinging && hSpeed > 12 && idle && !first) {
      easing.dampAngle(input, 'yaw', Math.atan2(-b.vx, -b.vz), 1.1, dt);
    }

    // look direction from yaw/pitch (yaw 0 looks toward -z)
    const cp = Math.cos(input.pitch);
    _look.set(-Math.sin(input.yaw) * cp, Math.sin(input.pitch), -Math.cos(input.yaw) * cp);

    // ---- pivot: trails (more with speed) and leads along the velocity ----
    const t = clamp(speed / ODM.maxSpeed, 0, 1);
    if (first) {
      r.pivot.set(player.eyeX, player.eyeY, player.eyeZ); // exact: no lag in first person
    } else {
      _target.set(player.eyeX + b.vx * 0.1, player.eyeY + b.vy * 0.06, player.eyeZ + b.vz * 0.1);
      easing.damp3(r.pivot, _target, THREE.MathUtils.lerp(CAMERA.pivotSmooth, 0.22, t), dt);
    }
    const ex = player.eyeX;
    const ey = player.eyeY;
    const ez = player.eyeZ;

    // ---- boom ----
    const wantBoom = CAMERA.boom + (swinging ? Math.min(2, speed * 0.04) : 0);

    if (first) {
      camera.position.copy(r.pivot);
      camera.lookAt(r.pivot.x + _look.x, r.pivot.y + _look.y, r.pivot.z + _look.z);
      r.boom = 0;
      _origin.set(ex, ey, ez);
      _fwd.copy(_look);
    } else {
      _pivot.copy(r.pivot);
      // boom points away from where we look (behind) or toward it (front view)
      _dir.copy(_look).multiplyScalar(mode === 'THIRD_BACK' ? -1 : 1);

      // how far the boom can extend before a wall: the nearest of 5 guard rays
      _right.crossVectors(_dir, UP);
      if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
      _right.normalize();
      _up.crossVectors(_right, _dir).normalize();
      let safe = wantBoom;
      for (let i = 0; i < GUARD.length; i++) {
        const ox = _pivot.x + _right.x * GUARD[i][0] + _up.x * GUARD[i][1];
        const oy = _pivot.y + _right.y * GUARD[i][0] + _up.y * GUARD[i][1];
        const oz = _pivot.z + _right.z * GUARD[i][0] + _up.z * GUARD[i][1];
        if (raycastVoxel(world, ox, oy, oz, _dir.x, _dir.y, _dir.z, wantBoom + CAMERA.collideMargin, _hit)) {
          safe = Math.min(safe, _hit.t - CAMERA.collideMargin);
        }
      }
      safe = Math.max(0.35, safe);

      // asymmetric: squeeze in instantly (never end up inside a wall), ease back out
      if (safe < r.boom) r.boom = safe;
      else easing.damp(r, 'boom', safe, CAMERA.pullOutSmooth, dt);

      camera.position.set(_pivot.x + _dir.x * r.boom, _pivot.y + _dir.y * r.boom, _pivot.z + _dir.z * r.boom);
      camera.lookAt(_pivot);

      // crosshair ray: from the camera through the eye (back), or from the eye itself (front view)
      if (mode === 'THIRD_BACK') _origin.copy(camera.position);
      else _origin.set(ex, ey, ez);
      _fwd.copy(_look);
    }

    camState.ox = _origin.x;
    camState.oy = _origin.y;
    camState.oz = _origin.z;
    camState.dx = _fwd.x;
    camState.dy = _fwd.y;
    camState.dz = _fwd.z;

    // ---- bank into turns: roll from how fast the heading is changing ----
    const heading = Math.atan2(b.vx, b.vz);
    let yawRate = 0;
    if (hSpeed > 6) yawRate = wrap(heading - r.lastHeading) / dt;
    r.lastHeading = heading;
    const rollTarget = clamp(yawRate * hSpeed * 0.0025, -0.22, 0.22);
    easing.damp(r, 'roll', rollTarget, 0.2, dt);
    camera.rotateZ(r.roll);

    // ---- FOV opens with speed ----
    const fovTarget = CAMERA.fov + 24 * smoothstep(10, 50, speed) ** 1.4 + r.fovPunch;
    const prevFov = camera.fov;
    easing.damp(camera, 'fov', fovTarget, 0.25, dt);
    if (Math.abs(camera.fov - prevFov) > 0.01) camera.updateProjectionMatrix();

    // ---- shake, last ----
    tickShake(dt, _shake);
    camera.position.x += _shake.x;
    camera.position.y += _shake.y;
    camera.position.z += _shake.z;
    camera.rotateX(_shake.pitch);
    camera.rotateY(_shake.yaw);
    camera.rotateZ(_shake.roll);

    stats.fov = camera.fov;
    stats.trauma = traumaNow();
  });

  return null;
}
