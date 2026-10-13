// Lights for the *lit* objects only (the character now, the kaiju later). Chunks are
// unlit: their shading is baked into vertex colours by the mesher, so they ignore these.
// No shadow maps (see the perf budget) — the player gets a blob shadow instead.
// Placeholder day rig; phase 4 retunes it for the dusk/night city.
export default function Lighting() {
  return (
    <>
      <hemisphereLight args={['#cfe2ff', '#6b6258', 1.1]} />
      <directionalLight position={[40, 90, 25]} intensity={2.2} color="#fff4e0" />
    </>
  );
}
