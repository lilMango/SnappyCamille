import * as THREE from 'three';

/**
 * Cel-shading helpers for the abeto.co / Ghibli look:
 * - a shared 3-step gradient map for MeshToonMaterial (flat color + hard shadow bands)
 * - inverted-hull outlines: a back-face black shell around every mesh, scaled by
 *   bounding-sphere radius so line weight stays visually constant across parts.
 */

let _gradient = null;
export function toonGradient() {
  if (!_gradient) {
    // 3 bands: deep shade / mid / lit
    const data = new Uint8Array([90, 175, 255]);
    _gradient = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
    _gradient.minFilter = THREE.NearestFilter;
    _gradient.magFilter = THREE.NearestFilter;
    _gradient.needsUpdate = true;
  }
  return _gradient;
}

let _outlineMat = null;
export function outlineMaterial() {
  if (!_outlineMat) {
    _outlineMat = new THREE.MeshBasicMaterial({
      color: '#2b2420', // warm dark line, like inked contour
      side: THREE.BackSide,
      toneMapped: false,
    });
  }
  return _outlineMat;
}

/**
 * Adds an inverted-hull outline shell as a child of every mesh under `root`.
 * Returns a cleanup function. `thickness` is approximate world-units line weight.
 */
export function addOutlines(root, thickness = 0.02) {
  const added = [];
  const targets = [];
  root.traverse((obj) => {
    if (obj.isMesh && !obj.userData.isOutline) targets.push(obj);
  });
  for (const mesh of targets) {
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const r = geo.boundingSphere.radius || 0.1;
    const shell = new THREE.Mesh(geo, outlineMaterial());
    shell.scale.setScalar(1 + thickness / r);
    shell.userData.isOutline = true;
    shell.raycast = () => {}; // never picked
    mesh.add(shell);
    added.push([mesh, shell]);
  }
  return () => added.forEach(([m, s]) => m.remove(s));
}
