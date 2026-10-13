import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Loader, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import BlockInteraction from './components/BlockInteraction';
import CameraRig from './components/CameraRig';
import ChunkRenderer from './components/ChunkRenderer';
import Crosshair from './components/Crosshair';
import DebugPanel from './components/DebugPanel';
import FlyCamera from './components/FlyCamera';
import GlErrorBoundary from './components/GlErrorBoundary';
import Hotbar from './components/Hotbar';
import Hud from './components/Hud';
import InputController from './components/InputController';
import Lighting from './components/Lighting';
import LoadingScreen from './components/LoadingScreen';
import MobileControls from './components/MobileControls';
import Player from './components/Player';
import Ropes from './components/Ropes';
import ProbeHud from './components/ProbeHud';
import Sky from './components/Sky';
import Sparks from './components/Sparks';
import Surroundings from './components/Surroundings';
import StatsProbe from './components/StatsProbe';
import { useGame, player, camState, target, stats, city, odm } from './store';
import { input } from './utils/input';
import { IS_TOUCH, SHOW_DEBUG } from './utils/worldSelect';
import { world } from './utils/voxelWorld';
import { SKY_PRESETS } from './constants/skyConfig';
import { worldTint } from './utils/chunkMaterial';
import { TIME_OF_DAY } from './utils/worldSelect';
import { TILES, ATLAS_SIZE } from './utils/atlas';

// Time of day: sky, fog, background, world tint and lights all come from one preset.
const PRESET = SKY_PRESETS[TIME_OF_DAY];
worldTint.value.set(PRESET.tint); // before any chunk material compiles

// Dev/test hook (like the sibling projects' window.__player): lets automated checks drive
// the game and read its state.
if (typeof window !== 'undefined') window.__gv = { player, input, camState, target, stats, world, useGame, city, odm };

// Phase 0 probe: a module worker created the same way the real mesh/city workers
// will be. If this reports OK on the deployed host, `base` + workers are proven.
function useWorkerProbe() {
  const setProbe = useGame((s) => s.setProbe);
  useEffect(() => {
    let worker;
    try {
      worker = new Worker(new URL('./utils/pingWorker.js', import.meta.url), { type: 'module' });
    } catch (err) {
      setProbe({ worker: `FAILED: ${err.message}` });
      return undefined;
    }
    const buffer = new ArrayBuffer(1024);
    const bytes = new Uint8Array(buffer);
    let expected = 0;
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = i & 255;
      expected = (expected + bytes[i]) | 0;
    }
    const t0 = performance.now();
    worker.onmessage = (e) => {
      const ok = e.data.sum === expected && e.data.length === 1024;
      const ms = (performance.now() - t0).toFixed(1);
      setProbe({ worker: ok ? `OK (${ms} ms round trip, transferable)` : 'FAILED: bad checksum' });
    };
    worker.onerror = (e) => setProbe({ worker: `FAILED: ${e.message || 'worker error'}` });
    worker.postMessage({ id: 1, buffer }, [buffer]);
    return () => worker.terminate();
  }, [setProbe]);
}

export default function App() {
  const setProbe = useGame((s) => s.setProbe);
  const freeCam = useGame((s) => s.freeCam);
  useWorkerProbe();
  useEffect(() => {
    setProbe({ atlas: `OK (${TILES.length} tiles, ${ATLAS_SIZE}px)` });
  }, [setProbe]);

  return (
    <>
      <GlErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.95;
          }}
        >
          <color attach="background" args={[PRESET.fog]} />
          <fog attach="fog" args={[PRESET.fog, PRESET.fogNear, PRESET.fogFar]} />
          <PerspectiveCamera makeDefault fov={70} near={0.1} far={400} />
          <AdaptiveDpr pixelated />
          <Lighting />
          {/* Mount order is frame order: input -> player -> interaction -> camera -> meshing */}
          <InputController />
          <Player />
          <BlockInteraction />
          <Ropes />
          <Sparks />
          {freeCam ? <FlyCamera /> : <CameraRig />}
          <Sky />
          <Surroundings />
          <Suspense fallback={null}>
            <ChunkRenderer />
          </Suspense>
          <StatsProbe />
        </Canvas>
        <Loader />
      </GlErrorBoundary>
      <LoadingScreen />
      <Hud />
      <Crosshair />
      <Hotbar />
      {IS_TOUCH && <MobileControls />}
      {SHOW_DEBUG && (
        <>
          <ProbeHud />
          <DebugPanel />
        </>
      )}
    </>
  );
}
