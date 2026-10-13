// Phase-2 performance gate, CPU/memory half. Run: bun run bench
//
// Builds the 384x384 synthetic city, then meshes it with the real mesher and reports the
// numbers the architecture was sized against (draw calls and frame rate need a real GPU
// and are read off the in-page DebugPanel instead: /godzilla-verse/?world=city).
import { VoxelWorld } from '../src/utils/voxelWorld.js';
import { buildSyntheticCity } from '../src/utils/syntheticCity.js';
import { meshSection } from '../src/utils/mesher.js';
import { PAD_VOLUME, SECTIONS, SECTION_VOLUME, RENDER_DIST } from '../src/constants/worldConfig.js';

const mb = (b) => +(b / (1024 * 1024)).toFixed(1);
const part = (p) => (p ? p.position.byteLength + p.uv.byteLength + p.color.byteLength + p.index.byteLength : 0);

let t = performance.now();
const world = new VoxelWorld();
const { size, towers } = buildSyntheticCity(world);
const genMs = performance.now() - t;

const sections = [];
for (const col of world.columns.values()) {
  for (let sy = 0; sy < SECTIONS; sy++) if (col.sections[sy]) sections.push({ cx: col.cx, cz: col.cz, sy });
}

const pad = new Uint8Array(PAD_VOLUME);
function meshAll(list) {
  let ms = 0;
  let worst = 0;
  let quads = 0;
  let verts = 0;
  let bytes = 0;
  let parts = 0;
  for (const s of list) {
    const a = performance.now();
    world.buildPadded(s.cx, s.cz, s.sy, pad);
    const r = meshSection(pad);
    const d = performance.now() - a;
    ms += d;
    worst = Math.max(worst, d);
    for (const p of [r.opaque, r.cutout]) {
      if (!p) continue;
      quads += p.quadCount;
      verts += p.vertexCount;
      bytes += part(p);
      parts++;
    }
  }
  return { sections: list.length, meshes: parts, ms, worst, quads, verts, bytes };
}

meshAll(sections.slice(0, 200)); // warm up the JIT
const all = meshAll(sections);

// what the render-distance ring keeps resident when the camera is mid-city
const mid = size / 32;
const ring = sections.filter((s) => Math.hypot(s.cx - mid, s.cz - mid) <= RENDER_DIST);
const resident = meshAll(ring);

const out = {
  world: { size: `${size}x${size}`, towers, genMs: +genMs.toFixed(0), filledSections: sections.length },
  voxelDataMB: mb(sections.length * SECTION_VOLUME),
  meshEverything: {
    sections: all.sections,
    meshes: all.meshes,
    totalMs: +all.ms.toFixed(0),
    avgMsPerSection: +(all.ms / all.sections).toFixed(3),
    worstSectionMs: +all.worst.toFixed(2),
    quads: all.quads,
    packedMB: mb(all.bytes),
    bytesPerVertex: +(all.bytes / all.verts).toFixed(1),
    floatLayoutMB: mb(all.verts * 32 + all.quads * 6 * 4), // float32 pos+uv+colour, 32-bit indices
  },
  ringResident: {
    renderDist: RENDER_DIST,
    sections: resident.sections,
    meshes: resident.meshes,
    quads: resident.quads,
    packedMB: mb(resident.bytes),
    meshMs: +resident.ms.toFixed(0),
  },
};
console.log(JSON.stringify(out, null, 2));
