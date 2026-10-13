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

// Two point glows (a beam's impact, a charged jaw) that light the unlit chunks: xyz + radius, and an
// rgb intensity each. Zero intensity = off. Written by the kaiju effects every frame.
export const worldGlow = {
  pos: { value: [new THREE.Vector4(0, -999, 0, 1), new THREE.Vector4(0, -999, 0, 1)] },
  col: { value: [new THREE.Vector3(), new THREE.Vector3()] },
};

function patchTint(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTint = worldTint;
    shader.uniforms.uGlowP = worldGlow.pos;
    shader.uniforms.uGlowC = worldGlow.col;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aEmit;\nvarying float vEmit;\nvarying vec3 vWorldPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmit = aEmit;\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vEmit;\nvarying vec3 vWorldPos;\nuniform vec3 uTint;\nuniform vec4 uGlowP[2];\nuniform vec3 uGlowC[2];')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        diffuseColor.rgb *= mix(uTint, vec3(1.0), vEmit);
        for (int i = 0; i < 2; i++) {
          float gf = max(0.0, 1.0 - distance(vWorldPos, uGlowP[i].xyz) / uGlowP[i].w);
          diffuseColor.rgb += uGlowC[i] * (gf * gf);
        }`,
      );
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
