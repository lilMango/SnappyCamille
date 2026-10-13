import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { player, camState, target, useGame, stats } from '../store';
import { world } from '../utils/voxelWorld';
import { createHit, raycastVoxel } from '../utils/raycast';
import { bodyOverlapsCell } from '../utils/physics';
import { input } from '../utils/input';
import { emitSparks } from './Sparks';
import { PLAYER, EDIT, HOTBAR } from '../constants/playerConfig';
import { WORLD_H } from '../constants/worldConfig';
import { BLOCK_COLOR, BLOCK_DEFS, UNBREAKABLE, SOLID } from '../constants/blocks';

const _hit = createHit();
const MAX_RAY = 16; // from the camera: the boom plus the reach, with room to spare

/**
 * Block targeting + editing. Each frame: cast the crosshair ray, accept the block if it is
 * within reach of the player's eye, outline it, and — while a button is held — break it
 * (LMB) or place the selected hotbar block against the face that was hit (RMB).
 *
 * Edits go straight into the voxel world; world.setBlock marks the touched sections dirty
 * (and their neighbours, on a border) and the mesh manager remeshes them in the background.
 */
export default function BlockInteraction() {
  const outline = useRef();
  const cd = useRef({ brk: 0, place: 0 });

  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)), []);
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: 0x0a0a0a, toneMapped: false, fog: false }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const c = cd.current;
    c.brk -= dt;
    c.place -= dt;

    const o = outline.current;
    target.valid = false;
    if (useGame.getState().freeCam) {
      o.visible = false;
      stats.target = '';
      return;
    }

    if (raycastVoxel(world, camState.ox, camState.oy, camState.oz, camState.dx, camState.dy, camState.dz, MAX_RAY, _hit)) {
      // within reach of the *eye* (not the camera, which can sit metres behind the player)
      const d = Math.hypot(_hit.px - player.eyeX, _hit.py - player.eyeY, _hit.pz - player.eyeZ);
      if (d <= PLAYER.reach) {
        target.valid = true;
        target.x = _hit.x;
        target.y = _hit.y;
        target.z = _hit.z;
        target.nx = _hit.nx;
        target.ny = _hit.ny;
        target.nz = _hit.nz;
        target.id = world.getBlock(_hit.x, _hit.y, _hit.z);
      }
    }

    if (target.valid) {
      o.visible = true;
      o.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
      stats.target = `${BLOCK_DEFS[target.id]?.name ?? target.id} @ ${target.x},${target.y},${target.z}`;
    } else {
      o.visible = false;
      stats.target = '';
    }
    if (!target.valid) return;

    // ---- break ----
    if (input.breakHeld && c.brk <= 0 && !UNBREAKABLE[target.id]) {
      world.setBlock(target.x, target.y, target.z, 0);
      emitSparks(target.x + 0.5, target.y + 0.5, target.z + 0.5, BLOCK_COLOR[target.id]);
      c.brk = EDIT.breakCooldown;
    }

    // ---- place (against the face that was hit) ----
    if (input.placeHeld && c.place <= 0) {
      const px = target.x + target.nx;
      const py = target.y + target.ny;
      const pz = target.z + target.nz;
      const hasFace = target.nx !== 0 || target.ny !== 0 || target.nz !== 0;
      if (
        hasFace &&
        py >= 1 &&
        py < WORLD_H &&
        !SOLID[world.getBlock(px, py, pz)] &&
        !bodyOverlapsCell(player.body, px, py, pz) // never entomb yourself
      ) {
        world.setBlock(px, py, pz, HOTBAR[useGame.getState().hotbarIndex]);
        c.place = EDIT.placeCooldown;
      }
    }
  });

  return <lineSegments ref={outline} geometry={geo} material={mat} visible={false} renderOrder={2} />;
}
