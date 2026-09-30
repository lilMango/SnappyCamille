import { useMemo } from 'react';
import * as THREE from 'three';
import { PLANET_RADIUS } from '../constants/worldConfig';
import { terrainHeight, coastFactors, cliffFactors } from '../utils/terrain';

// Wii-Sports-Resort palette: saturated, sunny, clean.
const GRASS = new THREE.Color('#5cc236'); // bright pasture
const GRASS_DK = new THREE.Color('#34982f'); // deeper green in dips
const HIGH = new THREE.Color('#8ad84c'); // sunlit upland green
const CLIFF = new THREE.Color('#1f7a35'); // jungle green on the pali faces
const RED_EARTH = new THREE.Color('#9c4a2a'); // exposed red dirt in the flutes
const SAND = new THREE.Color('#fce9ae'); // Lanikai powder sand
const WET_SAND = new THREE.Color('#e6c98a'); // just above the waterline
const SHALLOW = new THREE.Color('#2ee0d8'); // turquoise shallows
const REEF = new THREE.Color('#18b9b0'); // reef patches
const DEEP = new THREE.Color('#1a78e0'); // deep blue offshore
const FOAM = new THREE.Color('#ffffff');

/**
 * The little island planet. Vertices are displaced by the analytic terrain
 * function (the same one the walker and Anchors sample) and vertex-colored:
 * green pasture -> fluted cliff faces on the ridges -> sand band -> turquoise
 * shallows -> deep blue, with the surf line PAINTED into the colors (the same
 * way camille-galaxy paints its road) rather than drawn as a separate mesh.
 */
export default function Planet() {
  const geometry = useMemo(() => {
    // Higher tessellation than camille's (160x120) so the sharp cliff walls and
    // the circular shoreline don't alias into stair-steps.
    const geo = new THREE.SphereGeometry(PLANET_RADIUS, 320, 240);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const dir = new THREE.Vector3();
    const c = new THREE.Color();
    const wc = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      dir.fromBufferAttribute(pos, i).normalize();
      const h = terrainHeight(dir);
      const r = PLANET_RADIUS + h;
      pos.setXYZ(i, dir.x * r, dir.y * r, dir.z * r);

      const { water, deep, reef, foam, sand, wet } = coastFactors(dir);

      // Land: deeper green in the dips -> bright pasture -> sunlit uplands.
      c.copy(GRASS_DK).lerp(GRASS, THREE.MathUtils.clamp(h / 1.3, 0, 1));
      c.lerp(HIGH, THREE.MathUtils.smoothstep(h, 5, 11) * 0.8);
      // Cliff faces: jungle green with red-dirt grooves down the flutes.
      const { wall, flute } = cliffFactors(dir);
      if (wall > 0) {
        c.lerp(CLIFF, THREE.MathUtils.clamp(wall * 1.4, 0, 1));
        c.lerp(RED_EARTH, THREE.MathUtils.clamp(flute * 0.9 - 0.3, 0, 0.45));
      }

      // Beach band.
      c.lerp(SAND, sand);
      c.lerp(WET_SAND, wet * 0.8);

      // Water: shallows (with reef patches) -> deep blue offshore.
      if (water > 0) {
        wc.copy(SHALLOW).lerp(REEF, reef * 0.7).lerp(DEEP, deep);
        c.lerp(wc, water);
      }
      // Surf / reef-break foam on top of everything.
      c.lerp(FOAM, foam);

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      {/* Lambert (no specular / Fresnel) keeps the water and sand fully
          saturated at grazing angles — the Wii-Resort look — where a
          Standard material washed the lagoon out to pale mint. */}
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      {/* Darker core so grazing silhouettes read solid */}
      <mesh>
        <sphereGeometry args={[PLANET_RADIUS - 0.2, 48, 48]} />
        <meshBasicMaterial color="#1a6fc4" />
      </mesh>
    </group>
  );
}
