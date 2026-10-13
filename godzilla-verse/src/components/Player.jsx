import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import PlayerMesh from './PlayerMesh';
import { emitSparks } from './Sparks';
import { player, odm, city, camState, useGame, stats } from '../store';
import { world } from '../utils/voxelWorld';
import { moveBody } from '../utils/physics';
import { createHit, raycastVoxel } from '../utils/raycast';
import { odmUpdate, odmReset } from '../utils/odm';
import { addTrauma, resetShake } from '../utils/shake';
import { input, moveIntent, isSprinting, isJumping, hookHeld, isReeling } from '../utils/input';
import { PLAYER, CAMERA_MODES } from '../constants/playerConfig';
import { ODM } from '../constants/odmConfig';
import { SPAWN } from '../utils/worldSelect';

const _intent = { x: 0, z: 0 };
const _hit = createHit();
// ODM input, reused every frame
const _io = {
  hook: [false, false],
  ray: { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: -1 },
  anchors: null,
  reel: false,
  boost: false,
  dash: false,
  fwd: 0,
  look: { x: 0, y: 0, z: -1 },
  move: { x: 0, z: 0 },
};

/** Put the player back at the spawn point (death, or falling out of the world). */
export function respawn() {
  const b = player.body;
  b.x = SPAWN.x;
  b.y = SPAWN.y;
  b.z = SPAWN.z;
  b.vx = b.vy = b.vz = 0;
  player.facing = SPAWN.yaw + Math.PI;
  player.health = ODM.maxHealth;
  player.invulnerable = 2;
  player.snapCam = true; // the camera should jump with us, not glide across the city
  odmReset(odm);
  resetShake();
}

function hurt(amount) {
  if (player.invulnerable > 0) return;
  player.health -= amount;
  if (player.health <= 0) respawn();
}

// The character + its controller. One component so the controller can write straight to the
// mesh transform (no React in the loop).
export default function Player() {
  const group = useRef();
  const shadow = useRef();

  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false, fog: true }),
    [],
  );
  const shadowGeo = useMemo(() => new THREE.CircleGeometry(0.42, 16).rotateX(-Math.PI / 2), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30); // a hitch must not become a teleport
    const g = useGame.getState();
    const b = player.body;

    if (!g.freeCam && city.generated) {
      // ---- wanted velocity, relative to where the camera looks ----
      moveIntent(_intent);
      const sin = Math.sin(input.yaw);
      const cos = Math.cos(input.yaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      const wx = _intent.x * cos - _intent.z * sin;
      const wz = -_intent.x * sin - _intent.z * cos;
      const hasInput = _intent.x !== 0 || _intent.z !== 0;

      const speed = isSprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const wasGrounded = b.grounded;
      const preVy = b.vy;

      if (b.grounded) {
        // snappy on the ground: ease toward the wanted velocity
        const k = 1 - Math.exp(-dt / PLAYER.groundAccel);
        b.vx += (wx * speed - b.vx) * k;
        b.vz += (wz * speed - b.vz) * k;
      } else if (hasInput) {
        // in the air you steer by acceleration, capped at walking speed along the wish direction:
        // you can nudge a swing or a jump but never brake or reverse it for free
        const ctrl = odm.swinging ? PLAYER.swingControl : 1;
        const along = b.vx * wx + b.vz * wz;
        const add = Math.min(PLAYER.airControl * ctrl * dt, Math.max(0, speed - along));
        b.vx += wx * add;
        b.vz += wz * add;
      }

      if (isJumping() && b.grounded) b.vy = PLAYER.jumpSpeed;

      // ---- ODM gear ----
      _io.hook[0] = hookHeld(0);
      _io.hook[1] = hookHeld(1);
      _io.ray.ox = camState.ox;
      _io.ray.oy = camState.oy;
      _io.ray.oz = camState.oz;
      _io.ray.dx = camState.dx;
      _io.ray.dy = camState.dy;
      _io.ray.dz = camState.dz;
      _io.anchors = city.anchors;
      _io.reel = isReeling();
      _io.boost = isJumping() && !b.grounded; // Space boosts while roped and airborne
      _io.dash = input.dashPressed;
      input.dashPressed = false;
      _io.fwd = Math.max(0, _intent.z);
      _io.look.x = camState.dx;
      _io.look.y = camState.dy;
      _io.look.z = camState.dz;
      _io.move.x = hasInput ? wx : 0;
      _io.move.z = hasInput ? wz : 0;
      odmUpdate(world, odm, b, _io, dt);

      const preH = Math.hypot(b.vx, b.vz);
      moveBody(world, b, dt);

      // ---- effects for what the gear just did ----
      for (const e of odm.events) {
        if (e.type === 'attach') {
          emitSparks(e.x, e.y, e.z, 0xffe6a8, 8);
          addTrauma(0.1);
        } else if (e.type === 'dash') addTrauma(0.14);
        else if (e.type === 'pop') addTrauma(0.1);
      }

      // ---- damage: hard landings and wall hits ----
      player.invulnerable = Math.max(0, player.invulnerable - dt);
      if (b.grounded && !wasGrounded && preVy < -12) {
        addTrauma(Math.min(0.6, -preVy / 60));
        if (preVy < -ODM.fallSafeSpeed) hurt((-preVy - ODM.fallSafeSpeed) * ODM.fallDamage);
      }
      if (b.hitWall && preH > ODM.wallSafeSpeed && Math.hypot(b.vx, b.vz) < preH * 0.6) {
        addTrauma(Math.min(0.7, preH / 60));
        hurt((preH - ODM.wallSafeSpeed) * ODM.wallDamage);
      }
      if (b.y < PLAYER.respawnY) respawn();

      // ---- facing: toward the movement (faster while swinging), with the camera in first person ----
      const first = CAMERA_MODES[g.cameraMode] === 'FIRST';
      const hSpeed = Math.hypot(b.vx, b.vz);
      if (first) {
        player.facing = input.yaw + Math.PI;
      } else if (odm.swinging && hSpeed > 3) {
        easing.dampAngle(player, 'facing', Math.atan2(b.vx, b.vz), 0.05, dt);
      } else if (hSpeed > 0.5 && hasInput) {
        easing.dampAngle(player, 'facing', Math.atan2(b.vx, b.vz), 0.08, dt);
      }
      player.speed = hSpeed;

      // lean into the swing: body pitches forward with speed, back when rising
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      const leanTarget = odm.swinging && !b.grounded ? 0.6 * Math.min(1, sp / 25) - Math.atan2(b.vy, Math.max(1, hSpeed)) * 0.4 : 0;
      easing.damp(player, 'lean', leanTarget, 0.12, dt);

      player.score = Math.floor(odm.swingDistance / 4) + player.bonus;
    }

    player.eyeX = b.x;
    player.eyeY = b.y + PLAYER.eyeHeight;
    player.eyeZ = b.z;

    // ---- mesh ----
    const m = group.current;
    m.rotation.order = 'YXZ';
    m.position.set(b.x, b.y, b.z);
    m.rotation.y = player.facing;
    m.rotation.x = player.lean;
    m.visible = g.freeCam || CAMERA_MODES[g.cameraMode] !== 'FIRST'; // hide the body in first person

    // ---- blob shadow on whatever is below the feet ----
    const s = shadow.current;
    if (raycastVoxel(world, b.x, b.y + 0.2, b.z, 0, -1, 0, 60, _hit)) {
      const air = Math.max(0, b.y - _hit.py);
      s.visible = m.visible;
      s.position.set(b.x, _hit.py + 0.02, b.z);
      s.scale.setScalar(Math.max(0.35, 1 - air * 0.05));
      shadowMat.opacity = Math.max(0.1, 0.32 - air * 0.015);
    } else {
      s.visible = false;
    }

    stats.grounded = b.grounded;
    stats.hSpeed = player.speed;
    stats.gas = odm.gas;
    stats.health = player.health;
    stats.score = player.score;
  });

  return (
    <>
      <group ref={group}>
        <PlayerMesh />
      </group>
      <mesh ref={shadow} geometry={shadowGeo} material={shadowMat} renderOrder={1} />
    </>
  );
}
