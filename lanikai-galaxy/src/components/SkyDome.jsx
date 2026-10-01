import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_RADIUS } from '../constants/worldConfig';
import { player } from '../store';
import { orientOnSurface, Y_AXIS } from '../utils/sphere';
import { SUN_DIR, CANDY_AXIS, BLEND, PALETTES, sky, tickSky, candyFactor } from '../utils/skyCycle';

/**
 * Sky gradient keyed to the PLAYER's local up (pale horizon / saturated zenith
 * wherever you stand), with two palettes — blue sunset and cotton candy — mixed
 * per pixel by the WORLD direction of the view ray against the candy axis. The
 * camera sits ~5m above a 30m planet, so the true horizon dips ~30 degrees
 * below eye level; the gradient is biased accordingly.
 */
function skyMaterial() {
  const B = PALETTES.blue;
  const C = PALETTES.candy;
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uUp: { value: player.up.clone() },
      uAxis: { value: CANDY_AXIS },
      uBlend: { value: BLEND },
      uZenB: { value: B.zenith },
      uMidB: { value: B.mid },
      uHorB: { value: B.horizon },
      uZenC: { value: C.zenith },
      uMidC: { value: C.mid },
      uHorC: { value: C.horizon },
      uSun: { value: SUN_DIR },
      uGlowB: { value: new THREE.Color('#ffb066') },
      uGlowC: { value: new THREE.Color('#ff7fc0') },
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
      uniform vec3 uAxis;
      uniform float uBlend;
      uniform vec3 uZenB;
      uniform vec3 uMidB;
      uniform vec3 uHorB;
      uniform vec3 uZenC;
      uniform vec3 uMidC;
      uniform vec3 uHorC;
      uniform vec3 uSun;
      uniform vec3 uGlowB;
      uniform vec3 uGlowC;
      varying vec3 vWorld;
      void main() {
        vec3 dir = normalize(vWorld - cameraPosition);
        float t = dot(dir, normalize(uUp));

        // 0 = blue-sunset hemisphere, 1 = cotton-candy hemisphere (by view direction)
        float m = smoothstep(-uBlend, uBlend, dot(dir, normalize(uAxis)));

        vec3 hor = mix(uHorB, uHorC, m);
        vec3 mid = mix(uMidB, uMidC, m);
        vec3 zen = mix(uZenB, uZenC, m);
        vec3 col = mix(hor, mid, smoothstep(-0.5, 0.05, t));
        col = mix(col, zen, smoothstep(0.05, 0.85, t));

        // Sunset glow around the (low) sun, tinted by whichever sky it sits in.
        float sd = max(dot(dir, normalize(uSun)), 0.0);
        float low = 1.0 - smoothstep(0.0, 0.8, abs(t));
        vec3 glow = mix(uGlowB, uGlowC, m);
        col += glow * (pow(sd, 3.0) * 0.35 + pow(sd, 28.0) * 0.6) * (0.4 + 0.6 * low);

        // A soft pink-violet seam where the two skies meet, so the blend feels
        // like a wash of cotton candy rather than a muddy mix.
        float seam = 1.0 - abs(m * 2.0 - 1.0);
        col += vec3(0.16, 0.05, 0.14) * seam * seam * (0.5 + 0.5 * low);

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

const _cd = new THREE.Vector3();

function Clouds() {
  const group = useRef();
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 3), []);
  // One material per cloud so each can take the tint of the hemisphere it floats over.
  const mats = useMemo(
    () =>
      CLOUDS.map(
        () =>
          new THREE.MeshToonMaterial({
            color: '#ffffff',
            gradientMap: cloudGradient(),
            emissive: '#c4ddf7',
            emissiveIntensity: 0.12,
            fog: false,
            toneMapped: false, // keep them bright under ACES
          })
      ),
    []
  );

  // Slow drift around the planet; tint follows which hemisphere each cloud is over.
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.006;
    CLOUDS.forEach((c, i) => {
      _cd.copy(c.pos).normalize().applyAxisAngle(Y_AXIS, g.rotation.y);
      const m = candyFactor(_cd);
      mats[i].color.copy(PALETTES.blue.cloud).lerp(PALETTES.candy.cloud, m);
      mats[i].emissive.copy(mats[i].color).multiplyScalar(0.5);
    });
  });

  return (
    <group ref={group}>
      {CLOUDS.map((c, i) => (
        <group key={i} position={c.pos} quaternion={c.quat}>
          {c.puffs.map(([x, y, z, r], k) => (
            // flattened a touch so the bottoms read flat, like cumulus
            <mesh key={k} geometry={geo} material={mats[i]} position={[x, y, z]} scale={[r, r * 0.78, r]} />
          ))}
        </group>
      ))}
    </group>
  );
}

/**
 * Two-hemisphere sky: a blue sunset over the lagoon half, cotton-candy purple /
 * pink / orange over the far half, blending between (see utils/skyCycle.js),
 * plus fluffy clouds tinted by the hemisphere they drift over and a low
 * golden-hour sun disk at SUN_DIR. This component also refreshes the shared
 * `sky` state each frame (it mounts first, so Lighting / Water see fresh values)
 * and drives the fog + clear color from the horizon she is facing.
 */
export default function SkyDome() {
  const mat = useMemo(skyMaterial, []);
  const R = PLANET_RADIUS * 16;
  const sunPos = SUN_DIR.clone().multiplyScalar(R * 0.72);
  const fwd = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ scene, camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    // Ease the gradient's "up" toward the player's local up.
    mat.uniforms.uUp.value.lerp(player.up, 1 - Math.exp(-4 * dt)).normalize();

    camera.getWorldDirection(fwd);
    tickSky(player.up, fwd);

    // Fog + clear color follow the horizon (eased so turning doesn't pop).
    if (scene.fog) scene.fog.color.lerp(sky.fog, 1 - Math.exp(-5 * dt));
    if (scene.background && scene.background.isColor) scene.background.copy(scene.fog ? scene.fog.color : sky.fog);
  });

  return (
    <group>
      <mesh material={mat}>
        <sphereGeometry args={[R, 32, 24]} />
      </mesh>

      <Clouds />

      {/* Sun: warm core + two soft halo shells */}
      <group position={sunPos.toArray()}>
        <mesh>
          <sphereGeometry args={[R * 0.03, 24, 24]} />
          <meshBasicMaterial color="#fff4e0" fog={false} toneMapped={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[R * 0.05, 24, 24]} />
          <meshBasicMaterial color="#ffd49a" transparent opacity={0.45} fog={false} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh>
          <sphereGeometry args={[R * 0.1, 24, 24]} />
          <meshBasicMaterial color="#ffb7c8" transparent opacity={0.18} fog={false} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
