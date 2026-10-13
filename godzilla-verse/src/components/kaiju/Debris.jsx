import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BLOCK_COLOR } from '../../constants/blocks';
import { world } from '../../utils/voxelWorld';
import { KAIJU } from '../../constants/kaijuConfig';

// Tumbling cubes thrown off by destruction: one InstancedMesh, a ring buffer of particles, zero
// allocation per frame. Each cube takes the colour of the block it was. They fall under gravity,
// bounce off whatever the height map says is the ground, and shrink away after a few seconds.
// (Phase 10 replaces the dumb ballistic motion with real rigid bodies; the spawn call stays.)

const MAX = 2048;
const GRAVITY = 30;

const pos = new Float32Array(MAX * 3);
const vel = new Float32Array(MAX * 3);
const rot = new Float32Array(MAX * 3);
const spin = new Float32Array(MAX * 3);
const size = new Float32Array(MAX);
const life = new Float32Array(MAX);
const maxLife = new Float32Array(MAX);
const hex = new Uint32Array(MAX);
const fresh = new Uint8Array(MAX);
let head = 0;
let high = 0; // highest slot ever used + 1, so an idle pool costs nothing

export const debrisCount = () => {
  let n = 0;
  for (let i = 0; i < high; i++) if (life[i] > 0) n++;
  return n;
};

/**
 * Throw one cube from block (x,y,z) of block id `id`, pushed away from (fromX, fromZ).
 * `power` scales the outward speed.
 */
export function spawnDebris(x, y, z, id, fromX, fromZ, power = 1) {
  const k = head;
  head = (head + 1) % MAX;
  if (k + 1 > high) high = k + 1;
  const px = x + 0.5;
  const pz = z + 0.5;
  pos[k * 3] = px;
  pos[k * 3 + 1] = y + 0.5;
  pos[k * 3 + 2] = pz;
  let dx = px - fromX;
  let dz = pz - fromZ;
  const d = Math.hypot(dx, dz) || 1;
  dx /= d;
  dz /= d;
  const out = (2 + Math.random() * 7) * power;
  vel[k * 3] = dx * out + (Math.random() - 0.5) * 4;
  vel[k * 3 + 1] = 1 + Math.random() * 9 * power;
  vel[k * 3 + 2] = dz * out + (Math.random() - 0.5) * 4;
  rot[k * 3] = Math.random() * 6.28;
  rot[k * 3 + 1] = Math.random() * 6.28;
  rot[k * 3 + 2] = Math.random() * 6.28;
  spin[k * 3] = (Math.random() - 0.5) * 12;
  spin[k * 3 + 1] = (Math.random() - 0.5) * 12;
  spin[k * 3 + 2] = (Math.random() - 0.5) * 12;
  size[k] = 0.45 + Math.random() * 0.5;
  life[k] = maxLife[k] = 2.5 + Math.random() * 2.5;
  hex[k] = BLOCK_COLOR[id] || 0x888888;
  fresh[k] = 1;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export default function Debris() {
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, fog: true }), []);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, MAX);
    m.frustumCulled = false;
    m.count = 0;
    for (let i = 0; i < MAX; i++) m.setColorAt(i, _color.setHex(0xffffff));
    return m;
  }, [geo, mat]);

  useEffect(
    () => () => {
      mesh.dispose();
      geo.dispose();
      mat.dispose();
    },
    [mesh, geo, mat],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    mesh.count = high;
    mesh.visible = high > 0;
    let colorsDirty = false;
    for (let i = 0; i < high; i++) {
      if (life[i] > 0) {
        life[i] -= dt;
        vel[i * 3 + 1] -= GRAVITY * dt;
        let x = pos[i * 3] + vel[i * 3] * dt;
        let y = pos[i * 3 + 1] + vel[i * 3 + 1] * dt;
        let z = pos[i * 3 + 2] + vel[i * 3 + 2] * dt;
        // ground: the top of the column below, or the street if the column is empty
        const ground = Math.max(KAIJU.destruction.minY - 2, world.topY(Math.floor(x), Math.floor(z)) + 1) + size[i] * 0.5;
        if (y < ground) {
          y = ground;
          if (vel[i * 3 + 1] < 0) vel[i * 3 + 1] *= -0.3;
          vel[i * 3] *= 0.6;
          vel[i * 3 + 2] *= 0.6;
          spin[i * 3] *= 0.5;
          spin[i * 3 + 1] *= 0.5;
          spin[i * 3 + 2] *= 0.5;
        }
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        rot[i * 3] += spin[i * 3] * dt;
        rot[i * 3 + 1] += spin[i * 3 + 1] * dt;
        rot[i * 3 + 2] += spin[i * 3 + 2] * dt;
        _dummy.position.set(x, y, z);
        _dummy.rotation.set(rot[i * 3], rot[i * 3 + 1], rot[i * 3 + 2]);
        _dummy.scale.setScalar(size[i] * Math.min(1, life[i] / 0.6));
      } else {
        _dummy.scale.setScalar(0);
      }
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
      if (fresh[i]) {
        mesh.setColorAt(i, _color.setHex(hex[i]));
        fresh[i] = 0;
        colorsDirty = true;
      }
    }
    if (high) mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
