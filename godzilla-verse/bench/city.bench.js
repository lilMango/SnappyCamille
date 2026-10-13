// Performance gate, CPU/memory half. Run: bun run bench
//
// Generates the REAL city (src/utils/cityGen.js) and meshes all of it with the real mesher,
// then reports the numbers the architecture was sized against. Draw calls and frame rate
// need a real GPU and are read off the in-page DebugPanel instead (default URL).
//   bun run bench             the real city
//   bun run bench synthetic   the phase-2 box-tower world, for comparison
import { VoxelWorld } from '../src/utils/voxelWorld.js';
import { generateCity } from '../src/utils/cityGen.js';
import { buildSyntheticCity } from '../src/utils/syntheticCity.js';
import { meshSection } from '../src/utils/mesher.js';
import { PAD_VOLUME, SECTIONS, SECTION_VOLUME, RENDER_DIST } from '../src/constants/worldConfig.js';
import { PARK_CENTER, SIZE } from '../src/constants/cityConfig.js';

const kind = process.argv[2] === 'synthetic' ? 'synthetic' : 'city';
const mb = (b) => +(b / (1024 * 1024)).toFixed(1);
const part = (p) => (p ? p.position.byteLength + p.uv.byteLength + p.color.byteLength + p.emit.byteLength + p.index.byteLength : 0);

const t = performance.now();
const world = new VoxelWorld();
let info;
if (kind === 'city') info = generateCity(world, {}).stats;
else info = buildSyntheticCity(world);
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

// what the render-distance ring keeps resident, at the spawn (the park) and mid-city
const ringAt = (cx, cz) => meshAll(sections.filter((s) => Math.hypot(s.cx - cx, s.cz - cz) <= RENDER_DIST));
const spawnRing = ringAt(Math.floor(PARK_CENTER.x / 16), Math.floor(PARK_CENTER.z / 16));
const downtownRing = ringAt(Math.floor(PARK_CENTER.x / 16) - 3, Math.floor(PARK_CENTER.z / 16) - 4);

const fmt = (r) => ({ sections: r.sections, meshes: r.meshes, quads: r.quads, packedMB: mb(r.bytes), meshMs: +r.ms.toFixed(0) });
console.log(
  JSON.stringify(
    {
      world: kind,
      size: `${SIZE}x${SIZE}`,
      info,
      genMs: +genMs.toFixed(0),
      filledSections: sections.length,
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
      },
      ringAtSpawn: { renderDist: RENDER_DIST, ...fmt(spawnRing) },
      ringDowntown: { renderDist: RENDER_DIST, ...fmt(downtownRing) },
    },
    null,
    2,
  ),
);
