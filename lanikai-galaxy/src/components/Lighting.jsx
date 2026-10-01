import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { PLANET_RADIUS } from '../constants/worldConfig';
import { SUN_DIR, sky } from '../utils/skyCycle';

/**
 * Golden-hour lighting whose tint follows the two-hemisphere sky (see
 * utils/skyCycle.js): a warm low sun that goes peach over the lagoon half and
 * pink over the cotton-candy half, a matching hemisphere fill, an opposite-side
 * bounce so the far side never goes dark, and the daylight park HDRI for ambient.
 */
export default function Lighting({ highQuality = true }) {
  const sun = useRef();
  const hemi = useRef();
  const bounce = useRef();

  useFrame(() => {
    if (sun.current) {
      sun.current.position.copy(SUN_DIR).multiplyScalar(PLANET_RADIUS * 3);
      sun.current.color.copy(sky.sun);
    }
    if (hemi.current) {
      hemi.current.color.copy(sky.hemiSky);
      hemi.current.groundColor.copy(sky.hemiGround);
    }
    if (bounce.current) {
      bounce.current.position.copy(SUN_DIR).multiplyScalar(-PLANET_RADIUS * 3);
      bounce.current.color.copy(sky.bounce);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#eef8ff', '#f3e2b8', 0.95]} />
      <directionalLight
        ref={sun}
        position={SUN_DIR.clone().multiplyScalar(PLANET_RADIUS * 3).toArray()}
        intensity={1.7}
        color="#fff7e6"
        castShadow
        shadow-mapSize-width={highQuality ? 2048 : 1024}
        shadow-mapSize-height={highQuality ? 2048 : 1024}
        shadow-camera-near={1}
        shadow-camera-far={PLANET_RADIUS * 8}
        shadow-camera-left={-PLANET_RADIUS * 1.4}
        shadow-camera-right={PLANET_RADIUS * 1.4}
        shadow-camera-top={PLANET_RADIUS * 1.4}
        shadow-camera-bottom={-PLANET_RADIUS * 1.4}
        shadow-bias={-0.0004}
      />
      <directionalLight ref={bounce} position={SUN_DIR.clone().multiplyScalar(-PLANET_RADIUS * 3).toArray()} intensity={1.2} color="#d6ecff" />
      <Environment preset="park" environmentIntensity={0.4} />
    </>
  );
}
