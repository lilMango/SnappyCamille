import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { godzillaSpec, ghidorahSpec, GODZILLA_TAIL_SEGMENTS } from './rigParts';
import { assemble, kaijuMaterial, GLOW } from './rigKit';
import { poseGodzilla, poseGhidorah } from './rigAnim';

function build(spec) {
  const rig = assemble(spec, kaijuMaterial('#66ccff'));
  rig.root.updateMatrixWorld(true);
  return rig;
}

function meshes(root) {
  const out = [];
  root.traverse((o) => o.isMesh && out.push(o));
  return out;
}

describe('godzilla rig', () => {
  const rig = build(godzillaSpec());
  const box = new THREE.Box3().setFromObject(rig.root);

  test('stands about 7 units tall on the ground, facing +z', () => {
    expect(box.min.y).toBeGreaterThan(-0.3);
    expect(box.min.y).toBeLessThan(0.3);
    expect(box.max.y).toBeGreaterThan(6.2);
    expect(box.max.y).toBeLessThan(8.6);
    // the head is forward of the hips, the tail behind
    expect(rig.joints.head.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(rig.joints.hips.getWorldPosition(new THREE.Vector3()).z);
    expect(rig.joints[`tail${GODZILLA_TAIL_SEGMENTS - 1}`].getWorldPosition(new THREE.Vector3()).z).toBeLessThan(-5);
  });

  test('is a handful of merged meshes, not one per box', () => {
    const n = meshes(rig.root).length;
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThan(30);
  });

  test('every mesh carries consistent colour, glow and spine attributes', () => {
    for (const m of meshes(rig.root)) {
      const a = m.geometry.attributes;
      const n = a.position.count;
      expect(a.color.count).toBe(n);
      expect(a.aGlow.count).toBe(n);
      expect(a.aSpine.count).toBe(n);
      expect(a.normal.count).toBe(n);
      for (let i = 0; i < n * 3; i++) expect(Number.isFinite(a.position.array[i])).toBe(true);
    }
  });

  test('has plates, veins and eyes to light, and the plates run tail -> head', () => {
    const seen = new Set();
    let minSpine = 1;
    let maxSpine = 0;
    for (const m of meshes(rig.root)) {
      const g = m.geometry.attributes.aGlow.array;
      const s = m.geometry.attributes.aSpine.array;
      for (let i = 0; i < g.length; i++) {
        seen.add(g[i]);
        if (g[i] === GLOW.PLATE) {
          minSpine = Math.min(minSpine, s[i]);
          maxSpine = Math.max(maxSpine, s[i]);
        }
      }
    }
    expect(seen.has(GLOW.PLATE)).toBe(true);
    expect(seen.has(GLOW.VEIN)).toBe(true);
    expect(seen.has(GLOW.EYE)).toBe(true);
    expect(minSpine).toBeLessThan(0.1);
    expect(maxSpine).toBeGreaterThan(0.75);
  });

  test('the muzzle config sits near the jaw', () => {
    const jaw = rig.joints.jaw.getWorldPosition(new THREE.Vector3());
    expect(Math.abs(jaw.y - 6.2)).toBeLessThan(1.0);
  });
});

const motion = (o = {}) => ({ speed: 0, turn: 0, phase: 0, charge: 0, firing: false, roar: 0, stagger: 0, hit: 0, bob: 0, aim: 0, aimPitch: 0, ...o });

describe('poses', () => {
  test('godzilla: every joint stays finite across a gait cycle and while charging/firing', () => {
    const rig = build(godzillaSpec());
    for (let i = 0; i < 40; i++) {
      poseGodzilla(rig.joints, motion({ speed: 1, phase: i * 0.4, turn: Math.sin(i), charge: (i % 10) / 10, firing: i % 7 === 0, aim: Math.sin(i) * 0.5, aimPitch: -0.2 }), i * 0.1);
      for (const j of Object.values(rig.joints)) {
        expect(Number.isFinite(j.rotation.x + j.rotation.y + j.rotation.z)).toBe(true);
        expect(Number.isFinite(j.position.y)).toBe(true);
      }
    }
  });

  test('godzilla: charging opens the jaw and rears the head; legs swing opposite each other', () => {
    const rig = build(godzillaSpec());
    poseGodzilla(rig.joints, motion(), 0);
    const jaw0 = rig.joints.jaw.rotation.x;
    poseGodzilla(rig.joints, motion({ charge: 1, firing: true }), 0);
    expect(rig.joints.jaw.rotation.x).toBeGreaterThan(jaw0 + 0.3);
    poseGodzilla(rig.joints, motion({ speed: 1, phase: Math.PI / 2 }), 0);
    expect(Math.sign(rig.joints.legL.rotation.x)).toBe(-Math.sign(rig.joints.legR.rotation.x));
  });

  test('godzilla: the head ends up pitched to the aim whatever the torso does', () => {
    // total pitch down of torso -> neck -> head should be 0.12 at rest and 0.2 once aimed
    const total = (m) => {
      const rig = build(godzillaSpec());
      poseGodzilla(rig.joints, m, 0);
      return rig.joints.torso.rotation.x + rig.joints.neck.rotation.x + rig.joints.head.rotation.x;
    };
    expect(total(motion())).toBeCloseTo(0.12, 2);
    expect(total(motion({ charge: 1, firing: true, aimPitch: -0.2 }))).toBeCloseTo(0.2, 2);
  });

  test('ghidorah: wings flap in opposite senses to stay symmetric; heads never share a pose', () => {
    const rig = build(ghidorahSpec());
    poseGhidorah(rig.joints, motion({ phase: 1 }), 3);
    expect(rig.joints.wingR.rotation.z).toBeCloseTo(-rig.joints.wingL.rotation.z, 5);
    const xs = [0, 1, 2].map((k) => rig.joints[`head${k}`].rotation.x);
    expect(new Set(xs.map((v) => v.toFixed(3))).size).toBe(3);
  });
});

describe('ghidorah rig', () => {
  const rig = build(ghidorahSpec());
  const box = new THREE.Box3().setFromObject(rig.root);

  test('has three necks with three heads and a wingspan around 11 units', () => {
    for (const k of [0, 1, 2]) expect(rig.joints[`head${k}`]).toBeDefined();
    const span = box.max.x - box.min.x;
    expect(span).toBeGreaterThan(9);
    expect(span).toBeLessThan(13);
  });

  test('keeps the draw-call count down', () => {
    expect(meshes(rig.root).length).toBeLessThan(32);
  });

  test('heads rise above the body and have eyes that glow', () => {
    const head = rig.joints.head1.getWorldPosition(new THREE.Vector3());
    expect(head.y).toBeGreaterThan(2);
    let eyes = 0;
    rig.joints.head1.traverse((o) => {
      if (o.isMesh) for (const v of o.geometry.attributes.aGlow.array) if (v === GLOW.EYE) eyes++;
    });
    expect(eyes).toBeGreaterThan(0);
  });

  test('every mesh has matching attributes', () => {
    for (const m of meshes(rig.root)) {
      const a = m.geometry.attributes;
      expect(a.color.count).toBe(a.position.count);
      expect(a.aGlow.count).toBe(a.position.count);
      expect(a.aSpine.count).toBe(a.position.count);
    }
  });
});
