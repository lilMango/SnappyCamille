import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash3 } from '../rng';
import { toonGradient, outlineMaterial } from '../toon';

/**
 * Tools for building the kaiju rigs.
 *
 * A rig is a hierarchy of joint groups (like the sibling projects' creatures), but each joint
 * holds ONE merged mesh: every box and cone that belongs to that joint is baked into a single
 * BufferGeometry. That cuts a ~110-mesh rig to ~25 draw calls (plus outlines), which is what
 * lets two 70-block kaiju fit the draw-call budget.
 *
 * Each vertex carries, besides position/normal/colour:
 *   aGlow   0 none | 1 vein | 2 plate | 3 eye/mouth      what part of the glow this belongs to
 *   aSpine  0..1 distance along the body, tail tip -> head, so the plates can light in a wave
 * The kaiju material turns those into emissive light from the controller's `charge` (see
 * `kaijuMaterial`), so the whole body powers up from one number.
 */

export const GLOW = { NONE: 0, VEIN: 1, PLATE: 2, EYE: 3 };

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _c = new THREE.Color();

function finish(g, matrix, color, glow, spine, jitter, seed) {
  g.deleteAttribute('uv');
  g.applyMatrix4(matrix);
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const base = _c.set(color);
  // the colour is authored sRGB; vertex colours are used as linear, so convert once
  const lin = base.clone();
  for (let i = 0; i < n; i++) {
    // pebbled hide: per-vertex brightness noise, quantised so neighbouring vertices agree
    const h = hash3(Math.round(pos.getX(i) * 5), Math.round(pos.getY(i) * 5), Math.round(pos.getZ(i) * 5), seed);
    const k = 1 + (h - 0.5) * 2 * jitter;
    col[i * 3] = lin.r * k;
    col[i * 3 + 1] = lin.g * k;
    col[i * 3 + 2] = lin.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
  g.setAttribute('aSpine', new THREE.BufferAttribute(new Float32Array(n).fill(spine), 1));
  return g;
}

function matrixFor(pos, rot) {
  _e.set(rot[0], rot[1], rot[2], 'YXZ');
  _q.setFromEuler(_e);
  return _m4.compose(new THREE.Vector3(pos[0], pos[1], pos[2]), _q, new THREE.Vector3(1, 1, 1)).clone();
}

/**
 * A box, centred on `pos`, rotated by `rot` (radians, YXZ), tinted `color`. Large faces are
 * subdivided a little so the per-vertex pebble noise has something to vary across.
 */
export function box({ size, pos = [0, 0, 0], rot = [0, 0, 0], color = '#808080', glow = GLOW.NONE, spine = 0, jitter = 0.1, seed = 1 }) {
  const seg = (v) => Math.max(1, Math.min(5, Math.round(v / 0.45)));
  const g = new THREE.BoxGeometry(size[0], size[1], size[2], seg(size[0]), seg(size[1]), seg(size[2]));
  return finish(g, matrixFor(pos, rot), color, glow, spine, jitter, seed);
}

/**
 * A 4-sided (or n-sided) cone with its tip along +y: dorsal plates, teeth, claws, horns.
 * `rot` tilts it; the base sits at `pos`.
 */
export function cone({ radius, height, sides = 4, pos = [0, 0, 0], rot = [0, 0, 0], color = '#808080', glow = GLOW.NONE, spine = 0, jitter = 0.06, seed = 1 }) {
  const g = new THREE.ConeGeometry(radius, height, sides, 1);
  g.translate(0, height / 2, 0); // base at the origin, tip up
  return finish(g, matrixFor(pos, rot), color, glow, spine, jitter, seed);
}

/** A flat polygon fan (a wing membrane panel) in joint-local space. `pts` = [[x,y,z], ...] counter-clockwise. */
export function panel({ pts, color = '#d9a441', jitter = 0.08, seed = 1 }) {
  const n = pts.length;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  pts.forEach((p, i) => pos.set(p, i * 3));
  const idx = [];
  for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return finish(g, new THREE.Matrix4(), color, GLOW.NONE, 0, jitter, seed);
}

/** Merge a list of part geometries into one (all from box/cone/panel, so attributes agree). */
export function merge(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * The shared toon material for a kaiju: MeshToonMaterial with vertex colours, plus an emissive
 * term driven by the per-vertex glow attributes and three uniforms:
 *   uCharge   0..1 weapon charge        (plates light in a wave from the tail tip to the head)
 *   uVein     0..1                       (the crack pattern across the hide)
 *   uEye      0..1                       (eyes and the inside of the mouth)
 *   uGlow     colour of the glow         (icy blue for Godzilla, gold for Ghidorah)
 * One material per kaiju instance, so each has its own uniforms.
 */
export function kaijuMaterial(glowColor, { doubleSided = false } = {}) {
  const mat = new THREE.MeshToonMaterial({
    vertexColors: true,
    gradientMap: toonGradient(),
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  });
  const uniforms = {
    uCharge: { value: 0 },
    uVein: { value: 0 },
    uEye: { value: 0.12 },
    uGlow: { value: new THREE.Color(glowColor) },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nattribute float aSpine;\nvarying float vGlow;\nvarying float vSpine;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;\nvSpine = aSpine;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vGlow;\nvarying float vSpine;\nuniform float uCharge;\nuniform float uVein;\nuniform float uEye;\nuniform vec3 uGlow;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float glow = 0.0;
        if (vGlow > 2.5) {
          glow = uEye;                                                  // eyes + inside the mouth
        } else if (vGlow > 1.5) {
          glow = clamp((uCharge * 1.3 - vSpine) * 6.0, 0.0, 1.0);       // plates: a wave from the tail tip to the head
        } else if (vGlow > 0.5) {
          glow = uVein;                                                 // cracks across the hide
        }
        totalEmissiveRadiance += uGlow * glow * (1.0 + uCharge * 0.9);`,
      );
  };
  mat.customProgramCacheKey = () => 'kaiju-glow';
  return mat;
}

/**
 * Inverted-hull outlines for merged joint meshes. `addOutlines` (toon.js) scales a shell about
 * the mesh origin, which for a joint whose geometry sits 3 units from its pivot (a wing, a tail
 * segment) shifts the line to one side; this scales about the geometry's own bounding-sphere
 * centre. Joints smaller than `minRadius` get no outline (draw-call budget). Returns a cleanup function.
 */
export function addCenteredOutlines(root, thickness = 0.05, minRadius = 0) {
  const added = [];
  const targets = [];
  root.traverse((o) => o.isMesh && !o.userData.isOutline && targets.push(o));
  for (const mesh of targets) {
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const { center, radius } = geo.boundingSphere;
    if (radius < minRadius) continue; // small joints (tail/neck segments) go without: each outline is another draw call
    const k = 1 + thickness / Math.max(0.1, radius);
    const shell = new THREE.Mesh(geo, outlineMaterial());
    shell.scale.setScalar(k);
    shell.position.copy(center).multiplyScalar(1 - k);
    shell.frustumCulled = false;
    shell.userData.isOutline = true;
    shell.raycast = () => {};
    mesh.add(shell);
    added.push([mesh, shell]);
  }
  return () => added.forEach(([m, s]) => m.remove(s));
}

/**
 * Turn a rig spec into a THREE hierarchy.
 *   spec = { joints: [{ name, parent: name|null, pos: [x,y,z], rot?: [x,y,z], parts: [geometry...] }] }
 * Parents must be listed before their children. Each joint with parts gets ONE merged mesh.
 * Returns { root, joints: { name: Group } }: a rig animates by setting `joints[name].rotation`
 * (the rest rotation is kept in `joints[name].userData.rest`).
 */
export function assemble(spec, material) {
  const root = new THREE.Group();
  const joints = {};
  for (const j of spec.joints) {
    const g = new THREE.Group();
    g.name = j.name;
    g.position.set(j.pos[0], j.pos[1], j.pos[2]);
    if (j.rot) g.rotation.set(j.rot[0], j.rot[1], j.rot[2], 'YXZ');
    g.userData.rest = { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z };
    if (j.parts && j.parts.length) {
      const mesh = new THREE.Mesh(merge(j.parts), material);
      mesh.frustumCulled = false; // joints move; the merged bounds are static
      g.add(mesh);
    }
    (j.parent ? joints[j.parent] : root).add(g);
    joints[j.name] = g;
  }
  return { root, joints };
}
