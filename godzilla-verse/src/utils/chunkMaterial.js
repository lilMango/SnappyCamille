import * as THREE from 'three';
import { atlasTexture } from './atlas';

// Two shared materials for every chunk (so the whole city is two shader programs and no
// state changes between chunks). Lighting is baked into vertex colours by the mesher, so
// there are no lights and no normals: a basic material with the atlas map, vertex colours
// and fog. toneMapped:false keeps the Minecraft palette from being desaturated by ACES.
//
// Time of day is a single shared colour, `worldTint`, multiplied onto everything EXCEPT
// self-lit faces (lit windows, neon — the per-vertex `aEmit` attribute), so dusk/night
// darken the city while windows keep glowing. Changing the preset is one uniform write.

export const worldTint = { value: new THREE.Color(1, 1, 1) };

function patchTint(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = worldTint;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEmit;\nvarying float vEmit;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmit = aEmit;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmit;\nuniform vec3 uTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(uTint, vec3(1.0), vEmit);');
  };
  // one program for the opaque and one for the cutout material (different alphaTest/side)
  material.customProgramCacheKey = () => 'chunk-tint';
  return material;
}

let _opaque = null;
export function chunkMaterial() {
  if (!_opaque) {
    _opaque = patchTint(
      new THREE.MeshBasicMaterial({
        map: atlasTexture(),
        vertexColors: true,
        fog: true,
        toneMapped: false,
      }),
    );
  }
  return _opaque;
}

// Cutout pass: alpha-tested (no blending, so no sorting) for fences / leaves. Double-sided
// so the far side of a see-through block shows through the gaps.
let _cutout = null;
export function cutoutMaterial() {
  if (!_cutout) {
    _cutout = patchTint(
      new THREE.MeshBasicMaterial({
        map: atlasTexture(),
        vertexColors: true,
        fog: true,
        toneMapped: false,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      }),
    );
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
