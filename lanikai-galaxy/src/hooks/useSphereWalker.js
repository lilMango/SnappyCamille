import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { player } from '../store';
import { tangentFrame, surfaceQuaternion, latLonToDir, angularDistance } from '../utils/sphere';
import { terrainHeight, oceanPolar, SHORE } from '../utils/terrain';
import {
  PLANET_RADIUS,
  WALK_SPEED,
  SWIM_SPEED,
  TURN_SPEED,
  ORIENT_DECAY,
  JUMP_SPEED,
  GRAVITY,
} from '../constants/worldConfig';
import { RECT_COLLIDERS, CIRCLE_COLLIDERS } from '../constants/islandLayout';

// Precompute circle-collider directions once.
const _circles = CIRCLE_COLLIDERS.map((c) => ({
  dir: latLonToDir(c.lat, c.lon),
  radius: c.radius,
}));

function isBlocked(dir) {
  // Rect colliders are in villa-local surface meters (north = lat arc,
  // east = lon arc — small-angle is fine near the villa where all rects sit).
  const n = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) * PLANET_RADIUS;
  const e = Math.atan2(dir.z, dir.x) * PLANET_RADIUS;
  for (const r of RECT_COLLIDERS) {
    if (n > r.n0 && n < r.n1 && e > r.e0 && e < r.e1) return true;
  }
  for (const c of _circles) {
    if (angularDistance(dir, c.dir) < c.radius) return true;
  }
  return false;
}

// Scratch vectors reused every frame (no per-frame allocation).
const _east = new THREE.Vector3();
const _north = new THREE.Vector3();
const _move = new THREE.Vector3();
const _right = new THREE.Vector3();
const _slide = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _fwdAfter = new THREE.Vector3();
const _candidate = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();

/**
 * Drives the shared `player` state along the surface of the planet using
 * great-circle motion, and orients the given groupRef to stand on the surface.
 *
 * @param groupRef ref to the character's THREE.Group
 * @param inputRef ref to { forward, strafe, turn } in [-1,1]
 */
export function useSphereWalker(groupRef, inputRef) {
  const initialized = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30); // clamp big frame gaps (tab switches)
    const input = inputRef.current;
    const up = player.posDir; // unit vector, doubles as surface normal

    // 1. Turn: rotate heading in the tangent plane.
    player.heading += input.turn * TURN_SPEED * dt;

    // 1b. Turn-around (back button): flip 180° to face the camera. The camera
    // will slowly orbit back behind her (see FollowCamera), so her face shows
    // briefly before it wraps to the back of her head.
    if (input.turnAround) {
      player.heading += Math.PI;
      player.camFlipSeq++;
      input.turnAround = false;
    }

    // 2. Build tangent frame and forward direction.
    tangentFrame(up, _east, _north);
    player.forward.copy(_north).applyAxisAngle(up, player.heading).normalize();

    // 3. Assemble desired tangent move (forward + facing-relative strafe).
    // right = up x forward (geographic right of the walk direction).
    _right.crossVectors(up, player.forward).normalize();
    _move.set(0, 0, 0)
      .addScaledVector(player.forward, input.forward)
      .addScaledVector(_right, input.strafe);

    // Water depth: wading starts at the waterline and she is fully swimming
    // ~2m out (smoothstep), which also sets the swim speed and pose.
    const inWater = THREE.MathUtils.clamp((SHORE - oceanPolar(player.posDir).d) / 0.07, 0, 1);
    const swimTarget = inWater * inWater * (3 - 2 * inWater);
    player.swim += (swimTarget - player.swim) * Math.min(1, dt * 8);
    const speed = WALK_SPEED + (SWIM_SPEED - WALK_SPEED) * player.swim;

    const moving = _move.lengthSq() > 1e-6;
    player.speed += ((moving ? 1 : 0) - player.speed) * Math.min(1, dt * 10);

    if (moving) {
      _move.normalize();
      const angularStep = (speed * dt) / PLANET_RADIUS;
      // Try the direct step first; if blocked, deflect the move direction in
      // widening steps so she slides along walls instead of freezing. If the
      // CURRENT position is somehow inside a collider, always allow escape.
      const escaping = isBlocked(player.posDir);
      let stepped = false;
      for (const deflect of [0, 0.5, -0.5, 1.0, -1.0]) {
        _slide.copy(_move);
        if (deflect !== 0) _slide.applyAxisAngle(up, deflect);
        _axis.crossVectors(up, _slide).normalize();
        _q.setFromAxisAngle(_axis, angularStep * (deflect === 0 ? 1 : 0.7));
        _candidate.copy(player.posDir).applyQuaternion(_q).normalize();
        if (!isBlocked(_candidate) || escaping) {
          player.posDir.copy(_candidate);
          stepped = true;
          break;
        }
      }

      if (stepped) {
        // Parallel-transport forward, then recompute heading at the new point so
        // facing stays continuous (no spin as we cross the surface).
        // Note the sign: forward(h) = cos(h)*north - sin(h)*east (up x north = -east),
        // so h = atan2(-f.east, f.north). Using +f.east negates heading every
        // frame and reflects the walk direction across north.
        _fwdAfter.copy(player.forward).applyQuaternion(_q).normalize();
        tangentFrame(player.posDir, _east, _north);
        player.heading = Math.atan2(-_fwdAfter.dot(_east), _fwdAfter.dot(_north));
      }
    }

    // 3b. Jump: hop straight up along the surface normal, gravity pulls back.
    if (input.jump && player.grounded) {
      player.vertV = JUMP_SPEED;
      player.grounded = false;
    }
    input.jump = false; // consume the edge-triggered press
    if (!player.grounded) {
      player.height += player.vertV * dt;
      player.vertV -= GRAVITY * dt;
      if (player.height <= 0) {
        player.height = 0;
        player.vertV = 0;
        player.grounded = true;
      }
    }

    // 4. Keep the live `up` in sync and place + orient the mesh.
    // Feet follow the analytic terrain (same function that displaced the mesh)
    // plus the current jump height.
    player.up.copy(player.posDir);
    const groundR = PLANET_RADIUS + terrainHeight(player.posDir);
    player.groundPos.copy(player.posDir).multiplyScalar(groundR);
    player.worldPos.copy(player.posDir).multiplyScalar(groundR + player.height);

    const group = groupRef.current;
    if (group) {
      group.position.copy(player.worldPos);
      surfaceQuaternion(player.posDir, player.heading, _targetQuat);
      if (!initialized.current) {
        group.quaternion.copy(_targetQuat);
        initialized.current = true;
      } else {
        group.quaternion.slerp(_targetQuat, 1 - Math.exp(-ORIENT_DECAY * dt));
      }
    }
  });
}
