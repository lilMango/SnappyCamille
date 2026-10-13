import { SKY_PRESETS } from '../constants/skyConfig';
import { TIME_OF_DAY } from '../utils/worldSelect';

// Lights for the *lit* objects only (the character now, the kaiju later). Chunks are
// unlit: their shading is baked into vertex colours by the mesher and tinted by the time of
// day, so they ignore these. No shadow maps (see the perf budget) — the player gets a blob
// shadow instead.
export default function Lighting() {
  const p = SKY_PRESETS[TIME_OF_DAY];
  return (
    <>
      <hemisphereLight args={[p.hemiSky, p.hemiGround, p.hemiIntensity]} />
      <directionalLight position={p.sunDir.map((v) => v * 100)} intensity={p.sunIntensity} color={p.sun} />
    </>
  );
}
