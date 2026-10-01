import { forwardRef, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { toonGradient, addOutlines } from '../../utils/toon';

const grad = toonGradient;
const HALF_PI = Math.PI / 2;
const TOOTH = '#f4efdc';
const EYE = '#1d1a16';
const PALETTE = { body: '#8c5d3a', belly: '#e6d3a0', dark: '#5e3c24' };

/**
 * Chunky cel-shaded T-rex (~2.7m tall, bigger than the player, smaller than the
 * pali). Authored flat: +Y up, feet at y=0, faces +Z. `motion` = { speed, idle }
 * from Roamer: legs stomp, tail counterweights, head bobs, and while idle it
 * pauses to roar (jaw opens).
 */
const TRex = forwardRef(function TRex({ motion, scale = 1 }, ref) {
  const root = useRef();
  const body = useRef();
  const legL = useRef();
  const legR = useRef();
  const tail = useRef();
  const head = useRef();
  const jaw = useRef();
  const phase = useRef(0);
  const clock = useRef(Math.random() * 50);

  useEffect(() => addOutlines(root.current, 0.03), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const speed = motion?.speed ?? 0;
    const idle = motion?.idle ?? 1;
    clock.current += dt;
    const t = clock.current;
    phase.current += dt * (1.2 + speed * 0.9);
    const amp = Math.min(1, speed / 1.6) * 0.6;
    const s = Math.sin(phase.current);
    if (legL.current) legL.current.rotation.x = s * amp;
    if (legR.current) legR.current.rotation.x = -s * amp;
    if (body.current) body.current.position.y = Math.abs(Math.cos(phase.current)) * 0.07 * amp;
    if (tail.current) {
      tail.current.rotation.y = Math.sin(phase.current) * 0.22 * amp + Math.sin(t * 0.8) * 0.12 * idle;
      tail.current.rotation.x = 0.05 + Math.sin(phase.current * 2) * 0.03 * amp;
    }
    if (head.current) {
      head.current.rotation.x = Math.sin(phase.current * 2) * 0.05 * amp - idle * 0.12 * Math.max(0, Math.sin(t * 0.7));
      head.current.rotation.y = Math.sin(t * 0.5) * 0.25 * idle;
    }
    // roar: jaw snaps open in bursts while standing around
    const roar = Math.max(0, Math.sin(t * 0.75)) ** 6;
    if (jaw.current) jaw.current.rotation.x = 0.03 + roar * 0.55 * idle;
  });

  return (
    <group ref={ref} scale={scale} dispose={null}>
      <group ref={root}>
        {/* legs: hip pivot at y=1.37 */}
        {[
          { r: legL, x: -0.42 },
          { r: legR, x: 0.42 },
        ].map(({ r, x }) => (
          <group key={x} ref={r} position={[x, 1.37, -0.05]}>
            <mesh castShadow position={[0, -0.36, 0]}>
              <capsuleGeometry args={[0.27, 0.5, 8, 16]} />
              <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
            </mesh>
            <mesh castShadow position={[0, -0.98, -0.04]}>
              <capsuleGeometry args={[0.15, 0.5, 8, 14]} />
              <meshToonMaterial color={PALETTE.dark} gradientMap={grad()} />
            </mesh>
            <RoundedBox args={[0.34, 0.14, 0.6]} radius={0.06} smoothness={3} position={[0, -1.3, 0.14]}>
              <meshToonMaterial color={PALETTE.dark} gradientMap={grad()} />
            </RoundedBox>
            {[-1, 0, 1].map((k) => (
              <mesh key={k} position={[k * 0.11, -1.3, 0.47]} rotation={[HALF_PI, 0, 0]}>
                <coneGeometry args={[0.04, 0.12, 8]} />
                <meshToonMaterial color={TOOTH} gradientMap={grad()} />
              </mesh>
            ))}
          </group>
        ))}

        <group ref={body}>
          {/* torso + pale belly */}
          <mesh castShadow position={[0, 1.78, 0]} rotation={[HALF_PI, 0, 0]}>
            <capsuleGeometry args={[0.56, 1.1, 10, 20]} />
            <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
          </mesh>
          <mesh position={[0, 1.66, 0.04]} rotation={[HALF_PI, 0, 0]}>
            <capsuleGeometry args={[0.53, 1.05, 10, 20]} />
            <meshToonMaterial color={PALETTE.belly} gradientMap={grad()} />
          </mesh>
          {/* neck */}
          <mesh castShadow position={[0, 2.15, 0.85]}>
            <sphereGeometry args={[0.42, 18, 18]} />
            <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
          </mesh>
          {/* tiny arms */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.42, 1.7, 0.78]} rotation={[0.7, 0, -s * 0.15]}>
              <mesh position={[0, -0.14, 0]}>
                <capsuleGeometry args={[0.06, 0.2, 6, 10]} />
                <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
              </mesh>
              {[-0.03, 0.03].map((dx) => (
                <mesh key={dx} position={[dx, -0.3, 0]}>
                  <coneGeometry args={[0.02, 0.1, 6]} />
                  <meshToonMaterial color={TOOTH} gradientMap={grad()} />
                </mesh>
              ))}
            </group>
          ))}
          {/* head: big upper skull + hinged lower jaw */}
          <group ref={head} position={[0, 2.3, 1.15]}>
            <RoundedBox args={[0.64, 0.6, 1.0]} radius={0.22} smoothness={4} position={[0, 0.06, 0.32]} castShadow>
              <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
            </RoundedBox>
            {[-1, 1].map((s) => (
              <group key={s}>
                <mesh position={[s * 0.33, 0.2, 0.32]}>
                  <sphereGeometry args={[0.065, 10, 10]} />
                  <meshToonMaterial color={EYE} gradientMap={grad()} />
                </mesh>
                <mesh position={[s * 0.3, 0.3, 0.3]} scale={[1, 0.6, 1.5]}>
                  <sphereGeometry args={[0.1, 10, 10]} />
                  <meshToonMaterial color={PALETTE.dark} gradientMap={grad()} />
                </mesh>
                {[0.1, 0.3, 0.5, 0.7].map((z) => (
                  <mesh key={z} position={[s * 0.25, -0.27, z]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[0.045, 0.15, 8]} />
                    <meshToonMaterial color={TOOTH} gradientMap={grad()} />
                  </mesh>
                ))}
              </group>
            ))}
            <group ref={jaw} position={[0, -0.22, 0.0]}>
              <RoundedBox args={[0.5, 0.14, 0.85]} radius={0.06} smoothness={3} position={[0, -0.05, 0.4]}>
                <meshToonMaterial color={PALETTE.belly} gradientMap={grad()} />
              </RoundedBox>
            </group>
          </group>
          {/* tail: tapered cone pivoting at the hips */}
          <group ref={tail} position={[0, 1.8, -0.55]}>
            <mesh castShadow position={[0, 0, -0.95]} rotation={[-HALF_PI, 0, 0]}>
              <coneGeometry args={[0.5, 1.9, 14]} />
              <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

export default TRex;
