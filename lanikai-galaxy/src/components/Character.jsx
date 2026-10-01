import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { player } from '../store';
import { toonGradient, addOutlines } from '../utils/toon';

// Palette: fair skin, brownish-black hair in a bun, cream halter top,
// grey cargo pants, white/gum Adidas Sambas.
const SKIN = '#f0c9a6';
const HAIR = '#2e211b';
const HAIR_HI = '#453028';
const TOP = '#efe4c8';
const PANTS = '#6b7280';
const PANTS_DK = '#575e6b';
const SHOE = '#f2ede1';
const SHOE_GUM = '#c8a06a';
const SHOE_STRIPE = '#2e2e2e';

const grad = toonGradient;

/**
 * Cel-shaded, anime-proportioned young woman (abeto.co style). Built from
 * smooth, overlapping capsules + a lathed torso and rounded shoes so there are
 * NO flat cylinder caps or boxy seams. Toon materials + inverted-hull outlines.
 * Local +Y up, faces +Z; limbs swing with player.speed.
 */
const Character = forwardRef(function Character(_props, ref) {
  const root = useRef();
  const legL = useRef();
  const legR = useRef();
  const armL = useRef();
  const armR = useRef();
  const body = useRef();
  const pivot = useRef();
  const stroke = useRef(0);
  const t = useRef(0);

  // Smooth lathed torso: a halter-top silhouette revolved around Y.
  // Profile points (radius, height) from waist up to the neck base.
  const torsoPts = useMemo(
    () =>
      [
        [0.02, 0.0],
        [0.15, 0.01],
        [0.155, 0.06],
        [0.15, 0.14],
        [0.16, 0.22], // bust
        [0.145, 0.3],
        [0.11, 0.36],
        [0.075, 0.4], // neck base
        [0.02, 0.42],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
    []
  );

  // Ink outlines around every part (auto, constant line weight).
  useEffect(() => addOutlines(root.current, 0.026), []);

  useFrame((_, dt) => {
    const sw = player.swim;
    t.current += dt * 9.5;
    stroke.current += dt * (2.5 + 3.5 * player.speed);
    const amp = 0.55 * player.speed * (1 - sw);
    const s = Math.sin(t.current) * amp;
    const k = Math.sin(stroke.current);
    // Swimming: lie forward in the water (pivot at the hip), crawl arms
    // reaching overhead in alternation, flutter kick, gentle idle bob.
    const reach = 0.4 + 0.6 * player.speed;
    if (legL.current) legL.current.rotation.x = s + Math.sin(t.current * 1.4) * 0.3 * sw * reach;
    if (legR.current) legR.current.rotation.x = -s - Math.sin(t.current * 1.4) * 0.3 * sw * reach;
    if (armL.current) armL.current.rotation.x = -s * 0.7 * (1 - sw) + (-2.6 + k * 0.9 * reach) * sw;
    if (armR.current) armR.current.rotation.x = s * 0.7 * (1 - sw) + (-2.6 - k * 0.9 * reach) * sw;
    if (pivot.current) {
      pivot.current.rotation.x = sw * 1.15;
      pivot.current.position.y = 0.9 - sw * 0.55 + Math.sin(stroke.current * 0.8) * 0.03 * sw;
    }
    if (body.current)
      body.current.position.y = -0.9 + Math.abs(Math.cos(t.current)) * 0.04 * player.speed * (1 - sw);
  });

  return (
    <group ref={ref} dispose={null}>
      <group ref={root}>
        <group ref={pivot} position={[0, 0.9, 0]}>
        <group ref={body} position={[0, -0.9, 0]}>
          {/* ==== Legs: smooth capsules, pivot at hip y=0.8 ==== */}
          {[
            { r: legL, x: -0.1 },
            { r: legR, x: 0.1 },
          ].map(({ r, x }) => (
            <group key={x} ref={r} position={[x, 0.8, 0]}>
              {/* thigh + calf as one smooth capsule */}
              <mesh castShadow position={[0, -0.32, 0]}>
                <capsuleGeometry args={[0.082, 0.52, 8, 16]} />
                <meshToonMaterial color={PANTS} gradientMap={grad()} />
              </mesh>
              {/* cargo side pocket (rounded) */}
              <RoundedBox
                args={[0.05, 0.16, 0.13]}
                radius={0.02}
                smoothness={3}
                position={[x < 0 ? -0.085 : 0.085, -0.27, 0.01]}
              >
                <meshToonMaterial color={PANTS_DK} gradientMap={grad()} />
              </RoundedBox>
              {/* ankle cuff */}
              <mesh position={[0, -0.58, 0]}>
                <capsuleGeometry args={[0.082, 0.02, 6, 16]} />
                <meshToonMaterial color={PANTS_DK} gradientMap={grad()} />
              </mesh>
              {/* chunky Samba: rounded upper, gum sole, black toe */}
              <RoundedBox
                args={[0.15, 0.11, 0.3]}
                radius={0.045}
                smoothness={4}
                castShadow
                position={[0, -0.66, 0.05]}
              >
                <meshToonMaterial color={SHOE} gradientMap={grad()} />
              </RoundedBox>
              <RoundedBox
                args={[0.16, 0.05, 0.33]}
                radius={0.025}
                smoothness={4}
                position={[0, -0.72, 0.05]}
              >
                <meshToonMaterial color={SHOE_GUM} gradientMap={grad()} />
              </RoundedBox>
              <mesh position={[0, -0.655, 0.19]} rotation={[0.2, 0, 0]}>
                <capsuleGeometry args={[0.055, 0.06, 4, 12]} />
                <meshToonMaterial color={SHOE_STRIPE} gradientMap={grad()} />
              </mesh>
            </group>
          ))}

          {/* ==== Hips: smooth capsule waistband, blends into legs + torso ==== */}
          <mesh castShadow position={[0, 0.9, 0]}>
            <capsuleGeometry args={[0.155, 0.12, 8, 16]} />
            <meshToonMaterial color={PANTS} gradientMap={grad()} />
          </mesh>
          {/* thin midriff band of skin (crop halter over low-rise cargos) */}
          <mesh position={[0, 1.02, 0]}>
            <capsuleGeometry args={[0.142, 0.03, 6, 16]} />
            <meshToonMaterial color={SKIN} gradientMap={grad()} />
          </mesh>

          {/* ==== Torso: smooth lathed cream halter top ==== */}
          <mesh castShadow position={[0, 1.04, 0]}>
            <latheGeometry args={[torsoPts, 24]} />
            <meshToonMaterial color={TOP} gradientMap={grad()} side={THREE.DoubleSide} />
          </mesh>
          {/* bare shoulders (halter neckline) — smooth blend spheres */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.11, 1.4, 0]}>
              <sphereGeometry args={[0.075, 16, 16]} />
              <meshToonMaterial color={SKIN} gradientMap={grad()} />
            </mesh>
          ))}
          {/* upper-chest / collarbone blend */}
          <mesh position={[0, 1.4, 0.04]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshToonMaterial color={SKIN} gradientMap={grad()} />
          </mesh>
          {/* halter straps to the nape */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.05, 1.46, -0.01]} rotation={[0.12, 0, s * 0.3]}>
              <capsuleGeometry args={[0.016, 0.12, 4, 8]} />
              <meshToonMaterial color={TOP} gradientMap={grad()} />
            </mesh>
          ))}

          {/* ==== Arms: smooth capsules from shoulder spheres ==== */}
          {[
            { r: armL, x: -0.19 },
            { r: armR, x: 0.19 },
          ].map(({ r, x }) => (
            <group key={x} ref={r} position={[x, 1.34, 0]}>
              {/* shoulder cap blends arm into torso */}
              <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.06, 16, 16]} />
                <meshToonMaterial color={SKIN} gradientMap={grad()} />
              </mesh>
              <mesh castShadow position={[0, -0.24, 0]} rotation={[0, 0, x < 0 ? 0.08 : -0.08]}>
                <capsuleGeometry args={[0.045, 0.38, 8, 16]} />
                <meshToonMaterial color={SKIN} gradientMap={grad()} />
              </mesh>
              {/* hand */}
              <mesh position={[x < 0 ? -0.035 : 0.035, -0.47, 0]}>
                <sphereGeometry args={[0.052, 12, 12]} />
                <meshToonMaterial color={SKIN} gradientMap={grad()} />
              </mesh>
            </group>
          ))}

          {/* ==== Neck + big anime head ==== */}
          <mesh position={[0, 1.45, 0]}>
            <capsuleGeometry args={[0.05, 0.05, 6, 16]} />
            <meshToonMaterial color={SKIN} gradientMap={grad()} />
          </mesh>
          <mesh castShadow position={[0, 1.66, 0]} scale={[0.95, 1, 0.97]}>
            <sphereGeometry args={[0.3, 28, 28]} />
            <meshToonMaterial color={SKIN} gradientMap={grad()} />
          </mesh>

          {/* ==== Hair: smooth sculpted mass — cap, nape, side pieces, bun ==== */}
          {/* main cap (covers crown, back, sides; open at the face, +Z) */}
          <mesh castShadow position={[0, 1.7, -0.025]} scale={[1.03, 1.05, 1.05]}>
            <sphereGeometry args={[0.3, 28, 28, 0, Math.PI * 2, 0, Math.PI * 0.66]} />
            <meshToonMaterial color={HAIR} gradientMap={grad()} />
          </mesh>
          {/* back-of-head volume down to the nape */}
          <mesh position={[0, 1.55, -0.14]} scale={[0.92, 0.95, 0.7]}>
            <sphereGeometry args={[0.29, 20, 20]} />
            <meshToonMaterial color={HAIR} gradientMap={grad()} />
          </mesh>
          {/* face-framing side pieces */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.26, 1.58, 0.09]} rotation={[0, 0, s * 0.15]} scale={[0.55, 1.05, 0.8]}>
              <capsuleGeometry args={[0.08, 0.18, 8, 16]} />
              <meshToonMaterial color={HAIR} gradientMap={grad()} />
            </mesh>
          ))}
          {/* the bun, high on the back of the head */}
          <mesh castShadow position={[0, 2.0, -0.22]} scale={[1, 0.95, 0.95]}>
            <sphereGeometry args={[0.17, 20, 20]} />
            <meshToonMaterial color={HAIR_HI} gradientMap={grad()} />
          </mesh>
          {/* hair tie */}
          <mesh position={[0, 1.93, -0.15]} rotation={[1.0, 0, 0]}>
            <torusGeometry args={[0.085, 0.024, 10, 20]} />
            <meshToonMaterial color="#c9b08a" gradientMap={grad()} />
          </mesh>
        </group>
        </group>
      </group>
    </group>
  );
});

export default Character;
