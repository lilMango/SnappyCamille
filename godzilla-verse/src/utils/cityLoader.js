import { generateCity } from './cityGen';
import { SEED } from '../constants/cityConfig';

/**
 * Load the city into `world`. Runs generation in a Web Worker and adopts the streamed-back
 * columns; if workers are unavailable or fail, generates on the main thread instead (the
 * loading screen paints first, so it is blocked but not blank).
 *
 *   loadCity(world, { seed, onProgress(phase, 0..1), useWorker }) -> Promise<{
 *     lotMap, buildings, anchors, stats, via }>
 *
 * Progress: generation fills 0 - 0.7, streaming the columns 0.7 - 1.
 */
export function loadCity(world, { seed = SEED, onProgress = () => {}, useWorker = true } = {}) {
  return new Promise((resolve, reject) => {
    const inline = (why) => {
      if (why) console.warn('[godzilla-verse] city worker unavailable, generating on the main thread:', why);
      setTimeout(() => {
        try {
          world.clear();
          const r = generateCity(world, { seed, onProgress: (p, f) => onProgress(p, f * 0.9) });
          world.markAllDirty();
          onProgress('streaming', 1);
          resolve({ ...r, via: 'main thread' });
        } catch (err) {
          reject(err);
        }
      }, 30);
    };

    if (!useWorker || typeof Worker === 'undefined') {
      inline();
      return;
    }

    let worker;
    try {
      worker = new Worker(new URL('./cityWorker.js', import.meta.url), { type: 'module' });
    } catch (err) {
      inline(err);
      return;
    }

    let finished = false;
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') {
        onProgress(m.phase, m.pct * 0.7);
      } else if (m.type === 'columns') {
        for (const c of m.batch) world.adoptColumn(c.cx, c.cz, c.sections, c.filled, c.heightTop);
        onProgress('streaming', 0.7 + 0.3 * m.pct);
      } else if (m.type === 'done') {
        finished = true;
        worker.terminate();
        resolve({ lotMap: m.lotMap, buildings: m.buildings, anchors: m.anchors, stats: m.stats, via: 'worker' });
      }
    };
    worker.onerror = (err) => {
      if (finished) return;
      finished = true;
      worker.terminate();
      inline(err.message || err);
    };
    worker.postMessage({ type: 'generate', seed });
  });
}
