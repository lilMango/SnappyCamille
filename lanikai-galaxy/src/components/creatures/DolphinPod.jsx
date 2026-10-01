import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Dolphin, { DOLPHIN_PALETTES } from './Dolphin';
import { polarToDir } from '../../utils/terrain';
import { surfaceQuaternion } from '../../utils/sphere';
import { PLANET_RADIUS } from '../../constants/worldConfig';

/**
 * A pod of dolphins cruising a loop around the lagoon (centered on the ocean,
 * outside the islets) and leaping out of the water in arcs. Each dolphin runs
 * its own jump cycle: cruise just under the surface (dorsal fin cutting the
 * water), then a parabolic leap — nose pitched along the arc — and a splash
 * ring where it lands. Purely decorative: no collision, ignores the player.
 */
const POD = [
  { d: 0.74, theta0: 0, dOff: 0 },
  { d: 0.72, theta0: -9, dOff: 0 },
  { d: 0.77, theta0: -17, dOff: 0 },
  { d: 0.7, theta0: 7, dOff: 0 },
  { d: 0.75, theta0: 15, dOff: 0 },
].map((p, i) => ({
  ...p,
  period: 3.6 + (i % 3) * 0.55, // seconds per cruise+leap cycle
  phase: i * 0.37, // cycle offset (fraction)
  height: 2.2 + (i % 2) * 0.9, // leap apex, meters
  palette: DOLPHIN_PALETTES[i % DOLPHIN_PALETTES.length],
}));

const OMEGA = 0.29; // rad/s around the lagoon (~6 m/s at d≈0.74)
const LEAP = 0.42; // fraction of the cycle spent airborne
const CRUISE_Y = -0.3; // meters relative to the surface while swimming
const SPLASH_LIFE = 1.3;

const _up = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _qBase = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _PITCH_AXIS = new THREE.Vector3(1, 0, 0);

function Splash({ splash }) {
  const mesh = useRef();
  const mat = useRef();
  const geo = useMemo(() => new THREE.RingGeometry(0.55, 0.85, 32), []);
  useFrame(() => {
    const age = splash.age;
    const m = mesh.current;
    if (!m) return;
    m.visible = age < SPLASH_LIFE;
    if (!m.visible) return;
    const k = age / SPLASH_LIFE;
    m.position.copy(splash.dir).multiplyScalar(PLANET_RADIUS + 0.07);
    surfaceQuaternion(splash.dir, 0, m.quaternion);
    m.rotateX(-Math.PI / 2); // ring's normal -> local up
    m.scale.setScalar(0.6 + k * 2.4);
    mat.current.opacity = 0.85 * (1 - k) * (1 - k);
  });
  return (
    <mesh ref={mesh} geometry={geo} visible={false}>
      <meshBasicMaterial ref={mat} color="#ffffff" transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function PodMember({ cfg }) {
  const group = useRef();
  const clock = useRef(0);
  const motion = useMemo(() => ({ phase: 0, air: 0 }), []);
  const splash = useMemo(() => ({ dir: new THREE.Vector3(), age: SPLASH_LIFE }), []);
  const lastU = useRef(cfg.phase % 1);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    clock.current += dt;
    const c = clock.current;
    const g = group.current;
    if (!g) return;

    const theta = cfg.theta0 + (c * OMEGA * 180) / Math.PI;
    const d = cfg.d + Math.sin(c * 0.21 + cfg.theta0) * 0.03;
    polarToDir(d, theta, _up);
    polarToDir(d, theta + 2, _ahead);
    _fwd.copy(_ahead).addScaledVector(_up, -_ahead.dot(_up)).normalize();

    // Jump cycle.
    const u = (c / cfg.period + cfg.phase) % 1;
    let y = CRUISE_Y;
    let pitch = Math.sin(c * 1.3 + cfg.theta0) * 0.05;
    const speed = OMEGA * Math.sin(d) * PLANET_RADIUS;
    motion.air = 0;
    if (u < LEAP) {
      const s = u / LEAP;
      const rise = cfg.height * 4 * s * (1 - s);
      y = CRUISE_Y + rise;
      const vy = (cfg.height * 4 * (1 - 2 * s)) / (LEAP * cfg.period);
      pitch = Math.atan2(vy, speed);
      motion.air = Math.min(1, rise / 0.5);
    }
    // Landing: u wrapped past LEAP this frame -> drop a splash ring here.
    if (lastU.current < LEAP && u >= LEAP) {
      splash.dir.copy(_up);
      splash.age = 0;
    }
    splash.age += dt;
    lastU.current = u;

    motion.phase += dt * (5 + (motion.air > 0 ? 4 : 0));

    _x.crossVectors(_up, _fwd).normalize();
    _m.makeBasis(_x, _up, _fwd);
    _qBase.setFromRotationMatrix(_m);
    _qPitch.setFromAxisAngle(_PITCH_AXIS, -pitch); // +x rotation pitches the nose down
    g.quaternion.copy(_qBase).multiply(_qPitch);
    g.position.copy(_up).multiplyScalar(PLANET_RADIUS + y);
  });

  return (
    <>
      <Dolphin ref={group} palette={cfg.palette} motion={motion} />
      <Splash splash={splash} />
    </>
  );
}

export default function DolphinPod() {
  return (
    <>
      {POD.map((cfg, i) => (
        <PodMember key={i} cfg={cfg} />
      ))}
    </>
  );
}
