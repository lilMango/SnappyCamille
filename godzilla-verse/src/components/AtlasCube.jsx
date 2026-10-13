import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { atlasTexture, tileUV } from '../utils/atlas';

// One cube whose six faces use six different atlas tiles. It is the real atlas and
// the real tileUV() — Phase 1's mesher consumes exactly the same API — so seeing the
// right tiles here proves the atlas, gutters and UV inset before anything depends on them.
const FACE_TILES = ['brick', 'glass_lit', 'concrete', 'asphalt_line', 'steel', 'grass_side'];

function buildGeometry() {
  const g = new THREE.BoxGeometry(2, 2, 2);
  const uv = g.attributes.uv;
  // BoxGeometry emits 4 verts per face in +x,-x,+y,-y,+z,-z order, UVs (0,1)(1,1)(0,0)(1,0).
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = tileUV(FACE_TILES[f]);
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) === 0 ? u0 : u1, uv.getY(k) === 0 ? v0 : v1);
    }
  }
  return g;
}

export default function AtlasCube() {
  const ref = useRef();
  const geometry = useMemo(buildGeometry, []);
  const material = useMemo(() => new THREE.MeshLambertMaterial({ map: atlasTexture() }), []);

  useFrame((_, dt) => {
    ref.current.rotation.y += dt * 0.6;
    ref.current.rotation.x += dt * 0.25;
  });

  return <mesh ref={ref} geometry={geometry} material={material} />;
}
