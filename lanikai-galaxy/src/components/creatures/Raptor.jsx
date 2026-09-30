import { forwardRef, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { toonGradient, addOutlines } from '../../utils/toon';

const grad = toonGradient;

export const RAPTOR_PALETTES = [
  { body: '#6f9a3c', belly: '#ecdfa8', stripe: '#3f5f22', crest: '#e0632f' },
  { body: '#b9834a', belly: '#f1e2b8', stripe: '#6e4523', crest: '#2f8fb8' },
  { body: '#5f8f7a', belly: '#e6e0b0', stripe: '#34564a', crest: '#e8b732' },
  { body: '#9c9a44', belly: '#efe6b4', stripe: '#5a5a22', crest: '#d8453a' },
  { body: '#7d6f9c', belly: '#ece0c4', stripe: '#4a3f66', crest: '#f08a2c' },
];

/**
 * A mini, chunky, cel-shaded raptor (~1m tall) built from capsules, cones and
 * rounded boxes, toon materials + inverted-hull outlines like Character.jsx.
 * Authored flat: +Y up, feet at y=0, faces +Z.
 *
 * `motion` is a mutable object owned by RaptorPack: { speed (m/s), idle (0..1) }.
 * The raptor animates its own legs / tail / head from it.
 */
const Raptor = forwardRef(function Raptor({ palette = RAPTOR_PALETTES[0], motion, scale = 1 }, ref) {
  const root = useRef();
  const body = useRef();
  const legL = useRef();
  const legR = useRef();
  const armL = useRef();
  const armR = useRef();
  const tail = useRef();
  const head = useRef();
  const phase = useRef(Math.random() * 10);
  const clock = useRef(Math.random() * 100);

  useEffect(() => addOutlines(root.current, 0.018), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const speed = motion?.speed ?? 0;
    const idle = motion?.idle ?? 1;
    clock.current += dt;
    // stride frequency follows ground speed (short legs = quick little steps)
    phase.current += dt * (4 + speed * 2.2);
    const run = Math.min(1, speed / 6.5);
    const amp = Math.min(1, speed / 2) * (0.55 + 0.35 * run);
    const s = Math.sin(phase.current);
    if (legL.current) legL.current.rotation.x = s * amp;
    if (legR.current) legR.current.rotation.x = -s * amp;
    if (armL.current) armL.current.rotation.x = 0.5 + s * 0.25 * amp;
    if (armR.current) armR.current.rotation.x = 0.5 - s * 0.25 * amp;
    if (body.current) {
      body.current.position.y = Math.abs(Math.cos(phase.current)) * 0.06 * amp;
      // lean forward into a sprint
      body.current.rotation.x = 0.05 + run * 0.22;
    }
    const t = clock.current;
    if (tail.current) {
      tail.current.rotation.y = Math.sin(phase.current * 0.5) * 0.18 * amp + Math.sin(t * 1.3) * 0.25 * idle;
      tail.current.rotation.x = -0.1 + Math.sin(t * 0.9) * 0.06;
    }
    if (head.current) {
      // idle: curious look-around + a peck now and then; moving: bob with stride
      head.current.rotation.y = Math.sin(t * 0.8) * 0.6 * idle;
      head.current.rotation.x =
        idle * Math.max(0, Math.sin(t * 0.55)) ** 8 * 0.7 - run * 0.15 + Math.cos(phase.current * 2) * 0.05 * amp;
    }
  });

  const { body: B, belly, stripe, crest } = palette;

  return (
    <group ref={ref} scale={scale} dispose={null}>
      <group ref={root}>
        {/* ==== Legs: pivot at the hip ==== */}
        {[
          { r: legL, x: -0.11 },
          { r: legR, x: 0.11 },
        ].map(({ r, x }) => (
          <group key={x} ref={r} position={[x, 0.58, -0.02]}>
            {/* chunky thigh */}
            <mesh castShadow position={[0, -0.1, 0.03]} rotation={[-0.35, 0, 0]}>
              <capsuleGeometry args={[0.085, 0.14, 6, 12]} />
              <meshToonMaterial color={B} gradientMap={grad()} />
            </mesh>
            {/* shin, angled back like a bird's */}
            <mesh castShadow position={[0, -0.36, -0.03]} rotation={[0.35, 0, 0]}>
              <capsuleGeometry args={[0.045, 0.2, 4, 10]} />
              <meshToonMaterial color={B} gradientMap={grad()} />
            </mesh>
            {/* foot */}
            <RoundedBox args={[0.11, 0.05, 0.2]} radius={0.02} smoothness={2} position={[0, -0.555, 0.04]}>
              <meshToonMaterial color={stripe} gradientMap={grad()} />
            </RoundedBox>
          </group>
        ))}

        <group ref={body}>
          {/* ==== Torso: horizontal capsule + cream belly ==== */}
          <mesh castShadow position={[0, 0.66, 0.02]} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
            <capsuleGeometry args={[0.17, 0.36, 8, 16]} />
            <meshToonMaterial color={B} gradientMap={grad()} />
          </mesh>
          <mesh position={[0, 0.6, 0.06]} rotation={[Math.PI / 2 - 0.12, 0, 0]}>
            <capsuleGeometry args={[0.135, 0.3, 6, 14]} />
            <meshToonMaterial color={belly} gradientMap={grad()} />
          </mesh>
          {/* dorsal spikes */}
          {[-0.14, 0.0, 0.14].map((z, i) => (
            <mesh key={z} position={[0, 0.85 - i * 0.012, z]} rotation={[-0.3, 0, 0]}>
              <coneGeometry args={[0.04, 0.1, 5]} />
              <meshToonMaterial color={stripe} gradientMap={grad()} />
            </mesh>
          ))}

          {/* ==== Tiny arms ==== */}
          {[
            { r: armL, x: -0.13 },
            { r: armR, x: 0.13 },
          ].map(({ r, x }) => (
            <group key={x} ref={r} position={[x, 0.66, 0.24]}>
              <mesh position={[0, -0.07, 0]}>
                <capsuleGeometry args={[0.03, 0.1, 4, 8]} />
                <meshToonMaterial color={B} gradientMap={grad()} />
              </mesh>
            </group>
          ))}

          {/* ==== Neck ==== */}
          <mesh position={[0, 0.82, 0.26]} rotation={[0.55, 0, 0]}>
            <capsuleGeometry args={[0.085, 0.18, 6, 12]} />
            <meshToonMaterial color={B} gradientMap={grad()} />
          </mesh>

          {/* ==== Head (pivot at the top of the neck) ==== */}
          <group ref={head} position={[0, 0.95, 0.34]}>
            <RoundedBox args={[0.2, 0.17, 0.22]} radius={0.06} smoothness={3} castShadow position={[0, 0.02, 0.02]}>
              <meshToonMaterial color={B} gradientMap={grad()} />
            </RoundedBox>
            {/* snout */}
            <RoundedBox args={[0.14, 0.1, 0.18]} radius={0.04} smoothness={3} position={[0, -0.01, 0.17]}>
              <meshToonMaterial color={B} gradientMap={grad()} />
            </RoundedBox>
            {/* lower jaw (cream) */}
            <RoundedBox args={[0.12, 0.04, 0.16]} radius={0.015} smoothness={2} position={[0, -0.065, 0.14]}>
              <meshToonMaterial color={belly} gradientMap={grad()} />
            </RoundedBox>
            {/* big friendly eyes */}
            {[-1, 1].map((sx) => (
              <group key={sx} position={[sx * 0.1, 0.05, 0.07]}>
                <mesh>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshToonMaterial color="#fdfbf2" gradientMap={grad()} />
                </mesh>
                <mesh position={[sx * 0.012, 0.004, 0.018]}>
                  <sphereGeometry args={[0.021, 10, 10]} />
                  <meshBasicMaterial color="#1d1712" />
                </mesh>
              </group>
            ))}
            {/* little crest */}
            <mesh position={[0, 0.13, -0.02]} rotation={[-0.5, 0, 0]}>
              <coneGeometry args={[0.035, 0.12, 5]} />
              <meshToonMaterial color={crest} gradientMap={grad()} />
            </mesh>
            <mesh position={[0, 0.12, -0.08]} rotation={[-0.8, 0, 0]}>
              <coneGeometry args={[0.03, 0.1, 5]} />
              <meshToonMaterial color={crest} gradientMap={grad()} />
            </mesh>
          </group>

          {/* ==== Tail (pivot at the rump), tapering cone toward -Z ==== */}
          <group ref={tail} position={[0, 0.7, -0.2]}>
            <mesh castShadow position={[0, 0, -0.33]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.13, 0.7, 10]} />
              <meshToonMaterial color={B} gradientMap={grad()} />
            </mesh>
            {/* tail band */}
            <mesh position={[0, 0, -0.42]} rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.052, 0.068, 0.08, 10]} />
              <meshToonMaterial color={stripe} gradientMap={grad()} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

export default Raptor;
