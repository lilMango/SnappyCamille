import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Dust and smoke puffs: one InstancedMesh of camera-facing soft discs. Each puff rises, grows,
// slows down and fades (by shrinking: instance colours carry no alpha). Emitted by footfalls,
// collapsing buildings, the beam's impact and lightning strikes.

const MAX = 512;
const pos = new Float32Array(MAX * 3);
const vel = new Float32Array(MAX * 3);
const life = new Float32Array(MAX);
const maxLife = new Float32Array(MAX);
const base = new Float32Array(MAX);
let head = 0;
let high = 0;

/** Emit `count` puffs around (x,y,z), spread `spread` blocks, each ~`size` blocks wide. */
export function emitDust(x, y, z, count = 6, spread = 3, size = 5, rise = 3) {
  for (let n = 0; n < count; n++) {
    const k = head;
    head = (head + 1) % MAX;
    if (k + 1 > high) high = k + 1;
    pos[k * 3] = x + (Math.random() - 0.5) * spread;
    pos[k * 3 + 1] = y + Math.random() * spread * 0.4;
    pos[k * 3 + 2] = z + (Math.random() - 0.5) * spread;
    vel[k * 3] = (Math.random() - 0.5) * 4;
    vel[k * 3 + 1] = rise * (0.5 + Math.random());
    vel[k * 3 + 2] = (Math.random() - 0.5) * 4;
    life[k] = maxLife[k] = 1.2 + Math.random() * 1.6;
    base[k] = size * (0.6 + Math.random() * 0.8);
  }
}

function softDisc() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _dummy = new THREE.Object3D();

export default function Dust() {
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const tex = useMemo(softDisc, []);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: tex, color: '#8a8378', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, fog: true }),
    [tex],
  );
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, MAX);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  }, [geo, mat]);

  useEffect(
    () => () => {
      mesh.dispose();
      geo.dispose();
      tex.dispose();
      mat.dispose();
    },
    [mesh, geo, tex, mat],
  );

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    mesh.count = high;
    mesh.visible = high > 0;
    for (let i = 0; i < high; i++) {
      if (life[i] > 0) {
        life[i] -= dt;
        const drag = Math.exp(-dt * 1.2);
        vel[i * 3] *= drag;
        vel[i * 3 + 1] *= drag;
        vel[i * 3 + 2] *= drag;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const u = 1 - life[i] / maxLife[i]; // 0 -> 1
        // grow fast, then thin out
        const s = base[i] * (0.4 + u * 1.2) * Math.min(1, life[i] / 0.5);
        _dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        _dummy.quaternion.copy(camera.quaternion);
        _dummy.scale.setScalar(s);
      } else {
        _dummy.scale.setScalar(0);
      }
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    if (high) mesh.instanceMatrix.needsUpdate = true;
  });

  return <primitive object={mesh} />;
}
