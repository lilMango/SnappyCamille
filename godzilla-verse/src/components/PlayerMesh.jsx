import { forwardRef, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { toonGradient, addOutlines } from '../utils/toon';
import { player, odm } from '../store';

// Blocky Survey-Corps-style character built from boxes, same rig pattern as the sibling
// projects' creatures: pivot groups at the joints, driven each frame from a mutable object
// (`player`) — no skeleton, no AnimationMixer. Authored feet at y = 0, facing +z, 1.8 tall.
//
//   legs 0.70 + torso 0.65 + head 0.45 = 1.80

const SKIN = '#e0ac85';
const HAIR = '#4a3322';
const JACKET = '#7a5a3a';
const SHIRT = '#d9d3c4';
const PANTS = '#3b3f4a';
const BOOTS = '#2a2523';
const CAPE = '#3d6b3a'; // Survey Corps green
const GEAR = '#8a939c';
const BLADE = '#c9d1d8';

const grad = toonGradient();

function Box({ size, color, position }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshToonMaterial color={color} gradientMap={grad} />
    </mesh>
  );
}

const PlayerMesh = forwardRef(function PlayerMesh(_props, ref) {
  const root = useRef();
  const legL = useRef();
  const legR = useRef();
  const armL = useRef();
  const armR = useRef();
  const body = useRef();
  const phase = useRef(0);

  useEffect(() => addOutlines(root.current, 0.02), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const moving = player.body.grounded ? Math.min(1, player.speed / 6) : 0;
    phase.current += dt * (4 + player.speed * 1.1);

    if (player.body.grounded) {
      const s = Math.sin(phase.current) * 0.85 * moving;
      legL.current.rotation.x = s;
      legR.current.rotation.x = -s;
      armL.current.rotation.x = -s * 0.8;
      armR.current.rotation.x = s * 0.8;
      body.current.position.y = Math.abs(Math.cos(phase.current)) * 0.03 * moving;
    } else {
      // airborne: legs tuck / arms thrown out a little
      const air = Math.max(-1, Math.min(1, player.body.vy / 9));
      legL.current.rotation.x = 0.35 + air * 0.25;
      legR.current.rotation.x = -0.25 - air * 0.2;
      armL.current.rotation.x = -0.6 - air * 0.3;
      armR.current.rotation.x = -0.6 - air * 0.3;
      body.current.position.y = 0;
    }

    // roped: the arm on that side reaches up and forward toward the anchor, legs trail behind
    const l = odm.anchors[0].active;
    const rr = odm.anchors[1].active;
    if (l) armL.current.rotation.x = -2.6;
    if (rr) armR.current.rotation.x = -2.6;
    if ((l || rr) && !player.body.grounded) {
      legL.current.rotation.x = 0.55;
      legR.current.rotation.x = 0.25;
    }
  });

  return (
    <group ref={ref}>
      <group ref={root}>
        <group ref={body}>
          {/* legs (pivot at the hip, y = 0.70) */}
          <group ref={legL} position={[-0.11, 0.7, 0]}>
            <Box size={[0.2, 0.46, 0.22]} color={PANTS} position={[0, -0.23, 0]} />
            <Box size={[0.22, 0.24, 0.26]} color={BOOTS} position={[0, -0.58, 0.02]} />
          </group>
          <group ref={legR} position={[0.11, 0.7, 0]}>
            <Box size={[0.2, 0.46, 0.22]} color={PANTS} position={[0, -0.23, 0]} />
            <Box size={[0.22, 0.24, 0.26]} color={BOOTS} position={[0, -0.58, 0.02]} />
          </group>

          {/* torso: jacket over shirt, cape on the back, ODM gas canisters on the hips */}
          <Box size={[0.46, 0.65, 0.24]} color={JACKET} position={[0, 1.025, 0]} />
          <Box size={[0.2, 0.5, 0.01]} color={SHIRT} position={[0, 1.07, 0.125]} />
          <Box size={[0.48, 0.7, 0.04]} color={CAPE} position={[0, 0.98, -0.15]} />
          <Box size={[0.1, 0.22, 0.1]} color={GEAR} position={[-0.27, 0.78, -0.04]} />
          <Box size={[0.1, 0.22, 0.1]} color={GEAR} position={[0.27, 0.78, -0.04]} />
          <Box size={[0.04, 0.34, 0.04]} color={BLADE} position={[0.3, 0.6, 0.06]} />
          <Box size={[0.04, 0.34, 0.04]} color={BLADE} position={[-0.3, 0.6, 0.06]} />

          {/* arms (pivot at the shoulder, y = 1.30) */}
          <group ref={armL} position={[-0.33, 1.3, 0]}>
            <Box size={[0.2, 0.6, 0.2]} color={JACKET} position={[0, -0.27, 0]} />
            <Box size={[0.18, 0.12, 0.18]} color={SKIN} position={[0, -0.6, 0]} />
          </group>
          <group ref={armR} position={[0.33, 1.3, 0]}>
            <Box size={[0.2, 0.6, 0.2]} color={JACKET} position={[0, -0.27, 0]} />
            <Box size={[0.18, 0.12, 0.18]} color={SKIN} position={[0, -0.6, 0]} />
          </group>

          {/* head */}
          <Box size={[0.42, 0.42, 0.42]} color={SKIN} position={[0, 1.57, 0]} />
          <Box size={[0.44, 0.14, 0.44]} color={HAIR} position={[0, 1.76, -0.01]} />
          <Box size={[0.44, 0.3, 0.1]} color={HAIR} position={[0, 1.6, -0.17]} />
          {/* face: eyes (white, dark pupil) and a mouth, on the +z side */}
          <Box size={[0.09, 0.06, 0.01]} color="#f4f1ea" position={[-0.1, 1.6, 0.216]} />
          <Box size={[0.09, 0.06, 0.01]} color="#f4f1ea" position={[0.1, 1.6, 0.216]} />
          <Box size={[0.045, 0.06, 0.012]} color="#2a1c12" position={[-0.085, 1.6, 0.218]} />
          <Box size={[0.045, 0.06, 0.012]} color="#2a1c12" position={[0.085, 1.6, 0.218]} />
          <Box size={[0.12, 0.025, 0.01]} color="#8a4a3a" position={[0, 1.48, 0.216]} />
        </group>
      </group>
    </group>
  );
});

export default PlayerMesh;
