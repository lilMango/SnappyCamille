import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_PRESETS } from '../constants/skyConfig';
import { TIME_OF_DAY, WORLD_KIND } from '../utils/worldSelect';
import { BAY_X0, SEA_Y, SIZE } from '../constants/cityConfig';
import { GROUND_Y } from '../constants/worldConfig';

// What lies beyond the voxel world: the bay (a translucent rippling plane over the
// stone bay floor) and plain ground outside the perimeter wall, both fading into the fog.
// Only the real city has a bay and a wall; the test world floats in the sky haze.

const WATER_Y = SEA_Y + 0.85; // just under the top of the last water "cell"
const EXTENT = 900;

function rippleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c8c8c8';
  g.fillRect(0, 0, 64, 64);
  let seed = 12345;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) g.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 64), 2 + Math.floor(rand() * 5), 1);
  g.fillStyle = '#a8a8a8';
  for (let i = 0; i < 60; i++) g.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 64), 2 + Math.floor(rand() * 4), 1);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(EXTENT / 6, EXTENT / 6);
  return t;
}

export default function Surroundings() {
  const preset = SKY_PRESETS[TIME_OF_DAY];

  const water = useMemo(() => {
    const map = rippleTexture();
    const m = new THREE.MeshBasicMaterial({
      map,
      color: new THREE.Color(preset.water).multiplyScalar(1.25),
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      fog: true,
      toneMapped: false,
    });
    return m;
  }, [preset]);

  const grass = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#5d7d45').multiply(new THREE.Color(preset.tint)), fog: true, toneMapped: false }),
    [preset],
  );

  useFrame(({ clock }) => {
    water.map.offset.set(clock.elapsedTime * 0.004, clock.elapsedTime * 0.002);
  });

  if (WORLD_KIND !== 'city') return null;

  const flat = (x0, x1, z0, z1, y, material) => (
    <mesh position={[(x0 + x1) / 2, y, (z0 + z1) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={material} renderOrder={-1}>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
    </mesh>
  );
  const gy = GROUND_Y + 0.96; // just under the street surface so it never z-fights with it

  return (
    <>
      {flat(BAY_X0, BAY_X0 + EXTENT, -EXTENT / 2, SIZE + EXTENT / 2, WATER_Y, water)}
      {flat(-EXTENT, 0, -EXTENT, SIZE + EXTENT, gy, grass)}
      {flat(0, BAY_X0, -EXTENT, 0, gy, grass)}
      {flat(0, BAY_X0, SIZE, SIZE + EXTENT, gy, grass)}
    </>
  );
}
