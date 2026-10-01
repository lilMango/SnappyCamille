import { forwardRef, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { toonGradient, addOutlines } from '../../utils/toon';

const grad = toonGradient;
const HALF_PI = Math.PI / 2;
const EYE = '#1d1a16';
const PALETTE = { body: '#7fa35a', belly: '#e6e0b0', dark: '#5b7d3e', spot: '#628a45' };

const NECK_LOW = 0.5; // tilt of the lower neck toward +Z (rad)
const NECK_UP = -0.35; // upper neck bends back toward vertical

/**
 * Gentle long-neck (Brachiosaurus) ~6.4m to the top of its head. Authored flat:
 * +Y up, feet at y=0, faces +Z. `motion` = { speed, idle } from Roamer: slow
 * diagonal-pair plod, swaying neck and tail; head dips to graze while idle.
 */
const Brachiosaurus = forwardRef(function Brachiosaurus({ motion, scale = 1 }, ref) {
  const root = useRef();
  const body = useRef();
  const legs = useRef([]);
  const neck = useRef();
  const neck2 = useRef();
  const head = useRef();
  const tail = useRef();
  const phase = useRef(0);
  const clock = useRef(Math.random() * 50);

  useEffect(() => addOutlines(root.current, 0.04), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const speed = motion?.speed ?? 0;
    const idle = motion?.idle ?? 1;
    clock.current += dt;
    const t = clock.current;
    phase.current += dt * (0.9 + speed * 0.9);
    const amp = Math.min(1, speed / 1.2) * 0.4;
    const s = Math.sin(phase.current);
    // diagonal pairs: FL+BR vs FR+BL
    const order = [s, -s, -s, s]; // FL, FR, BL, BR
    legs.current.forEach((g, i) => g && (g.rotation.x = order[i] * amp));
    if (body.current) body.current.position.y = Math.abs(Math.cos(phase.current)) * 0.05 * amp;
    if (neck.current) neck.current.rotation.x = NECK_LOW + Math.sin(t * 0.6) * 0.04 + Math.sin(phase.current * 2) * 0.02 * amp;
    // graze: the upper neck folds forward + down while standing around
    const graze = idle * (0.5 + 0.5 * Math.sin(t * 0.25)) ** 2;
    if (neck2.current) neck2.current.rotation.x = NECK_UP + graze * 1.25;
    if (head.current) head.current.rotation.x = 0.1 - graze * 0.5;
    if (tail.current) {
      tail.current.rotation.y = Math.sin(phase.current) * 0.15 * amp + Math.sin(t * 0.5) * 0.12;
      tail.current.rotation.x = -0.18;
    }
  });

  const legSpots = [
    { x: -0.65, z: 0.95 },
    { x: 0.65, z: 0.95 },
    { x: -0.65, z: -0.95 },
    { x: 0.65, z: -0.95 },
  ];

  return (
    <group ref={ref} scale={scale} dispose={null}>
      <group ref={root}>
        {legSpots.map(({ x, z }, i) => (
          <group key={i} ref={(el) => (legs.current[i] = el)} position={[x, 1.9, z]}>
            <mesh castShadow position={[0, -0.95, 0]}>
              <capsuleGeometry args={[0.32, 1.25, 8, 16]} />
              <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
            </mesh>
            <mesh position={[0, -1.84, 0.08]} scale={[1, 0.45, 1.25]}>
              <sphereGeometry args={[0.36, 14, 12]} />
              <meshToonMaterial color={PALETTE.dark} gradientMap={grad()} />
            </mesh>
          </group>
        ))}

        <group ref={body}>
          <mesh castShadow position={[0, 2.65, 0]} rotation={[HALF_PI, 0, 0]} scale={[1, 1, 0.85]}>
            <capsuleGeometry args={[0.95, 1.6, 10, 22]} />
            <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
          </mesh>
          <mesh position={[0, 2.5, 0.03]} rotation={[HALF_PI, 0, 0]} scale={[1, 1, 0.85]}>
            <capsuleGeometry args={[0.9, 1.55, 10, 22]} />
            <meshToonMaterial color={PALETTE.belly} gradientMap={grad()} />
          </mesh>
          {/* back spots */}
          {[
            [0.45, 3.5, 0.5, 0.2],
            [-0.5, 3.45, -0.3, 0.24],
            [0.3, 3.55, -0.7, 0.18],
            [-0.3, 3.55, 0.8, 0.17],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]} scale={[1, 0.35, 1]}>
              <sphereGeometry args={[r, 10, 8]} />
              <meshToonMaterial color={PALETTE.spot} gradientMap={grad()} />
            </mesh>
          ))}

          {/* neck: two segments, head rides the tip */}
          <group ref={neck} position={[0, 3.0, 1.25]} rotation={[NECK_LOW, 0, 0]}>
            <mesh castShadow position={[0, 0.85, 0]}>
              <capsuleGeometry args={[0.34, 1.4, 8, 16]} />
              <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
            </mesh>
            <group ref={neck2} position={[0, 1.75, 0]} rotation={[NECK_UP, 0, 0]}>
              <mesh castShadow position={[0, 0.85, 0]}>
                <capsuleGeometry args={[0.22, 1.5, 8, 16]} />
                <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
              </mesh>
              <group ref={head} position={[0, 1.85, 0]}>
                <mesh castShadow position={[0, 0, 0.2]} rotation={[HALF_PI, 0, 0]} scale={[1, 1, 0.85]}>
                  <capsuleGeometry args={[0.22, 0.32, 8, 14]} />
                  <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
                </mesh>
                <mesh position={[0, 0.18, 0.12]} scale={[1, 0.7, 1.2]}>
                  <sphereGeometry args={[0.2, 12, 10]} />
                  <meshToonMaterial color={PALETTE.dark} gradientMap={grad()} />
                </mesh>
                {[-1, 1].map((s) => (
                  <mesh key={s} position={[s * 0.2, 0.06, 0.18]}>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshToonMaterial color={EYE} gradientMap={grad()} />
                  </mesh>
                ))}
              </group>
            </group>
          </group>

          <group ref={tail} position={[0, 2.5, -1.45]}>
            <mesh castShadow position={[0, 0, -1.5]} rotation={[-HALF_PI, 0, 0]}>
              <coneGeometry args={[0.62, 3.0, 14]} />
              <meshToonMaterial color={PALETTE.body} gradientMap={grad()} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
});

export default Brachiosaurus;
