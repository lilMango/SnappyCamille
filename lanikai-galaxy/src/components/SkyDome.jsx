import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_RADIUS } from '../constants/worldConfig';
import { player } from '../store';
import { orientOnSurface } from '../utils/sphere';

// Sun direction (shared with Lighting). A high tropical-noon sun sitting almost
// overhead of the beach spawn (spawn up = +X), tipped a little east so trees
// and cliffs still cast readable shadows, and lighting the lagoon, the beach
// and the Kualoa valley together.
export const SUN_DIR = new THREE.Vector3(0.8, -0.1, 0.5).normalize();

const ZENITH = new THREE.Color('#1f86e8'); // saturated Wii-Resort blue
const MID = new THREE.Color('#58b4f5');
const HORIZON = new THREE.Color('#d8f1ff'); // pale haze at the horizon

/**
 * Sky gradient keyed to the PLAYER's local up (not world +Y), so the horizon
 * is always pale and the zenith always deep blue wherever you stand on the
 * little planet. The camera sits ~5m above a 30m planet, so the true horizon
 * dips ~30° below eye level — the gradient is biased accordingly.
 */
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uUp: { value: player.up.clone() },
      uZenith: { value: ZENITH },
      uMid: { value: MID },
      uHorizon: { value: HORIZON },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uUp;
      uniform vec3 uZenith;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld - cameraPosition);
        float t = dot(dir, normalize(uUp));
        vec3 col = mix(uHorizon, uMid, smoothstep(-0.5, 0.05, t));
        col = mix(col, uZenith, smoothstep(0.05, 0.85, t));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// ---- Big fluffy 3D clouds -------------------------------------------------
// Soft 3-band toon ramp that never goes darker than a light blue-grey, so the
// undersides read as shaded-white rather than grey.
let _cloudGrad = null;
function cloudGradient() {
  if (!_cloudGrad) {
    _cloudGrad = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
    _cloudGrad.minFilter = THREE.NearestFilter;
    _cloudGrad.magFilter = THREE.NearestFilter;
    _cloudGrad.needsUpdate = true;
  }
  return _cloudGrad;
}

function hash(i) {
  const s = Math.sin(i * 91.345 + 12.7) * 43758.5453;
  return s - Math.floor(s);
}

// Cloud clusters scattered on a shell around the planet (fibonacci sphere).
const CLOUDS = (() => {
  const out = [];
  const N = 22;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - ((i + 0.5) / N) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
    // Keep the sun disk clear.
    if (dir.dot(SUN_DIR) > 0.93) continue;
    const dist = PLANET_RADIUS * (2.7 + hash(i) * 0.8);
    const size = 1.2 + hash(i + 7) * 0.9;
    const puffs = [];
    const n = 5 + Math.floor(hash(i + 3) * 4);
    for (let k = 0; k < n; k++) {
      const s = (k / (n - 1) - 0.5) * 2; // -1..1 along the cloud
      puffs.push([
        s * 7 * size + (hash(i * 13 + k) - 0.5) * 3,
        (1 - Math.abs(s)) * 2.4 * size + hash(i * 17 + k) * 1.2,
        (hash(i * 19 + k) - 0.5) * 5 * size,
        (3.2 + (1 - Math.abs(s)) * 2.6 + hash(i * 23 + k) * 1.4) * size,
      ]);
    }
    const quat = orientOnSurface(dir, hash(i + 11) * Math.PI * 2);
    out.push({ pos: dir.multiplyScalar(dist), quat, puffs });
  }
  return out;
})();

function Clouds() {
  const group = useRef();
  const mat = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: '#ffffff',
        gradientMap: cloudGradient(),
        emissive: '#c4ddf7',
        emissiveIntensity: 0.12,
        fog: false,
        toneMapped: false, // keep them bright white under ACES
      }),
    []
  );
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 3), []);

  // Slow drift around the planet.
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.006;
  });

  return (
    <group ref={group}>
      {CLOUDS.map((c, i) => (
        <group key={i} position={c.pos} quaternion={c.quat}>
          {c.puffs.map(([x, y, z, r], k) => (
            // flattened a touch so the bottoms read flat, like cumulus
            <mesh key={k} geometry={geo} material={mat} position={[x, y, z]} scale={[r, r * 0.78, r]} />
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Bright tropical sky: a player-up-relative blue gradient dome, big fluffy
 * cel-shaded 3D cumulus clouds floating around the planet, and a hot white sun
 * disk + halo at SUN_DIR (Lighting aims the sun light along the same vector).
 */
export default function SkyDome() {
  const mat = useMemo(skyMaterial, []);
  const R = PLANET_RADIUS * 16;
  const sunPos = SUN_DIR.clone().multiplyScalar(R * 0.72);

  // Ease the gradient's "up" toward the player's local up.
  useFrame((_, dt) => {
    const u = mat.uniforms.uUp.value;
    u.lerp(player.up, 1 - Math.exp(-4 * Math.min(dt, 1 / 30))).normalize();
  });

  return (
    <group>
      <mesh material={mat}>
        <sphereGeometry args={[R, 32, 24]} />
      </mesh>

      <Clouds />

      {/* Sun: bright core + two soft halo shells */}
      <group position={sunPos.toArray()}>
        <mesh>
          <sphereGeometry args={[R * 0.03, 24, 24]} />
          <meshBasicMaterial color="#fffdf2" fog={false} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[R * 0.05, 24, 24]} />
          <meshBasicMaterial color="#fff6c8" transparent opacity={0.45} fog={false} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[R * 0.1, 24, 24]} />
          <meshBasicMaterial color="#fff1b0" transparent opacity={0.16} fog={false} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
