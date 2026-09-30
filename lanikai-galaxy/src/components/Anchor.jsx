import { useMemo } from 'react';
import * as THREE from 'three';
import { latLonToDir, surfaceQuaternion } from '../utils/sphere';
import { terrainHeight } from '../utils/terrain';
import { PLANET_RADIUS } from '../constants/worldConfig';

/**
 * Places its children on the planet surface at (lat, lon) — including the
 * rolling-hill terrain height — standing up along the surface normal and yawed
 * by `yaw` degrees. Children are authored as if on flat ground: +Y is up, they
 * sit at y=0. `height` is an extra offset above the local terrain.
 */
export default function Anchor({ lat, lon, yaw = 0, height = 0, children }) {
  const { position, quaternion } = useMemo(() => {
    const up = latLonToDir(lat, lon);
    const pos = up.clone().multiplyScalar(PLANET_RADIUS + terrainHeight(up) + height);
    const quat = surfaceQuaternion(up, THREE.MathUtils.degToRad(yaw));
    return { position: pos, quaternion: quat };
  }, [lat, lon, yaw, height]);

  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  );
}
