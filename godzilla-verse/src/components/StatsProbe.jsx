import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { stats } from '../store';

// Samples the renderer into the mutable `stats` object a few times a second.
export default function StatsProbe() {
  const acc = useRef({ t: 0, frames: 0 });
  useFrame(({ gl, camera }, dt) => {
    const a = acc.current;
    a.t += dt;
    a.frames++;
    stats.x = camera.position.x;
    stats.y = camera.position.y;
    stats.z = camera.position.z;
    if (a.t < 0.25) return;
    stats.fps = a.frames / a.t;
    stats.calls = gl.info.render.calls;
    stats.triangles = gl.info.render.triangles;
    stats.geometries = gl.info.memory.geometries;
    stats.textures = gl.info.memory.textures;
    a.t = 0;
    a.frames = 0;
  });
  return null;
}
