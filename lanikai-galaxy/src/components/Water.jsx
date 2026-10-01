import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_RADIUS } from '../constants/worldConfig';
import { OCEAN_DIR, SHORE, BEACH_END } from '../utils/terrain';
import { SPAWN_LAT, SPAWN_LON } from '../constants/worldConfig';
import { latLonToDir } from '../utils/sphere';
import { Y_AXIS } from '../utils/sphere';
import { SUN_DIR } from '../utils/skyCycle';

/**
 * Animated water overlay — a separate transparent mesh laid over the lagoon cap
 * (and a thin strip of the beach just past the waterline). The vertex-painted
 * planet underneath stays the base color; this only tints / glosses / foams /
 * darkens on top of it. Purely decorative: no collision, no raycasts.
 *
 * Layers (fragment shader, composited back-to-front):
 *   1. water body — shallow turquoise -> deep blue tint, thin in the shallows so
 *      the painted reef + surf show, thicker toward the center; toon diffuse,
 *      tinted fresnel rim, a hard cel sun highlight and scrolling sparkles.
 *   2. wet sand   — on the beach strip: darkens when a wave arrives, dries back
 *      before the next one.
 *   3. swash      — a thin translucent sheet behind the front as it runs up.
 *   4. foam       — a white cap riding the wave front, brightening as it nears
 *      the shore and fading at the top of the run-up.
 *
 * Wave cycle: every PERIOD seconds a front travels (smoothstep-eased: builds
 * offshore, rushes in, slows as it runs up the sand) from FRONT_A (offshore)
 * to FRONT_B (top of the run-up). Its phase wobbles along the shore so it
 * doesn't arrive as a perfect circle.
 */

const SHALLOW_TINT = new THREE.Color('#5ff2ea');
const DEEP_TINT = new THREE.Color('#1462d6');
const RIM = new THREE.Color('#c8f0ff'); // sky-ish rim at grazing angles
const GLINT = new THREE.Color('#ffffff');
const WET = new THREE.Color('#a8844c'); // wet Lanikai sand (a darker WET_SAND)

// Fixed tangent basis around the ocean center for the low-poly facet lattice
// (same E1/E2 construction as terrain.js: E1 points at the spawn).
const FACET_E1 = (() => {
  const sp = latLonToDir(SPAWN_LAT, SPAWN_LON);
  return sp.clone().addScaledVector(OCEAN_DIR, -sp.dot(OCEAN_DIR)).normalize();
})();
const FACET_E2 = new THREE.Vector3().crossVectors(OCEAN_DIR, FACET_E1).normalize();
const FACET_SIZE = 0.35; // meters across one low-poly triangle cell

const LIFT = 0.04; // water sits just above the flat (height 0) lagoon
const SAND_LIFT = 0.03; // beach strip hovers just above the sand
const FRONT_A = SHORE - 0.14; // wave front starts ~4m offshore
const FRONT_B = SHORE + 0.08; // ...and runs ~2.4m up the sand
const CAP = SHORE + 0.1; // overlay extent (radians from OCEAN_DIR)

// Shared by both shaders: uniforms + swell + wave-cycle helpers.
const COMMON_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uRadius;
  uniform float uShore;
  uniform float uBeachEnd;
  uniform float uFrontA;
  uniform float uFrontB;
  uniform float uPeriod;
  uniform vec3 uCenter;

  // Low-frequency swell as a function of WORLD position + time: three
  // overlapping sines (~9m, ~7m, ~4.5m wavelengths). Returns height and writes
  // the analytic gradient into grad (used to bend the normal).
  float swell(vec3 p, float t, out vec3 grad) {
    vec3 k1 = vec3(0.55, 0.20, 0.35);
    vec3 k2 = vec3(-0.33, 0.58, 0.78);
    vec3 k3 = vec3(1.47, -1.05, 0.21);
    float a1 = 0.035;
    float a2 = 0.025;
    float a3 = 0.012;
    float p1 = dot(p, k1) + t * 0.9;
    float p2 = dot(p, k2) - t * 1.2;
    float p3 = dot(p, k3) + t * 1.7;
    grad = a1 * cos(p1) * k1 + a2 * cos(p2) * k2 + a3 * cos(p3) * k3;
    return a1 * sin(p1) + a2 * sin(p2) + a3 * sin(p3);
  }

  // Mirror of terrain.js terrainHeight() on the beach band (BEACH_HEIGHT 0.18,
  // BEACH_RISE 0.32) so the strip hugs the sand.
  float beachHeight(float d) {
    return 0.18 * smoothstep(uShore - 0.02, uShore + 0.04, d) +
           0.32 * smoothstep(uShore + 0.04, uBeachEnd, d);
  }

  // Wave-cycle phase 0..1 at this point; wobbles along the shore.
  float wavePhase(vec3 dir, float t) {
    float wob = 0.07 * sin(dot(dir, vec3(5.3, 3.1, -4.2))) +
                0.04 * sin(dot(dir, vec3(-2.7, 6.1, 3.3)));
    return fract(t / uPeriod + wob);
  }

  // Front position (radians from the ocean center) for phase c.
  float waveFront(float c) {
    return mix(uFrontA, uFrontB, c * c * (3.0 - 2.0 * c));
  }

  // Wave fades in offshore and dies at the top of the run-up.
  float waveLife(float c) {
    return smoothstep(0.0, 0.2, c) * (1.0 - smoothstep(0.8, 0.98, c));
  }

  // Crest profile: long gentle back (offshore side), steep face (shore side).
  float crestBand(float d, float front) {
    return smoothstep(front - 0.06, front, d) * (1.0 - smoothstep(front, front + 0.012, d));
  }
`;

function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uRadius: { value: PLANET_RADIUS },
        uShore: { value: SHORE },
        uBeachEnd: { value: BEACH_END },
        uFrontA: { value: FRONT_A },
        uFrontB: { value: FRONT_B },
        uPeriod: { value: 6.0 },
        uCenter: { value: OCEAN_DIR.clone() },
        uSun: { value: SUN_DIR.clone() },
        uShallow: { value: SHALLOW_TINT },
        uDeep: { value: DEEP_TINT },
        uRim: { value: RIM },
        uGlint: { value: GLINT },
        uWet: { value: WET },
        uE1: { value: FACET_E1 },
        uE2: { value: FACET_E2 },
        uFacet: { value: FACET_SIZE },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      ${COMMON_GLSL}
      varying vec3 vWorld;
      varying float vD;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec3 up = normalize(w.xyz);
        float d = acos(clamp(dot(up, uCenter), -1.0, 1.0));

        // Open-water swell: calm near the beach, full (still gentle) offshore.
        float swellAmp = 1.0 - smoothstep(uShore - 0.3, uShore - 0.02, d);
        vec3 g;
        // (+0.075 keeps the trough above the lagoon floor so it never clips.)
        float h = (swell(w.xyz, uTime, g) + 0.075) * swellAmp;

        // Incoming crest: grows and steepens as the front nears the shore.
        float c = wavePhase(up, uTime);
        float front = waveFront(c);
        float approach = smoothstep(uFrontA, uShore, front);
        float inWater = 1.0 - smoothstep(uShore - 0.03, uShore, d);
        h += crestBand(d, front) * waveLife(c) * (0.02 + 0.05 * approach) * inWater;

        // Past the waterline, ride just above the sand instead.
        float r = uRadius + max(${LIFT.toFixed(3)} + h, beachHeight(d) + ${SAND_LIFT.toFixed(3)});
        w.xyz = up * r;

        vWorld = w.xyz;
        vD = d;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      ${COMMON_GLSL}
      uniform vec3 uSun;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uRim;
      uniform vec3 uGlint;
      uniform vec3 uWet;
      uniform vec3 uE1;
      uniform vec3 uE2;
      uniform float uFacet;
      varying vec3 vWorld;
      varying float vD;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // Straight-alpha "over": paint (src, srcA) on top of dst.
      vec4 over(vec4 dst, vec3 src, float srcA) {
        float a = srcA + dst.a * (1.0 - srcA);
        vec3 rgb = (src * srcA + dst.rgb * dst.a * (1.0 - srcA)) / max(a, 1e-4);
        return vec4(rgb, a);
      }

      void main() {
        vec3 up = normalize(vWorld);
        vec3 v = normalize(cameraPosition - vWorld);
        vec3 l = normalize(uSun);
        float swellAmp = 1.0 - smoothstep(uShore - 0.3, uShore - 0.02, vD);

        // ---- 1. water body ------------------------------------------------
        // Low-poly facets: a triangle lattice laid on the water in azimuthal-
        // equidistant coords around the ocean center (continuous, no seams).
        // Each triangle gets its own gently animated tilt, so the surface reads
        // as flat, randomly lit polygons instead of smooth ripples.
        vec2 pr = vec2(dot(up, uE1), dot(up, uE2));
        vec2 p2 = uRadius * vD * normalize(pr + 1e-6) / uFacet;
        vec2 k = vec2(p2.x - p2.y * 0.57735, p2.y * 1.1547);
        vec2 cell = floor(k);
        vec2 f = fract(k);
        float tri = step(1.0, f.x + f.y);
        vec2 fid = cell + tri * vec2(0.37, 0.61);
        float h1 = hash21(fid);
        float h2 = hash21(fid + 17.3);
        float h3 = hash21(fid + 71.9);
        float tt = uTime * 0.55;
        vec2 tilt = vec2(sin(tt + h1 * 6.283), sin(tt * 0.8 + h2 * 6.283)) * 0.34;
        vec3 t1 = normalize(cross(up, uE1));
        vec3 t2 = cross(up, t1);
        vec3 n = normalize(up + (t1 * tilt.x + t2 * tilt.y) * swellAmp);

        // Depth ramp (same as coastFactors' "deep"), fading to nothing just
        // inside the waterline so the painted surf line shows through.
        float deep = 1.0 - smoothstep(0.28, 0.7, vD);
        float edge = 1.0 - smoothstep(uShore - 0.07, uShore - 0.01, vD);

        float ndl = dot(n, l);
        float lit = 0.72 + 0.45 * clamp(ndl, 0.0, 1.0); // per-facet flat shading
        vec3 col = mix(uShallow, uDeep, deep) * lit;
        // Facets drift between greener-teal and bluer tones, like the reference.
        col = mix(col, col * vec3(0.78, 0.95, 1.12), h3 * 0.7);
        col *= 0.9 + 0.2 * h1;
        float alpha = mix(0.16, 0.6, deep) * (0.88 + 0.24 * h2);

        // Fresnel-ish rim, modest + tinted so it doesn't wash to mint.
        float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
        col = mix(col, uRim, fres * 0.45);
        alpha += fres * 0.25;

        // Sun glints land on whole facets: broad highlight lobe, hard cutoff.
        vec3 hv = normalize(l + v);
        float spec = pow(max(dot(n, hv), 0.0), 60.0);
        float specBand = smoothstep(0.35, 0.45, spec);

        // A few pale facets flash white as they tilt through the light.
        float flash = smoothstep(0.93, 0.97, h1) * smoothstep(0.85, 0.95, sin(uTime * 0.9 + h2 * 40.0));
        float sparkle = flash * smoothstep(0.0, 0.5, ndl) * (0.35 + 0.65 * deep);

        float glint = clamp(specBand + sparkle, 0.0, 1.0);
        col = mix(col, uGlint, glint);
        alpha = mix(alpha, 0.95, glint);
        vec4 outc = vec4(col, clamp(alpha, 0.0, 1.0) * edge);

        // ---- wave cycle ----------------------------------------------------
        float c = wavePhase(up, uTime);
        float front = waveFront(c);
        float life = waveLife(c);
        float approach = smoothstep(uFrontA, uShore, front);
        float sunLit = 0.6 + 0.4 * max(dot(up, l), 0.0);

        // ---- 2. wet sand: darkens when the front arrives, then dries ------
        // Invert the smoothstep-eased front to find the phase at which the
        // wave reaches this point; time since then drives the drying.
        float y = clamp((vD - uFrontA) / (uFrontB - uFrontA), 0.0, 1.0);
        float cArrive = 0.5 - sin(asin(1.0 - 2.0 * y) / 3.0);
        float since = fract(c - cArrive);
        float sandZone = smoothstep(uShore - 0.015, uShore + 0.005, vD) *
                         (1.0 - smoothstep(uFrontB - 0.015, uFrontB, vD));
        float wet = (1.0 - smoothstep(0.0, 0.92, since)) * sandZone;
        outc = over(outc, uWet * sunLit, wet * 0.42);

        // ---- 3. swash: thin sheet behind the front as it runs up the sand -
        float behind = 1.0 - smoothstep(front - 0.004, front + 0.004, vD);
        float onSand = smoothstep(uShore - 0.02, uShore, vD);
        float swash = behind * onSand * smoothstep(uShore - 0.02, uShore + 0.02, front) * life;
        outc = over(outc, uShallow * sunLit, swash * 0.28);

        // ---- 4. foam cap riding the front, brighter as it nears shore -----
        float breakup = 0.5 + 0.5 * sin(dot(vWorld, vec3(3.1, 2.3, -2.7)) + uTime * 0.7) *
                                    sin(dot(vWorld, vec3(-1.9, 2.8, 3.4)) - uTime * 0.5);
        float foam = crestBand(vD, front) * life * mix(0.35, 1.0, approach) * (0.7 + 0.3 * breakup);
        float foamCel = smoothstep(0.3, 0.4, foam); // toon: crisp-edged cap
        outc = over(outc, uGlint * sunLit, foamCel * mix(0.55, 0.9, approach));

        gl_FragColor = outc;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}

export default function Water() {
  const mat = useMemo(waterMaterial, []);
  // Spherical cap around +Y (SphereGeometry's thetaLength trick), rotated onto
  // OCEAN_DIR. Dense rings (~0.25m) so the travelling crest reads smoothly.
  const geometry = useMemo(
    () => new THREE.SphereGeometry(PLANET_RADIUS + LIFT, 160, 120, 0, Math.PI * 2, 0, CAP),
    []
  );
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Y_AXIS, OCEAN_DIR), []);

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += Math.min(dt, 1 / 20);
    mat.uniforms.uSun.value.copy(SUN_DIR);
  });

  return <mesh geometry={geometry} material={mat} quaternion={quat} renderOrder={1} raycast={() => null} />;
}
