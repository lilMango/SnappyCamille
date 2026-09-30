import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { toonGradient, addOutlines } from '../../utils/toon';

const grad = toonGradient;

export const PTERO_PALETTES = [
  { body: '#c46a4a', wing: '#e8946a', crest: '#f2c14e', beak: '#f3e3b5' },
  { body: '#6b7fb8', wing: '#9fb4e6', crest: '#e8653a', beak: '#f1e6c2' },
  { body: '#8a6aa8', wing: '#c3a1dc', crest: '#f0b43a', beak: '#f3e3b5' },
  { body: '#4f9a86', wing: '#8fd0b8', crest: '#e9573f', beak: '#f1e6c2' },
];

/**
 * Leathery wing as a thin extruded slab spanning local +X from the shoulder
 * pivot (x=0): a pointed tip at the leading edge and a scalloped trailing edge.
 * Centered in thickness so the inverted-hull outline shell wraps it evenly.
 */
const wingGeo = (() => {
  const s = new THREE.Shape();
  // shape (x, y) -> after rotateX(+90deg) y becomes +Z (forward)
  s.moveTo(0, 0.22);
  s.lineTo(0.7, 0.16);
  s.lineTo(1.75, 0.02); // wing tip
  s.quadraticCurveTo(1.25, -0.08, 1.05, -0.22);
  s.quadraticCurveTo(0.7, -0.2, 0.5, -0.38);
  s.quadraticCurveTo(0.25, -0.35, 0, -0.42);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
  g.translate(0, 0, -0.02);
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
})();

/**
 * A stylized, cel-shaded pterodactyl: capsule body, long beak + swept-back
 * crest, two hinged wings. Authored facing +Z with +Y up. `motion` (mutable,
 * owned by PterodactylFlock) = { flap (0..1 intensity) }.
 */
const Pterodactyl = forwardRef(function Pterodactyl({ palette = PTERO_PALETTES[0], motion, scale = 1 }, ref) {
  const root = useRef();
  const wingL = useRef();
  const wingR = useRef();
  const body = useRef();
  const phase = useRef(Math.random() * 10);

  useEffect(() => addOutlines(root.current, 0.03), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const flap = motion?.flap ?? 1;
    phase.current += dt * (5 + 3 * flap);
    // flap stroke; when gliding, wings settle into a slight dihedral
    const a = 0.12 + Math.sin(phase.current) * 0.6 * flap;
    if (wingL.current) wingL.current.rotation.z = a;
    if (wingR.current) wingR.current.rotation.z = a; // same sign: it sits inside a scale-x(-1) mirror
    // body bobs opposite the downstroke
    if (body.current) body.current.position.y = -Math.sin(phase.current) * 0.08 * flap;
  });

  const { body: B, wing, crest, beak } = palette;
  const wingMat = useMemo(
    () => new THREE.MeshToonMaterial({ color: wing, gradientMap: grad(), side: THREE.DoubleSide }),
    [wing]
  );
  useEffect(() => () => wingMat.dispose(), [wingMat]);

  return (
    <group ref={ref} dispose={null}>
      <group ref={root} scale={scale}>
        <group ref={body}>
          {/* body */}
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <capsuleGeometry args={[0.15, 0.5, 6, 12]} />
            <meshToonMaterial color={B} gradientMap={grad()} />
          </mesh>
          {/* head */}
          <mesh position={[0, 0.08, 0.5]}>
            <sphereGeometry args={[0.14, 14, 12]} />
            <meshToonMaterial color={B} gradientMap={grad()} />
          </mesh>
          {/* long beak toward +Z */}
          <mesh position={[0, 0.05, 0.84]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.07, 0.55, 8]} />
            <meshToonMaterial color={beak} gradientMap={grad()} />
          </mesh>
          {/* swept-back crest */}
          <mesh position={[0, 0.2, 0.34]} rotation={[-Math.PI / 2 + 0.5, 0, 0]}>
            <coneGeometry args={[0.06, 0.4, 6]} />
            <meshToonMaterial color={crest} gradientMap={grad()} />
          </mesh>
          {/* eyes */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.11, 0.13, 0.56]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color="#1d1712" />
            </mesh>
          ))}
          {/* short tail */}
          <mesh position={[0, 0, -0.52]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.07, 0.35, 6]} />
            <meshToonMaterial color={B} gradientMap={grad()} />
          </mesh>
          {/* tucked feet */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.07, -0.13, -0.3]} rotation={[-1.2, 0, 0]}>
              <capsuleGeometry args={[0.025, 0.12, 3, 6]} />
              <meshToonMaterial color={crest} gradientMap={grad()} />
            </mesh>
          ))}

          {/* wings: hinge about the local forward (Z) axis at each shoulder */}
          <group ref={wingL} position={[0.1, 0.06, 0.08]}>
            <mesh castShadow geometry={wingGeo} material={wingMat} />
          </group>
          <group position={[-0.1, 0.06, 0.08]} scale={[-1, 1, 1]}>
            {/* mirrored side: the hinge lives on an inner group, inside the
                mirror, so the same +rotation.z lifts both wingtips */}
            <group ref={wingR}>
              <mesh castShadow geometry={wingGeo} material={wingMat} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});

export default Pterodactyl;
