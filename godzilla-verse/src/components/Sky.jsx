import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_PRESETS, SUN_DIR, MOON_DIR } from '../constants/skyConfig';
import { TIME_OF_DAY } from '../utils/worldSelect';

// The sky: a big inside-out sphere that follows the camera (so it is always at infinity),
// shaded with a gradient, a low sun glow, a moon disc, stars and drifting clouds.
// The horizon colour equals the fog colour, so distant geometry dissolves into it.

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uGlow;
  uniform vec3 uCloud;
  uniform vec3 uMoonColor;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform float uGlowAmt;
  uniform float uStars;
  uniform float uMoon;
  uniform float uClouds;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
               mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
      s += a * noise2(p);
      p *= 2.03;
      a *= 0.5;
    }
    return s;
  }

  void main() {
    vec3 d = normalize(vDir);
    float h = max(d.y, 0.0);
    vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
    if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.7, clamp(-d.y * 3.0, 0.0, 1.0));

    // sun / horizon glow, concentrated in the sun's direction near the horizon
    float sd = max(dot(d, uSunDir), 0.0);
    float band = exp(-abs(d.y) * 5.0);
    col += uGlow * uGlowAmt * (pow(sd, 3.0) * 0.55 * band + pow(sd, 48.0) * 0.6);

    // moon
    float md = dot(d, uMoonDir);
    col = mix(col, uMoonColor, smoothstep(0.9992, 0.9996, md) * uMoon);
    col += uMoonColor * uMoon * pow(max(md, 0.0), 90.0) * 0.18;

    // stars
    if (uStars > 0.0 && d.y > 0.0) {
      vec3 g = floor(d * 220.0);
      float star = step(0.9975, hash(g));
      col += vec3(star) * uStars * smoothstep(0.05, 0.35, d.y) * (0.6 + 0.4 * hash(g + 1.0));
    }

    // clouds: fbm on a plane, fading out toward the horizon
    if (d.y > 0.02) {
      vec2 p = d.xz / (d.y + 0.12) * 1.6 + vec2(uTime * 0.01, 0.0);
      float c = fbm(p);
      float m = smoothstep(0.52, 0.78, c) * uClouds * smoothstep(0.02, 0.25, d.y);
      col = mix(col, uCloud, m * 0.75);
    }

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export default function Sky() {
  const mesh = useRef();
  const preset = SKY_PRESETS[TIME_OF_DAY];

  const material = useMemo(() => {
    const dir = (a) => new THREE.Vector3(a[0], a[1], a[2]).normalize();
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uHorizon: { value: new THREE.Color(preset.horizon) },
        uZenith: { value: new THREE.Color(preset.zenith) },
        uGlow: { value: new THREE.Color(preset.glow) },
        uCloud: { value: new THREE.Color(preset.cloudColor) },
        uMoonColor: { value: new THREE.Color('#e8ecff') },
        uSunDir: { value: dir(SUN_DIR) },
        uMoonDir: { value: dir(MOON_DIR) },
        uGlowAmt: { value: preset.glowAmount },
        uStars: { value: preset.stars },
        uMoon: { value: preset.moon },
        uClouds: { value: preset.clouds },
        uTime: { value: 0 },
      },
    });
  }, [preset]);

  useFrame(({ camera, clock }) => {
    mesh.current.position.copy(camera.position); // always at infinity
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh ref={mesh} material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[300, 32, 16]} />
    </mesh>
  );
}
