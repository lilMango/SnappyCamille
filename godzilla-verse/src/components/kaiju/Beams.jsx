import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { fx, MAX_BOLTS, BOLT_POINTS } from '../../utils/kaiju/fx';
import { worldGlow } from '../../utils/chunkMaterial';

// Weapon visuals, all reading the mutable `fx` the simulation writes:
//  - Godzilla's atomic breath: nested open cylinders (white-hot core, cyan, blue halo), additive, a growing
//    charge ball at the jaw, a glow at the impact, and two point lights (jaw + impact);
//  - Ghidorah's gravity lightning: jagged bolts drawn as instanced stretched boxes (a gold body and a white core).
// No sorting or depth writes; the lights are permanent (intensity 0 when off) so no shader ever recompiles.

const SEGS = MAX_BOLTS * (BOLT_POINTS - 1);

function glowMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
  });
}

const _dummy = new THREE.Object3D();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();

export default function Beams() {
  const beamGroup = useRef();
  const layers = useRef([]);
  const charge = useRef();
  const impact = useRef();
  const jawLight = useRef();
  const hitLight = useRef();

  const parts = useMemo(() => {
    // unit open cylinder along +z, from z = 0 to z = 1
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
    cyl.rotateX(Math.PI / 2);
    cyl.translate(0, 0, 0.5);
    return {
      cyl,
      ball: new THREE.SphereGeometry(1, 16, 12),
      box: new THREE.BoxGeometry(1, 1, 1),
      mats: [glowMaterial('#ffffff', 0.95), glowMaterial('#9fe8ff', 0.5), glowMaterial('#2f8cff', 0.3)],
      ballMat: glowMaterial('#6fc8ff', 0.7),
      impactMat: glowMaterial('#aee6ff', 0.7),
      boltGold: glowMaterial('#ffb22e', 0.8),
      boltCore: glowMaterial('#fffbe0', 1),
    };
  }, []);

  const bolts = useMemo(() => {
    const mk = (mat) => {
      const m = new THREE.InstancedMesh(parts.box, mat, SEGS);
      m.frustumCulled = false;
      m.count = 0;
      return m;
    };
    return { gold: mk(parts.boltGold), core: mk(parts.boltCore) };
  }, [parts]);

  useEffect(
    () => () => {
      parts.cyl.dispose();
      parts.ball.dispose();
      parts.box.dispose();
      [...parts.mats, parts.ballMat, parts.impactMat, parts.boltGold, parts.boltCore].forEach((m) => m.dispose());
      bolts.gold.dispose();
      bolts.core.dispose();
    },
    [parts, bolts],
  );

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const t = clock.elapsedTime;
    const b = fx.beam;

    // ---- atomic breath ----
    const g = beamGroup.current;
    const show = b.on && b.power > 0.01;
    g.visible = show;
    if (show) {
      g.position.set(b.ox, b.oy, b.oz);
      _a.set(b.ox + b.dx, b.oy + b.dy, b.oz + b.dz);
      g.lookAt(_a);
      const flick = 1 + Math.sin(t * 55) * 0.06 + Math.sin(t * 23) * 0.05;
      const radii = [1.0, 2.0, 3.4];
      for (let i = 0; i < 3; i++) {
        const r = radii[i] * b.power * flick * (1 + i * Math.sin(t * 31 + i) * 0.04);
        layers.current[i].scale.set(r, r, b.len);
      }
      impact.current.visible = b.hit;
      impact.current.position.set(0, 0, b.len); // the group's +z runs along the beam
    } else {
      impact.current.visible = false;
    }

    // ---- charge ball at the jaw ----
    const j = fx.jaw[0];
    const showBall = j.charge > 0.02;
    charge.current.visible = showBall;
    if (showBall) {
      charge.current.position.set(j.x, j.y, j.z);
      const s = (0.4 + j.charge * 2.6) * (1 + Math.sin(t * 40) * 0.1);
      charge.current.scale.setScalar(b.on ? s * 1.4 : s);
    }

    // ---- lights ----
    const jawPower = Math.max(j.charge * 0.6, show ? b.power : 0);
    jawLight.current.intensity = jawPower * 700;
    jawLight.current.position.set(j.x, j.y, j.z);
    const hitPower = show && b.hit ? b.power : 0;
    hitLight.current.intensity = hitPower * 900;
    hitLight.current.position.set(b.ex, b.ey, b.ez);

    // the same two glows light the unlit chunks (jaw, impact)
    worldGlow.pos.value[0].set(j.x, j.y, j.z, 95);
    worldGlow.col.value[0].set(0.1, 0.32, 0.65).multiplyScalar(jawPower);
    worldGlow.pos.value[1].set(b.ex, b.ey, b.ez, 55);
    worldGlow.col.value[1].set(0.45, 0.7, 1.0).multiplyScalar(hitPower * 0.8);

    // ---- lightning ----
    let n = 0;
    for (let i = 0; i < MAX_BOLTS; i++) {
      const bolt = fx.bolts[i];
      if (bolt.ttl <= 0) continue;
      bolt.ttl -= dt;
      const fade = Math.max(0, Math.min(1, bolt.ttl / bolt.life));
      const w = (0.45 + fade * 0.9) * (0.8 + 0.4 * Math.sin(t * 90 + i));
      for (let p = 0; p < BOLT_POINTS - 1; p++) {
        _a.fromArray(bolt.pts, p * 3);
        _b.fromArray(bolt.pts, (p + 1) * 3);
        _dir.subVectors(_b, _a);
        const len = _dir.length();
        if (len < 1e-4) continue;
        _dummy.position.copy(_a).addScaledVector(_dir, 0.5);
        _dummy.lookAt(_b);
        _dummy.scale.set(w * 2.0, w * 2.0, len + 0.2);
        _dummy.updateMatrix();
        bolts.gold.setMatrixAt(n, _dummy.matrix);
        _dummy.scale.set(w * 0.4, w * 0.4, len + 0.25);
        _dummy.updateMatrix();
        bolts.core.setMatrixAt(n, _dummy.matrix);
        n++;
      }
    }
    bolts.gold.count = bolts.core.count = n;
    bolts.gold.visible = bolts.core.visible = n > 0;
    if (n) bolts.gold.instanceMatrix.needsUpdate = bolts.core.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <group ref={beamGroup} visible={false}>
        {parts.mats.map((m, i) => (
          <mesh key={i} ref={(el) => (layers.current[i] = el)} geometry={parts.cyl} material={m} frustumCulled={false} renderOrder={2 + i} />
        ))}
        <mesh ref={impact} geometry={parts.ball} material={parts.impactMat} scale={7} frustumCulled={false} visible={false} />
      </group>
      <mesh ref={charge} geometry={parts.ball} material={parts.ballMat} visible={false} frustumCulled={false} />
      <primitive object={bolts.gold} />
      <primitive object={bolts.core} />
      <pointLight ref={jawLight} color="#6cc4ff" intensity={0} distance={160} decay={2} />
      <pointLight ref={hitLight} color="#9fdcff" intensity={0} distance={160} decay={2} />
    </>
  );
}
