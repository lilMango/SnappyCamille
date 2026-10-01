import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import TRex from './TRex';
import Brachiosaurus from './Brachiosaurus';
import { tangentFrame, surfaceQuaternion, angularDistance } from '../../utils/sphere';
import { terrainHeight, oceanPolar, polarToDir, ridgeDistance, BEACH_END } from '../../utils/terrain';
import { PLANET_RADIUS } from '../../constants/worldConfig';

/**
 * One T-rex and one long-neck roaming Kualoa Ranch: the pasture behind the
 * beach and (through the open ends of the pali) the valley. Same wander loop as
 * RaptorPack — pick a validated target, walk the great circle, pause, repeat —
 * but for a single big, slow animal with a wider berth around cliffs/sand.
 * Purely decorative: no collision with the player or each other.
 */
const R = PLANET_RADIUS;
const LAND_MIN_D = BEACH_END + 0.08;
const RIDGE_CLEAR = 5.2; // wall ends at 4.2m; the skirt is gentle beyond that
const PATH_SAMPLE = 0.8;
const ORIENT_DECAY = 5;

const DINOS = [
  { Model: TRex, home: { d: 1.42, theta: -38 }, walk: 2.3, run: 4.6, legMin: 6, legMax: 28, pauseMax: 6, scale: 1 },
  { Model: Brachiosaurus, home: { d: 1.98, theta: 70 }, walk: 1.1, run: 1.1, legMin: 5, legMax: 22, pauseMax: 9, scale: 1 },
  // far side of the planet (around the antipodal peak)
  { Model: TRex, home: { d: 2.85, theta: 100 }, walk: 2.3, run: 4.6, legMin: 6, legMax: 28, pauseMax: 6, scale: 1.1 },
  { Model: Brachiosaurus, home: { d: 2.75, theta: -120 }, walk: 1.1, run: 1.1, legMin: 5, legMax: 22, pauseMax: 9, scale: 1.15 },
  { Model: Brachiosaurus, home: { d: 3.0, theta: 20 }, walk: 1.0, run: 1.0, legMin: 5, legMax: 22, pauseMax: 9, scale: 0.9 },
];

function isWalkable(dir) {
  return oceanPolar(dir).d >= LAND_MIN_D && ridgeDistance(dir) >= RIDGE_CLEAR;
}

const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _e = new THREE.Vector3();
const _n = new THREE.Vector3();
const _t = new THREE.Vector3();
const _cand = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();

function offsetOnSphere(base, ang, meters, out) {
  tangentFrame(base, _e, _n);
  _t.copy(_n).multiplyScalar(Math.cos(ang)).addScaledVector(_e, Math.sin(ang));
  const a = meters / R;
  return out.copy(base).multiplyScalar(Math.cos(a)).addScaledVector(_t, Math.sin(a)).normalize();
}

function pathWalkable(a, b) {
  const ang = angularDistance(a, b);
  if (ang < 1e-6) return isWalkable(b);
  _axis.crossVectors(a, b);
  if (_axis.lengthSq() < 1e-12) return false;
  _axis.normalize();
  const n = Math.max(1, Math.ceil((ang * R) / PATH_SAMPLE));
  for (let i = 1; i <= n; i++) {
    _q.setFromAxisAngle(_axis, (ang * i) / n);
    _p.copy(a).applyQuaternion(_q);
    if (!isWalkable(_p)) return false;
  }
  return true;
}

function pickTarget(s, cfg) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const dist = cfg.legMin + Math.random() * (cfg.legMax - cfg.legMin);
    offsetOnSphere(s.pos, Math.random() * Math.PI * 2, dist, _cand);
    if (!pathWalkable(s.pos, _cand)) continue;
    s.target.copy(_cand);
    s.cruise = Math.random() < 0.25 ? cfg.run : cfg.walk * (0.8 + Math.random() * 0.4);
    return true;
  }
  return false;
}

/** Nearest walkable spot to `home`, scanning rings outward. */
function spawnPoint(home) {
  const base = polarToDir(home.d, home.theta);
  if (isWalkable(base)) return base;
  for (let m = 2; m < 60; m += 2) {
    for (let a = 0; a < 360; a += 30) {
      const p = offsetOnSphere(base, (a * Math.PI) / 180, m, new THREE.Vector3());
      if (isWalkable(p)) return p;
    }
  }
  return base;
}

function Roamer({ cfg, index }) {
  const group = useRef();
  const s = useMemo(() => {
    const pos = spawnPoint(cfg.home);
    return {
      pos,
      target: pos.clone(),
      heading: Math.random() * Math.PI * 2,
      cruise: cfg.walk,
      pause: 1 + index * 2,
      motion: { speed: 0, idle: 1 },
      init: false,
    };
  }, [cfg, index]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    let desired = 0;
    if (s.pause > 0) {
      s.pause -= dt;
      if (s.pause <= 0 && !pickTarget(s, cfg)) s.pause = 1 + Math.random() * 2;
    } else {
      const ang = angularDistance(s.pos, s.target);
      const remaining = ang * R;
      if (remaining < 0.4) {
        s.pause = 2 + Math.random() * cfg.pauseMax; // arrived: roar / graze
      } else {
        desired = Math.min(s.cruise, 0.5 + remaining * 0.9);
        const speed = Math.max(s.motion.speed, 0.3);
        _axis.crossVectors(s.pos, s.target);
        if (_axis.lengthSq() < 1e-12) {
          s.pause = 0.5;
        } else {
          _axis.normalize();
          _q.setFromAxisAngle(_axis, Math.min(ang, (speed * dt) / R));
          _cand.copy(s.pos).applyQuaternion(_q).normalize();
          if (isWalkable(_cand)) {
            s.pos.copy(_cand);
            _fwd.crossVectors(_axis, s.pos).normalize();
            tangentFrame(s.pos, _e, _n);
            s.heading = Math.atan2(-_fwd.dot(_e), _fwd.dot(_n));
          } else {
            s.pause = 0.4;
          }
        }
      }
    }
    s.motion.speed += (desired - s.motion.speed) * Math.min(1, dt * 2);
    s.motion.idle += ((s.pause > 0 ? 1 : 0) - s.motion.idle) * Math.min(1, dt * 2);

    const g = group.current;
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

  const { Model } = cfg;
  return <Model ref={group} motion={s.motion} scale={cfg.scale} />;
}

export default function BigDinos() {
  return (
    <>
      {DINOS.map((cfg, i) => (
        <Roamer key={i} cfg={cfg} index={i} />
      ))}
    </>
  );
}
