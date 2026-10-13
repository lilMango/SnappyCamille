import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, Loader, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import AtlasCube from './components/AtlasCube';
import GlErrorBoundary from './components/GlErrorBoundary';
import ProbeHud from './components/ProbeHud';
import { useGame } from './store';
import { TILES, ATLAS_SIZE } from './utils/atlas';

const SKY = '#0b1020';

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
          <color attach="background" args={[SKY]} />
          <fog attach="fog" args={[SKY, 8, 30]} />
          <PerspectiveCamera makeDefault fov={55} near={0.1} far={400} position={[0, 1.2, 6]} />
          <AdaptiveDpr pixelated />
          <hemisphereLight args={['#bcd4ff', '#1a1420', 0.9]} />
          <directionalLight position={[4, 6, 3]} intensity={2.2} />
          <Suspense fallback={null}>
            <AtlasCube />
          </Suspense>
        </Canvas>
        <Loader />
      </GlErrorBoundary>
      <ProbeHud />
    </>
  );
}
