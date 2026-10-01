import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Loader, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { useGame } from './store';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import Lighting from './components/Lighting';
import Planet from './components/Planet';
import Water from './components/Water';
import Island from './components/Island';
import SkyDome from './components/SkyDome';
import RaptorPack from './components/creatures/RaptorPack';
import PterodactylFlock from './components/creatures/PterodactylFlock';
import BigDinos from './components/creatures/BigDinos';
import DolphinPod from './components/creatures/DolphinPod';
import Player from './components/Player';
import FollowCamera from './components/FollowCamera';
import AudioController from './components/AudioController';
import IntroScreen from './components/ui/IntroScreen';
import MobileJoystick from './components/ui/MobileJoystick';
import Hud from './components/ui/Hud';

/**
 * Scenic-only v1: sky, lighting, the island planet + scenery, and the walking
 * character. No notes / surprise / NPC content (unlike camille-galaxy).
 */
export default function App() {
  const started = useGame((s) => s.started);
  const inputRef = useKeyboardControls();

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.95;
        }}
      >
        <color attach="background" args={['#7cc4f2']} />
        <fog attach="fog" args={['#d8f1ff', 80, 170]} />

        <PerspectiveCamera makeDefault fov={55} near={0.1} far={4000} position={[0, 30, 30]} />
        <AdaptiveDpr pixelated />

        <Suspense fallback={null}>
          <SkyDome />
          <Lighting />
          <Planet />
          <Water />
          <Island />
          <RaptorPack />
          <RaptorPack home={{ d: 2.9, theta: -40 }} count={3} />
          <PterodactylFlock />
          <BigDinos />
          <DolphinPod />
          <Player inputRef={inputRef} />
          {started && <AudioController />}
        </Suspense>

        <FollowCamera />
      </Canvas>

      <Loader />
      {!started && <IntroScreen />}
      {started && (
        <>
          <Hud />
          <MobileJoystick inputRef={inputRef} />
        </>
      )}
    </>
  );
}
