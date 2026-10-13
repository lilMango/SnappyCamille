import { VoxelWorld } from './voxelWorld';
import { generateCity } from './cityGen';

// City generation worker. Builds the whole city in its own VoxelWorld, then streams the
// finished columns back as transferable buffers (so the main thread never janks and the
// loading screen can show real progress).
//
// in:  { type: 'generate', seed }
// out: { type: 'progress', phase, pct }                          while generating
//      { type: 'columns', batch: [{cx, cz, sections, filled, heightTop}], pct }
//      { type: 'done', lotMap, buildings, anchors, stats }

const BATCH = 48;

self.onmessage = (e) => {
  if (e.data.type !== 'generate') return;
  const world = new VoxelWorld();
  const result = generateCity(world, {
    seed: e.data.seed,
    onProgress: (phase, pct) => self.postMessage({ type: 'progress', phase, pct }),
  });

  const cols = [...world.columns.values()];
  for (let i = 0; i < cols.length; i += BATCH) {
    const batch = [];
    const transfer = [];
    for (const col of cols.slice(i, i + BATCH)) {
      batch.push({ cx: col.cx, cz: col.cz, sections: col.sections, filled: col.filled, heightTop: col.heightTop });
      for (const s of col.sections) if (s) transfer.push(s.buffer);
      transfer.push(col.filled.buffer, col.heightTop.buffer);
    }
    self.postMessage({ type: 'columns', batch, pct: Math.min(1, (i + BATCH) / cols.length) }, transfer);
  }

  self.postMessage(
    { type: 'done', lotMap: result.lotMap, buildings: result.buildings, anchors: result.anchors, stats: result.stats },
    [result.lotMap.buffer, result.anchors.buffer],
  );
};
