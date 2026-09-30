import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Raptor, { RAPTOR_PALETTES } from './Raptor';
import { tangentFrame, surfaceQuaternion, angularDistance } from '../../utils/sphere';
import { terrainHeight, oceanPolar, polarToDir, ridgeDistance, BEACH_END } from '../../utils/terrain';
import { PLANET_RADIUS } from '../../constants/worldConfig';

/**
 * A little pack of mini raptors roaming Kualoa Ranch (a Jurassic Park filming
 * location). Purely decorative: no collision with the player.
 *
 * Wander loop per raptor: pick a target point on walkable land (biased toward
 * the pack's centroid so they stay loosely together), walk/run there along the
 * great circle (the same rotate-posDir-about-an-axis step as useSphereWalker),
 * pause for a moment, repeat. Feet sit on the analytic terrainHeight(dir).
 *
 * Walkable = past the beach (d >= BEACH_END + margin, so never on sand or in
 * the lagoon) and clear of the cliff ridges (ridgeDistance >= RIDGE_CLEAR, the
 * same trick islandLayout.js uses to keep trees off the pali). Every leg's whole
 * great-circle path is sampled before it is accepted, so they never cut across
 * a ridge or dip into the water on the way.
 */

const R = PLANET_RADIUS;
const COUNT = 4;
const LAND_MIN_D = BEACH_END + 0.1; // radians from the ocean center (~3m past the sand)
const RIDGE_CLEAR = 6.5; // meters from a ridge centerline (the skirt ends at 8.5)
const HOME = { d: 1.38, theta: 14 }; // pasture behind the beach, in view once you turn around
const LEASH = 12; // meters: targets are picked within this of the pack centroid
const LEG_MIN = 3;
const LEG_MAX = 20;
const PATH_SAMPLE = 0.8; // meters between path validity samples
const WALK = 2.2;
const RUN = 6.5;
const ORIENT_DECAY = 8;

function isWalkable(dir) {
  return oceanPolar(dir).d >= LAND_MIN_D && ridgeDistance(dir) >= RIDGE_CLEAR;
}

// scratch
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c = new THREE.Vector3();
const _cand = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();

/** Point `meters` away from `base` along compass angle `ang` -> out. */
function offsetOnSphere(base, ang, meters, out) {
  tangentFrame(base, _e, _n);
  _t.copy(_n).multiplyScalar(Math.cos(ang)).addScaledVector(_e, Math.sin(ang));
  const a = meters / R;
  return out.copy(base).multiplyScalar(Math.cos(a)).addScaledVector(_t, Math.sin(a)).normalize();
}

/** Is the whole great-circle path from a to b walkable? */
function pathWalkable(a, b) {
  const ang = angularDistance(a, b);
  if (ang < 1e-6) return isWalkable(b);
  _axis.crossVectors(a, b);
  if (_axis.lengthSq() < 1e-12) return false; // antipodal / degenerate: reject
  _axis.normalize();
  const n = Math.max(1, Math.ceil((ang * R) / PATH_SAMPLE));
  for (let i = 1; i <= n; i++) {
    _q.setFromAxisAngle(_axis, (ang * i) / n);
    _p.copy(a).applyQuaternion(_q);
    if (!isWalkable(_p)) return false;
  }
  return true;
}

/** Bounded search for a new target; returns false (-> short pause) if none found. */
function pickTarget(s, pack) {
  _c.set(0, 0, 0);
  for (const o of pack) _c.add(o.pos);
  if (_c.lengthSq() < 1e-8) _c.copy(s.pos);
  _c.normalize();
  for (let attempt = 0; attempt < 28; attempt++) {
    const nearPack = attempt < 18;
    const base = nearPack ? _c : s.pos;
    const dist = nearPack ? Math.sqrt(Math.random()) * LEASH : 4 + Math.random() * 12;
    offsetOnSphere(base, Math.random() * Math.PI * 2, dist, _cand);
    const leg = angularDistance(s.pos, _cand) * R;
    if (leg < LEG_MIN || leg > LEG_MAX) continue;
    if (!pathWalkable(s.pos, _cand)) continue;
    s.target.copy(_cand);
    // mostly trotting around, sometimes a zoomies sprint
    s.cruise = Math.random() < 0.3 ? RUN * (0.85 + Math.random() * 0.3) : WALK * (0.8 + Math.random() * 0.5);
    s.pause = 0;
    return true;
  }
  return false;
}

/** Deterministic, validated spawn spots around HOME. */
function spawnPoints() {
  const home = polarToDir(HOME.d, HOME.theta);
  const out = [];
  let k = 0;
  while (out.length < COUNT && k < 400) {
    k++;
    const h1 = (Math.sin(k * 12.9898 + 4.1) * 43758.5453) % 1;
    const h2 = (Math.sin(k * 78.233 + 1.7) * 12345.678) % 1;
    const p = offsetOnSphere(home, Math.abs(h1) * Math.PI * 2, 1.5 + Math.abs(h2) * 6, new THREE.Vector3());
    if (!isWalkable(p)) continue;
    if (out.some((o) => angularDistance(o, p) * R < 1.6)) continue;
    out.push(p);
  }
  // Fallback (only if HOME were edited onto bad ground): scan the globe for land.
  for (let d = 1.4; out.length < COUNT && d < Math.PI - 0.05; d += 0.05) {
    for (let th = -180; out.length < COUNT && th < 180; th += 15) {
      const p = polarToDir(d, th);
      if (isWalkable(p)) out.push(p);
    }
  }
  return out;
}

export default function RaptorPack() {
  const groups = useRef([]);

  const pack = useMemo(
    () =>
      spawnPoints().map((pos, i) => ({
        pos,
        target: pos.clone(),
        heading: Math.random() * Math.PI * 2,
        cruise: WALK,
        pause: 0.5 + i * 0.7, // stagger their first moves
        motion: { speed: 0, idle: 1 },
        scale: 0.9 + ((i * 0.37) % 1) * 0.25,
        palette: RAPTOR_PALETTES[i % RAPTOR_PALETTES.length],
        init: false,
      })),
    []
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    pack.forEach((s, i) => {
      let desired = 0;
      if (s.pause > 0) {
        s.pause -= dt;
        if (s.pause <= 0 && !pickTarget(s, pack)) s.pause = 0.6 + Math.random();
      } else {
        const ang = angularDistance(s.pos, s.target);
        const remaining = ang * R;
        if (remaining < 0.25) {
          s.pause = 1.2 + Math.random() * 3.5; // arrived: sniff around a bit
        } else {
          // ease in on arrival
          desired = Math.min(s.cruise, 0.6 + remaining * 1.6);
          const speed = Math.max(s.motion.speed, 0.4);
          _axis.crossVectors(s.pos, s.target);
          if (_axis.lengthSq() < 1e-12) {
            s.pause = 0.5;
          } else {
            _axis.normalize();
            const step = Math.min(ang, (speed * dt) / R);
            _q.setFromAxisAngle(_axis, step);
            _cand.copy(s.pos).applyQuaternion(_q).normalize();
            if (isWalkable(_cand)) {
              s.pos.copy(_cand);
              // velocity direction = axis x pos -> heading (same convention as the walker)
              _fwd.crossVectors(_axis, s.pos).normalize();
              tangentFrame(s.pos, _e, _n);
              s.heading = Math.atan2(-_fwd.dot(_e), _fwd.dot(_n));
            } else {
              // shouldn't happen (paths are pre-validated) — stop and re-plan
              s.pause = 0.4;
            }
          }
        }
      }
      s.motion.speed += (desired - s.motion.speed) * Math.min(1, dt * 4);
      s.motion.idle += ((s.pause > 0 ? 1 : 0) - s.motion.idle) * Math.min(1, dt * 3);

      const g = groups.current[i];
      if (!g) return;
      g.position.copy(s.pos).multiplyScalar(R + terrainHeight(s.pos));
      surfaceQuaternion(s.pos, s.heading, _targetQuat);
      if (!s.init) {
        g.quaternion.copy(_targetQuat);
        s.init = true;
      } else {
        g.quaternion.slerp(_targetQuat, 1 - Math.exp(-ORIENT_DECAY * dt));
      }
    });
  });

  return (
    <group>
      {pack.map((s, i) => (
        <Raptor
          key={i}
          ref={(el) => (groups.current[i] = el)}
          palette={s.palette}
          motion={s.motion}
          scale={s.scale}
        />
      ))}
    </group>
  );
}
