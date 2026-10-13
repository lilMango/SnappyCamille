import * as THREE from 'three';
import { atlasTexture } from './atlas';

// One shared material for every chunk (one shader program, no state changes between
// chunks). Lighting is baked into vertex colours by the mesher, so there are no lights
// and no normals: a basic material with the atlas map, vertex colours and fog.
// toneMapped:false keeps the Minecraft palette from being desaturated by ACES.
let _material = null;
export function chunkMaterial() {
  if (!_material) {
    _material = new THREE.MeshBasicMaterial({
      map: atlasTexture(),
      vertexColors: true,
      fog: true,
      toneMapped: false,
    });
  }
  return _material;
}
