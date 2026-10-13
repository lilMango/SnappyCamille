import * as THREE from 'three';
import { atlasTexture } from './atlas';

// Two shared materials for every chunk (so the whole city is two shader programs and no
// state changes between chunks). Lighting is baked into vertex colours by the mesher, so
// there are no lights and no normals: a basic material with the atlas map, vertex colours
// and fog. toneMapped:false keeps the Minecraft palette from being desaturated by ACES.

let _opaque = null;
export function chunkMaterial() {
  if (!_opaque) {
    _opaque = new THREE.MeshBasicMaterial({
      map: atlasTexture(),
      vertexColors: true,
      fog: true,
      toneMapped: false,
    });
  }
  return _opaque;
}

// Cutout pass: alpha-tested (no blending, so no sorting) for fences / leaves. Double-sided
// so the far side of a see-through block shows through the gaps.
let _cutout = null;
export function cutoutMaterial() {
  if (!_cutout) {
    _cutout = new THREE.MeshBasicMaterial({
      map: atlasTexture(),
      vertexColors: true,
      fog: true,
      toneMapped: false,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
  }
  return _cutout;
}

/** Toggle wireframe on both chunk materials (debug). */
export function setChunkWireframe(on) {
  chunkMaterial().wireframe = on;
  cutoutMaterial().wireframe = on;
}

export function chunkWireframe() {
  return chunkMaterial().wireframe;
}
