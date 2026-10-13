import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// A small pooled burst of tinted cubes for the "block broke" feedback. One InstancedMesh, a
// ring buffer of particles, zero allocation per frame. (Phase 6 replaces this with the real
// debris system; this is the cheap version that makes editing feel good.)

const MAX = 192;
const GRAVITY = 20;

const pos = new Float32Array(MAX * 3);
const vel = new Float32Array(MAX * 3);
const life = new Float32Array(MAX);
const maxLife = new Float32Array(MAX);
const hex = new Uint32Array(MAX);
const fresh = new Uint8Array(MAX); // colour needs uploading
let head = 0;

/** Burst `count` cubes coloured `color` (0xRRGGBB) out of the block whose centre is (x, y, z). */
export function emitSparks(x, y, z, color, count = 14) {
  for (let n = 0; n < count; n++) {
    const k = head;
    head = (head + 1) % MAX;
    pos[k * 3] = x + (Math.random() - 0.5) * 0.8;
    pos[k * 3 + 1] = y + (Math.random() - 0.5) * 0.8;
    pos[k * 3 + 2] = z + (Math.random() - 0.5) * 0.8;
    vel[k * 3] = (Math.random() - 0.5) * 6;
    vel[k * 3 + 1] = 1.5 + Math.random() * 4.5;
    vel[k * 3 + 2] = (Math.random() - 0.5) * 6;
    life[k] = maxLife[k] = 0.45 + Math.random() * 0.4;
    hex[k] = color;
    fresh[k] = 1;
  }
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export default function Sparks() {
  const mesh = useRef();
  const geo = useMemo(() => new THREE.BoxGeometry(0.16, 0.16, 0.16), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);

  useEffect(() => {
    // make sure the instance-colour attribute exists
    for (let i = 0; i < MAX; i++) mesh.current.setColorAt(i, _color.setHex(0xffffff));
    mesh.current.instanceColor.needsUpdate = true;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const m = mesh.current;
    let colorsDirty = false;
    for (let i = 0; i < MAX; i++) {
      if (life[i] > 0) {
        life[i] -= dt;
        vel[i * 3 + 1] -= GRAVITY * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        _dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        _dummy.scale.setScalar(Math.max(0, life[i] / maxLife[i]));
      } else {
        _dummy.scale.setScalar(0);
      }
      _dummy.updateMatrix();
      m.setMatrixAt(i, _dummy.matrix);
      if (fresh[i]) {
        m.setColorAt(i, _color.setHex(hex[i]));
        fresh[i] = 0;
        colorsDirty = true;
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (colorsDirty) m.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, MAX]} frustumCulled={false} />;
}
