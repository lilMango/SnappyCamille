import { Environment } from '@react-three/drei';
import { PLANET_RADIUS } from '../constants/worldConfig';
import { SUN_DIR } from './SkyDome';

/**
 * Bright tropical noon: a strong, near-white sun along SUN_DIR (matching the
 * sky dome's sun disk), a sky-white / warm-sand hemisphere fill (a green ground tint turned the sand olive), a soft
 * opposite-side bounce light, and a daylight park HDRI for the image-based ambient on the terrain.
 */
export default function Lighting({ highQuality = true }) {
  const sunPos = SUN_DIR.clone().multiplyScalar(PLANET_RADIUS * 3).toArray();
  return (
    <>
      <hemisphereLight args={['#eef8ff', '#f3e2b8', 0.95]} />
      <directionalLight
        position={sunPos}
        intensity={1.75}
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
      {/* Soft sky-blue bounce from the opposite side, so the far side of the
          little planet reads as bright daytime too instead of falling to night. */}
      <directionalLight position={SUN_DIR.clone().multiplyScalar(-PLANET_RADIUS * 3).toArray()} intensity={1.2} color="#d6ecff" />
      <Environment preset="park" environmentIntensity={0.45} />
    </>
  );
}
