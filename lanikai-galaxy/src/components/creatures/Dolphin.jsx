import { forwardRef, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { toonGradient, addOutlines } from '../../utils/toon';

export const DOLPHIN_PALETTES = [
  { back: '#6d8fb0', belly: '#e8f0f4', fin: '#587998' },
  { back: '#7a94a8', belly: '#eef2f2', fin: '#627d92' },
  { back: '#5f87ad', belly: '#e4eef5', fin: '#4d7194' },
];

const EYE = '#1d2228';
const grad = toonGradient;
const HALF_PI = Math.PI / 2;

/**
 * Cel-shaded bottlenose dolphin, ~2m long. Local +Z is forward, +Y up. The
 * wrapper (DolphinPod) places/orients the root group; `motion.swim` (0..1) and
 * `motion.phase` drive the vertical tail undulation, `motion.air` (0..1) is 1
 * while airborne (a stiffer, arched body and a flicked tail).
 */
const Dolphin = forwardRef(function Dolphin({ palette = DOLPHIN_PALETTES[0], motion }, ref) {
  const root = useRef();
  const tail = useRef();
  const fluke = useRef();

  useEffect(() => addOutlines(root.current, 0.02), []);

  useFrame(() => {
    const w = Math.sin(motion.phase);
    if (tail.current) tail.current.rotation.x = w * (0.28 + 0.2 * motion.air);
    if (fluke.current) fluke.current.rotation.x = Math.sin(motion.phase - 0.9) * 0.35;
  });

  return (
    <group ref={ref} dispose={null}>
      <group ref={root}>
        {/* body (dark back) + pale belly peeking underneath */}
        <mesh castShadow rotation={[HALF_PI, 0, 0]}>
          <capsuleGeometry args={[0.27, 0.9, 8, 16]} />
          <meshToonMaterial color={palette.back} gradientMap={grad()} />
        </mesh>
        <mesh position={[0, -0.09, 0.02]} rotation={[HALF_PI, 0, 0]}>
          <capsuleGeometry args={[0.255, 0.85, 8, 16]} />
          <meshToonMaterial color={palette.belly} gradientMap={grad()} />
        </mesh>
        {/* melon + beak */}
        <mesh position={[0, 0.02, 0.76]} scale={[1, 0.9, 1.1]}>
          <sphereGeometry args={[0.25, 20, 20]} />
          <meshToonMaterial color={palette.back} gradientMap={grad()} />
        </mesh>
        <mesh position={[0, -0.06, 1.05]} rotation={[HALF_PI, 0, 0]}>
          <capsuleGeometry args={[0.085, 0.2, 6, 12]} />
          <meshToonMaterial color={palette.back} gradientMap={grad()} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.2, 0.06, 0.74]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshToonMaterial color={EYE} gradientMap={grad()} />
          </mesh>
        ))}
        {/* dorsal fin */}
        <mesh position={[0, 0.3, -0.05]} rotation={[-0.55, 0, 0]}>
          <coneGeometry args={[0.1, 0.34, 10]} />
          <meshToonMaterial color={palette.fin} gradientMap={grad()} />
        </mesh>
        {/* pectoral fins */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.34, -0.15, 0.32]} rotation={[0, s * 0.35, -s * 0.45]} scale={[0.32, 0.05, 0.17]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshToonMaterial color={palette.fin} gradientMap={grad()} />
          </mesh>
        ))}
        {/* tail stock (pivots at the rear of the body) + flukes */}
        <group ref={tail} position={[0, 0, -0.68]}>
          <mesh position={[0, 0, -0.4]} rotation={[-HALF_PI, 0, 0]}>
            <coneGeometry args={[0.2, 0.8, 12]} />
            <meshToonMaterial color={palette.back} gradientMap={grad()} />
          </mesh>
          <group ref={fluke} position={[0, 0, -0.8]}>
            <mesh scale={[0.46, 0.05, 0.2]}>
              <sphereGeometry args={[1, 14, 10]} />
              <meshToonMaterial color={palette.fin} gradientMap={grad()} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

export default Dolphin;
