import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { world } from '../utils/voxelWorld';
import { buildTestWorld } from '../utils/testWorld';
import { ChunkMeshManager } from '../utils/chunkMeshManager';
import { chunkMaterial } from '../utils/chunkMaterial';
import { stats } from '../store';

// Renders the voxel world as ONE <group>; the manager adds/removes the section meshes
// imperatively, so a remesh never touches React.
export default function ChunkRenderer() {
  const groupRef = useRef();
  const manager = useRef(null);

  useEffect(() => {
    if (world.columns.size === 0) buildTestWorld(world); // StrictMode runs effects twice
    world.markAllDirty();
    manager.current = new ChunkMeshManager(world, groupRef.current);
    stats.sections = world.sectionCount();
    return () => {
      manager.current?.dispose();
      manager.current = null;
    };
  }, []);

  useFrame(({ camera }) => {
    const m = manager.current;
    if (!m) return;
    m.update(camera.position, 6);
    stats.meshes = m.stats.meshes;
    stats.quads = m.stats.quads;
    stats.dirty = world.dirty.size;
    stats.meshMs = m.stats.lastMeshMs;
    stats.wireframe = chunkMaterial().wireframe;
  });

  return <group ref={groupRef} />;
}
