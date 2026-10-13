import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { easing } from 'maath';
import PlayerMesh from './PlayerMesh';
import { player, useGame, stats } from '../store';
import { world } from '../utils/voxelWorld';
import { moveBody } from '../utils/physics';
import { createHit, raycastVoxel } from '../utils/raycast';
import { input, moveIntent, isSprinting, isJumping } from '../utils/input';
import { PLAYER, CAMERA_MODES } from '../constants/playerConfig';
import { SPAWN } from '../utils/worldSelect';

const _intent = { x: 0, z: 0 };
const _hit = createHit();

/** Put the player back at the spawn point (also used when they fall out of the world). */
export function respawn() {
  const b = player.body;
  b.x = SPAWN.x;
  b.y = SPAWN.y;
  b.z = SPAWN.z;
  b.vx = b.vy = b.vz = 0;
  player.facing = SPAWN.yaw + Math.PI;
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

    if (!g.freeCam) {
      // ---- wanted velocity, relative to where the camera looks ----
      moveIntent(_intent);
      const sin = Math.sin(input.yaw);
      const cos = Math.cos(input.yaw);
      // forward = (-sin, -cos), right = (cos, -sin)
      const wx = _intent.x * cos - _intent.z * sin;
      const wz = -_intent.x * sin - _intent.z * cos;
      const hasInput = _intent.x !== 0 || _intent.z !== 0;

      const speed = isSprinting() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      const smooth = b.grounded ? PLAYER.groundAccel : PLAYER.airAccel;
      if (hasInput || b.grounded) {
        // (in the air with no input: keep momentum, like a platformer)
        const k = 1 - Math.exp(-dt / smooth);
        b.vx += (wx * speed - b.vx) * k;
        b.vz += (wz * speed - b.vz) * k;
      }

      if (isJumping() && b.grounded) b.vy = PLAYER.jumpSpeed;

      moveBody(world, b, dt);
      if (b.y < PLAYER.respawnY) respawn();

      // ---- facing: toward the movement in third person, with the camera in first ----
      const first = CAMERA_MODES[g.cameraMode] === 'FIRST';
      const hSpeed = Math.hypot(b.vx, b.vz);
      if (first) {
        player.facing = input.yaw + Math.PI;
      } else if (hSpeed > 0.5 && hasInput) {
        easing.dampAngle(player, 'facing', Math.atan2(b.vx, b.vz), 0.08, dt);
      }
      player.speed = hSpeed;
    }

    player.eyeX = b.x;
    player.eyeY = b.y + PLAYER.eyeHeight;
    player.eyeZ = b.z;

    // ---- mesh ----
    const m = group.current;
    m.position.set(b.x, b.y, b.z);
    m.rotation.y = player.facing;
    m.visible = g.freeCam || CAMERA_MODES[g.cameraMode] !== 'FIRST'; // hide the body in first person

    // ---- blob shadow on whatever is below the feet ----
    const s = shadow.current;
    if (raycastVoxel(world, b.x, b.y + 0.2, b.z, 0, -1, 0, 40, _hit)) {
      const air = Math.max(0, b.y - _hit.py);
      s.visible = m.visible;
      s.position.set(b.x, _hit.py + 0.02, b.z);
      s.scale.setScalar(Math.max(0.35, 1 - air * 0.06));
      shadowMat.opacity = Math.max(0.1, 0.32 - air * 0.02);
    } else {
      s.visible = false;
    }

    stats.grounded = b.grounded;
    stats.hSpeed = player.speed;
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
