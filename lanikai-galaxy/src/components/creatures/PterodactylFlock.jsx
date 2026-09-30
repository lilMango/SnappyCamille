import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Pterodactyl, { PTERO_PALETTES } from './Pterodactyl';
import { tangentFrame } from '../../utils/sphere';
import { polarToDir, PEAK_DIR } from '../../utils/terrain';
import { PLANET_RADIUS } from '../../constants/worldConfig';

/**
 * A few pterodactyls looping over the island. Each flies a closed path on a
 * shell ALT meters above the planet (well above the tallest pali crest, ~17m):
 * either a circle or a figure-8 (lemniscate of Gerono) laid out in the tangent
 * plane at `center` and wrapped onto the sphere with the exponential map. They
 * face along the path, bank into turns (roll ∝ turn rate), and alternate
 * flapping with glides. Purely decorative, no collision.
 *
 *   center: unit direction the loop is centered on
 *   a, b:   angular half-extents (radians) of the loop
 *   alt:    meters above PLANET_RADIUS
 *   speed:  approx. flight speed in m/s (negative = fly the loop backwards)
 */
const FLIGHTS = [
  // figure-8 over the Kualoa valley, between the two ridges
  { center: polarToDir(1.95, -5), shape: 'eight', a: 0.62, b: 0.5, alt: 21, speed: 7.5, rot: 0.3 },
  // wide circle out over the beach + lagoon — visible from the spawn
  { center: polarToDir(1.12, 25), shape: 'circle', a: 0.45, b: 0.45, alt: 20, speed: -6.5, rot: 0 },
  // circling the far-side peak
  { center: PEAK_DIR, shape: 'circle', a: 0.5, b: 0.42, alt: 23, speed: 8, rot: 1.1 },
];

const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _f0 = new THREE.Vector3();
const _f1 = new THREE.Vector3();
const _right = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _qBase = new THREE.Quaternion();
const _qBank = new THREE.Quaternion();
const _Z = new THREE.Vector3(0, 0, 1);

/** Unit direction on the loop at parameter t -> out. */
function loopDir(f, t, out) {
  let x;
  let y;
  if (f.shape === 'eight') {
    x = f.a * Math.sin(t);
    y = f.b * Math.sin(t) * Math.cos(t) * 1.6;
  } else {
    x = f.a * Math.cos(t);
    y = f.b * Math.sin(t);
  }
  // rotate the loop in its tangent plane, then exp-map onto the sphere
  const c = Math.cos(f.rot);
  const s = Math.sin(f.rot);
  const u = x * c - y * s;
  const v = x * s + y * c;
  const r = Math.hypot(u, v);
  if (r < 1e-9) return out.copy(f.center);
  const k = Math.sin(r) / r;
  return out
    .copy(f.center)
    .multiplyScalar(Math.cos(r))
    .addScaledVector(f.E, u * k)
    .addScaledVector(f.N, v * k)
    .normalize();
}

/** Approximate loop length in radians-of-arc, to convert m/s into dt/dt. */
function loopArc(f) {
  let len = 0;
  const N = 128;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  loopDir(f, 0, a);
  for (let i = 1; i <= N; i++) {
    loopDir(f, (i / N) * Math.PI * 2, b);
    len += a.angleTo(b);
    a.copy(b);
  }
  return len;
}

export default function PterodactylFlock() {
  const groups = useRef([]);

  const flyers = useMemo(
    () =>
      FLIGHTS.map((cfg, i) => {
        const f = { ...cfg, E: new THREE.Vector3(), N: new THREE.Vector3() };
        tangentFrame(f.center, f.E, f.N);
        const shellR = PLANET_RADIUS + f.alt;
        const arc = Math.max(1e-3, loopArc(f)); // radians of arc around the loop
        // parameter rate so the linear speed along the path ≈ |speed| m/s
        f.omega = ((f.speed / (arc * shellR)) * Math.PI * 2) || 0.2;
        f.shellR = shellR;
        f.t = i * 2.1;
        f.bank = 0;
        f.motion = { flap: 1 };
        f.palette = PTERO_PALETTES[i % PTERO_PALETTES.length];
        f.scale = 1.15 + i * 0.1;
        return f;
      }),
    []
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const time = clock.elapsedTime;
    flyers.forEach((f, i) => {
      f.t += f.omega * dt;
      const eps = 0.02 * Math.sign(f.omega || 1);
      loopDir(f, f.t, _p0);
      loopDir(f, f.t + eps, _p1);
      loopDir(f, f.t + 2 * eps, _p2);

      // forward = path tangent projected into the local tangent plane
      _f0.subVectors(_p1, _p0);
      _f0.addScaledVector(_p0, -_f0.dot(_p0));
      _f1.subVectors(_p2, _p1);
      if (_f0.lengthSq() < 1e-14 || _f1.lengthSq() < 1e-14) return;
      _f0.normalize();
      _f1.addScaledVector(_p0, -_f1.dot(_p0)).normalize();

      // signed turn rate (rad/s) about the local up; + = turning toward local +X
      _cross.crossVectors(_f0, _f1);
      const turn = Math.atan2(_cross.dot(_p0), _f0.dot(_f1)) / (Math.abs(eps / f.omega) || 1);
      // bank into the turn: dip the inside wing (rotating about +Z by -φ lowers +X)
      const bankTarget = THREE.MathUtils.clamp(-turn * 2.4, -0.8, 0.8);
      f.bank += (bankTarget - f.bank) * Math.min(1, dt * 2.5);

      // flap harder on the straights, glide through banked turns + a slow cycle
      const cycle = 0.5 + 0.5 * Math.sin(time * 0.45 + i * 1.9);
      f.motion.flap = THREE.MathUtils.clamp(0.25 + 0.75 * cycle - Math.abs(f.bank) * 0.4, 0.15, 1);

      const g = groups.current[i];
      if (!g) return;
      const bob = Math.sin(time * 0.7 + i) * 0.8;
      g.position.copy(_p0).multiplyScalar(f.shellR + bob);
      // basis: +Y = up, +Z = forward, +X = up x forward (same as orientOnSurface)
      _right.crossVectors(_p0, _f0).normalize();
      _m.makeBasis(_right, _p0, _f0);
      _qBase.setFromRotationMatrix(_m);
      _qBank.setFromAxisAngle(_Z, f.bank);
      g.quaternion.copy(_qBase).multiply(_qBank);
    });
  });

  return (
    <group>
      {flyers.map((f, i) => (
        <Pterodactyl
          key={i}
          ref={(el) => (groups.current[i] = el)}
          palette={f.palette}
          motion={f.motion}
          scale={f.scale}
        />
      ))}
    </group>
  );
}
