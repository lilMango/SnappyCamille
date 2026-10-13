import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { player, odm } from '../store';

// The two ODM ropes: SEG thin cylinders each, repositioned between sagged points every frame
// (no allocation). Not THREE.Line: lines are 1 px wide on every platform. The rope leaves the
// player's hip, shoots to the anchor in ~0.07 s, hangs slack when the line is longer than the
// distance and snaps straight when taut.

const SEG = 8;
const SHOOT_TIME = 0.07;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const _hand = new THREE.Vector3();
const _end = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _q = new THREE.Quaternion();

export default function Ropes() {
  const groups = useRef([null, null]);
  const segs = useRef([[], []]);
  const markers = useRef([null, null]);

  const geo = useMemo(() => new THREE.CylinderGeometry(0.05, 0.05, 1, 5), []);
  const markerGeo = useMemo(() => new THREE.BoxGeometry(0.34, 0.34, 0.34), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xdfe4ec, toneMapped: false, fog: true }), []);
  const markerMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffe6a8, toneMapped: false, fog: false }), []);

  useEffect(() => {
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < SEG; k++) {
        const m = new THREE.Mesh(geo, mat);
        m.frustumCulled = false;
        groups.current[side].add(m);
        segs.current[side].push(m);
      }
    }
  }, [geo, mat]);

  useFrame(() => {
    const b = player.body;
    const cf = Math.cos(player.facing);
    const sf = Math.sin(player.facing);
    for (let side = 0; side < 2; side++) {
      const a = odm.anchors[side];
      const g = groups.current[side];
      const marker = markers.current[side];
      g.visible = a.active;
      marker.visible = a.active;
      if (!a.active) continue;

      // the hip: local (+-0.3, 0.85, 0.08), rotated by the body's facing
      const lx = side === 0 ? -0.3 : 0.3;
      const lz = 0.08;
      _hand.set(b.x + lx * cf + lz * sf, b.y + 0.85, b.z - lx * sf + lz * cf);
      const t = Math.min(1, a.age / SHOOT_TIME);
      _end.set(THREE.MathUtils.lerp(_hand.x, a.x, t), THREE.MathUtils.lerp(_hand.y, a.y, t), THREE.MathUtils.lerp(_hand.z, a.z, t));

      const full = Math.hypot(a.x - _hand.x, a.y - _hand.y, a.z - _hand.z);
      // slack: the rope is longer than the straight line -> it hangs (capped so it stays sane)
      const sag = t < 1 ? 0 : Math.min(4, 0.5 * Math.sqrt(Math.max(0, a.len * a.len - full * full)));

      marker.position.set(a.x, a.y, a.z);
      marker.scale.setScalar(t < 1 ? 0.01 : 1);

      for (let k = 0; k < SEG; k++) {
        const u0 = k / SEG;
        const u1 = (k + 1) / SEG;
        _a.lerpVectors(_hand, _end, u0);
        _b.lerpVectors(_hand, _end, u1);
        _a.y -= sag * 4 * u0 * (1 - u0);
        _b.y -= sag * 4 * u1 * (1 - u1);
        _dir.subVectors(_b, _a);
        const len = _dir.length() || 1e-4;
        _dir.divideScalar(len);
        const m = segs.current[side][k];
        m.position.addVectors(_a, _b).multiplyScalar(0.5);
        _q.setFromUnitVectors(Y_AXIS, _dir);
        m.quaternion.copy(_q);
        m.scale.set(1, len, 1);
      }
    }
  });

  return (
    <>
      <group ref={(el) => (groups.current[0] = el)} />
      <group ref={(el) => (groups.current[1] = el)} />
      <mesh ref={(el) => (markers.current[0] = el)} geometry={markerGeo} material={markerMat} visible={false} />
      <mesh ref={(el) => (markers.current[1] = el)} geometry={markerGeo} material={markerMat} visible={false} />
    </>
  );
}
