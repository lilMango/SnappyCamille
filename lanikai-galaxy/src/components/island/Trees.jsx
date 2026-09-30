import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonGradient } from '../../utils/toon';

/**
 * Stylized, cel-shaded island trees. Each tree's parts are MERGED into a few
 * shared module-level geometries (trunk / foliage / coconuts) so a tree costs
 * 2-3 draw calls no matter how many fronds it has — there are ~150 of them.
 * Authored flat: +Y up, sitting at y=0; palms lean toward local +Z.
 */

const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

// ---- Coconut palm ---------------------------------------------------------
const PALM_H = 4.6;
const PALM_LEAN = 1.1;
const palmCurve = (t) => new THREE.Vector3(0, PALM_H * t, PALM_LEAN * t * t);
const PALM_TOP = palmCurve(1);

/** Ringed, tapering, curved trunk made of short stacked frusta. */
const palmTrunkGeo = (() => {
  const parts = [];
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = palmCurve(i / N);
    const b = palmCurve((i + 1) / N);
    const len = a.distanceTo(b);
    const r0 = THREE.MathUtils.lerp(0.21, 0.12, i / N);
    const r1 = THREE.MathUtils.lerp(0.21, 0.12, (i + 1) / N);
    // radiusTop < radiusBottom*0.9 gives each segment a little flare = trunk rings
    const g = new THREE.CylinderGeometry(r1 * 0.88, r0, len * 1.04, 7, 1);
    _v.subVectors(b, a).normalize();
    _q.setFromUnitVectors(_up, _v);
    g.applyQuaternion(_q);
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(g);
  }
  return mergeGeometries(parts);
})();

/** One arching frond: a tapered, V-folded strip that droops toward its tip. */
function frondGeometry(length, width, droop) {
  const g = new THREE.PlaneGeometry(width, length, 2, 8);
  g.rotateX(-Math.PI / 2); // lie flat, length along -Z
  g.translate(0, 0, -length / 2); // base at origin, tip at z=-length
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const s = -z / length; // 0 at base, 1 at tip
    const taper = Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.08)) * (1 - s * 0.3);
    const nx = x * taper;
    const y = 0.35 * s - droop * s * s + Math.abs(nx) * 0.35; // arch up, then droop; V-fold
    p.setXYZ(i, nx, y, z);
  }
  g.computeVertexNormals();
  return g;
}

const palmCrownGeo = (() => {
  const parts = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const len = 2.4 + (i % 3) * 0.35;
    const g = frondGeometry(len, 0.75, 1.5 + (i % 2) * 0.4);
    g.rotateY((i / N) * Math.PI * 2 + (i % 2) * 0.2);
    g.translate(PALM_TOP.x, PALM_TOP.y, PALM_TOP.z);
    parts.push(g);
  }
  // a few short upright fronds in the middle
  for (let i = 0; i < 4; i++) {
    const g = frondGeometry(1.3, 0.5, 0.2);
    g.rotateX(0.6);
    g.rotateY((i / 4) * Math.PI * 2 + 0.4);
    g.translate(PALM_TOP.x, PALM_TOP.y, PALM_TOP.z);
    parts.push(g);
  }
  return mergeGeometries(parts);
})();

const palmNutsGeo = (() => {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.SphereGeometry(0.15, 8, 6);
    const a = (i / 4) * Math.PI * 2;
    g.translate(PALM_TOP.x + Math.cos(a) * 0.18, PALM_TOP.y - 0.2, PALM_TOP.z + Math.sin(a) * 0.18);
    parts.push(g);
  }
  return mergeGeometries(parts);
})();

// ---- Ironwood (casuarina) -------------------------------------------------
const ironTrunkGeo = (() => {
  const g = new THREE.CylinderGeometry(0.1, 0.2, 3.4, 7, 1);
  g.translate(0, 1.7, 0);
  return g;
})();

/**
 * Casuarina silhouette: tall, slightly ragged stack of drooping conical tiers,
 * each tier nudged off-axis so the tree reads wind-blown rather than a tidy fir.
 */
const ironFoliageGeo = (() => {
  const parts = [];
  const tiers = [
    // [x, y, z, radius, height]
    [0, 2.0, 0, 1.25, 1.6],
    [0.2, 2.9, -0.1, 1.05, 1.5],
    [-0.15, 3.75, 0.12, 0.85, 1.4],
    [0.12, 4.55, 0, 0.62, 1.3],
    [0, 5.3, 0.05, 0.38, 1.1],
  ];
  for (const [x, y, z, r, h] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 9, 1, true);
    g.translate(x, y, z);
    parts.push(g);
  }
  return mergeGeometries(parts);
})();

// ---- Shared toon materials ------------------------------------------------
const toon = (color, extra = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });

const MAT = {
  palmTrunk: toon('#a88458'),
  palmFrond: toon('#3fb83a', { side: THREE.DoubleSide }),
  palmFrondAlt: toon('#5ccc44', { side: THREE.DoubleSide }),
  nut: toon('#7a5a2e'),
  ironTrunk: toon('#6e5a48'),
  ironFoliage: toon('#2f7a45', { side: THREE.DoubleSide }),
  ironFoliageAlt: toon('#3d8c4f', { side: THREE.DoubleSide }),
};

export function Palm({ scale = 1, alt = false }) {
  return (
    <group scale={scale}>
      <mesh geometry={palmTrunkGeo} material={MAT.palmTrunk} castShadow />
      <mesh geometry={palmCrownGeo} material={alt ? MAT.palmFrondAlt : MAT.palmFrond} castShadow />
      <mesh geometry={palmNutsGeo} material={MAT.nut} />
    </group>
  );
}

export function Ironwood({ scale = 1, alt = false }) {
  return (
    <group scale={scale}>
      <mesh geometry={ironTrunkGeo} material={MAT.ironTrunk} castShadow />
      <mesh geometry={ironFoliageGeo} material={alt ? MAT.ironFoliageAlt : MAT.ironFoliage} castShadow />
    </group>
  );
}
