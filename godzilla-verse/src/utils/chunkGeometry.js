import * as THREE from 'three';
import { CHUNK_X, CHUNK_Z, SECTION_H } from '../constants/worldConfig';

// Every section has identical local bounds, so compute them once and clone — never
// geometry.computeBoundingSphere(), which walks every vertex.
const SECTION_BOX = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(CHUNK_X, SECTION_H, CHUNK_Z));
const SECTION_SPHERE = new THREE.Sphere();
SECTION_BOX.getBoundingSphere(SECTION_SPHERE);

/**
 * Mesher output (packed typed arrays) -> BufferGeometry, uploaded as-is:
 *   position Uint8 (not normalised), uv Uint16 (normalised), color Uint8 (normalised).
 */
export function buildChunkGeometry(r) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(r.position, 3, false));
  g.setAttribute('uv', new THREE.BufferAttribute(r.uv, 2, true));
  g.setAttribute('color', new THREE.BufferAttribute(r.color, 3, true));
  g.setIndex(new THREE.BufferAttribute(r.index, 1));
  g.boundingBox = SECTION_BOX.clone();
  g.boundingSphere = SECTION_SPHERE.clone();
  return g;
}
