import { useMemo } from 'react';
import * as THREE from 'three';
import { toonGradient } from '../../utils/toon';
import { PLANET_RADIUS } from '../../constants/worldConfig';

/**
 * Offshore landmark islets — backdrop silhouettes that sit in the (blocked)
 * ocean. Lathed profiles, vertex-colored by height: rock at the waterline,
 * jungle green above, with a thin sand fringe + white surf ring at the base.
 */

const ROCK = new THREE.Color('#7a6552');
const GREEN = new THREE.Color('#2f9a3e');
const GREEN_HI = new THREE.Color('#57c24a');
const SAND = new THREE.Color('#f3dea0');

// Bend authored-flat geometry down to follow the planet's curvature, so a wide
// base (~6m) meets the curved sea surface instead of floating off it.
function curveDrop(x, z) {
  return (x * x + z * z) / (2 * PLANET_RADIUS);
}

function ringGeometry(inner, outer) {
  const g = new THREE.RingGeometry(inner, outer, 48);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, 0.06 - curveDrop(x, z));
  }
  return g;
}

function lathed(profile, greenFrom, segments = 28) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, segments);
  const top = profile[profile.length - 1][1];
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const x = p.getX(i);
    const z = p.getZ(i);
    // rock near the water, jungle above; a little angular streaking on the rock
    const streak = 0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 9);
    const g01 = THREE.MathUtils.smoothstep(y, greenFrom - 0.6 + streak * 0.8, greenFrom + 0.6 + streak * 0.8);
    c.copy(ROCK).lerp(GREEN, g01).lerp(GREEN_HI, THREE.MathUtils.smoothstep(y, top * 0.6, top) * 0.6);
    if (y < 0.35) c.lerp(SAND, 0.85);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    p.setY(i, y - curveDrop(x, z));
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

// Profiles: [radius, height] from the base (slightly below the water) to the top.
const PROFILES = {
  // Mokoli'i — the steep "Chinaman's Hat" cone with a rounded crown.
  mokolii: {
    pts: [[5.2, -0.6], [4.9, 0.25], [4.2, 0.6], [3.2, 1.2], [2.5, 2.4], [2.0, 4.0], [1.5, 5.4], [0.95, 6.4], [0.45, 6.9], [0, 7.05]],
    greenFrom: 1.6,
    ring: 5.0,
  },
  // Na Mokulua — Moku Nui (bigger, lumpy dome) and Moku Iki (small hump).
  mokunui: {
    pts: [[6.4, -0.6], [6.0, 0.25], [5.2, 0.9], [4.4, 2.3], [3.5, 3.6], [2.4, 4.4], [1.2, 4.8], [0, 4.95]],
    greenFrom: 1.4,
    ring: 6.2,
  },
  mokuiki: {
    pts: [[3.8, -0.6], [3.5, 0.25], [3.0, 0.9], [2.3, 2.0], [1.4, 2.7], [0, 2.95]],
    greenFrom: 1.1,
    ring: 3.7,
  },
};

const toonVC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
const foamMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });

export default function Islet({ kind = 'mokolii' }) {
  const def = PROFILES[kind];
  const geo = useMemo(() => lathed(def.pts, def.greenFrom), [def]);
  const ring = useMemo(() => ringGeometry(def.ring * 0.98, def.ring + 0.9), [def]);
  return (
    <group>
      <mesh geometry={geo} material={toonVC} castShadow receiveShadow />
      {/* surf ring hugging the waterline */}
      <mesh geometry={ring} material={foamMat} />
    </group>
  );
}
